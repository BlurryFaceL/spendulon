const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': true,
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  try {
    const walletId = event.pathParameters?.walletId;
    const userId = event.requestContext?.authorizer?.claims?.sub;
    
    if (!userId || !walletId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing userId or walletId' })
      };
    }
    
    const { transactions } = JSON.parse(event.body);
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid or empty transactions array' })
      };
    }
    
    // Limit batch size to avoid Lambda timeout
    const MAX_BATCH_SIZE = 100;
    if (transactions.length > MAX_BATCH_SIZE) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} transactions. Please split into smaller batches.` 
        })
      };
    }
    
    const timestamp = new Date().toISOString();
    const results = {
      successful: [],
      failed: []
    };
    
    // Process transactions in batches of 25 (DynamoDB BatchWrite limit)
    const DYNAMODB_BATCH_SIZE = 25;
    let totalAmountChange = 0;
    
    for (let i = 0; i < transactions.length; i += DYNAMODB_BATCH_SIZE) {
      const batch = transactions.slice(i, i + DYNAMODB_BATCH_SIZE);
      const writeRequests = [];
      
      for (const transactionData of batch) {
        try {
          // Validate required fields
          if (!transactionData.date || transactionData.amount === undefined || !transactionData.type) {
            results.failed.push({
              transaction: transactionData,
              error: 'Missing required fields (date, amount, or type)'
            });
            continue;
          }
          
          const transactionId = crypto.randomUUID();
          
          // Calculate the amount with proper sign
          let amount = parseFloat(transactionData.amount);
          if (transactionData.type === 'expense' || transactionData.type === 'transfer_out') {
            amount = -Math.abs(amount);
          } else {
            amount = Math.abs(amount);
          }
          
          // Track total wallet balance change
          if (transactionData.type !== 'transfer_in' && transactionData.type !== 'transfer_out') {
            totalAmountChange += amount;
          } else if (transactionData.type === 'transfer_out') {
            totalAmountChange += amount; // negative amount
          } else if (transactionData.type === 'transfer_in') {
            totalAmountChange += amount; // positive amount
          }
          
          const transaction = {
            walletId,
            transactionId,
            userId,
            amount,
            date: transactionData.date,
            type: transactionData.type,
            description: transactionData.note || transactionData.description || '',
            category: transactionData.category || null,
            categoryId: transactionData.categoryId || null,
            labels: transactionData.labels || [],
            toWalletId: transactionData.toWalletId || null,
            fromWalletId: transactionData.fromWalletId || null,
            externalAccount: transactionData.externalAccount || null,
            avoidable: transactionData.avoidable || false,
            recurrence: transactionData.recurrence || 'never',
            source: transactionData.source || 'batch_import',
            createdAt: timestamp,
            updatedAt: timestamp
          };
          
          writeRequests.push({
            PutRequest: {
              Item: transaction
            }
          });
          
          results.successful.push({
            transactionId,
            amount
          });
          
        } catch (error) {
          console.error('Error processing transaction:', error);
          results.failed.push({
            transaction: transactionData,
            error: error.message
          });
        }
      }
      
      // Execute batch write if we have any valid requests
      if (writeRequests.length > 0) {
        try {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [process.env.TRANSACTIONS_TABLE]: writeRequests
            }
          }));
        } catch (error) {
          console.error('BatchWrite error:', error);
          // Move successful items to failed if batch write fails
          const failedCount = writeRequests.length;
          results.successful = results.successful.slice(0, -failedCount);
          for (let j = 0; j < failedCount; j++) {
            results.failed.push({
              transaction: batch[j],
              error: 'Failed to write to database'
            });
          }
        }
      }
    }
    
    // Update wallet balance in a single operation
    if (totalAmountChange !== 0) {
      try {
        await docClient.send(new UpdateCommand({
          TableName: process.env.WALLETS_TABLE,
          Key: {
            userId,
            walletId
          },
          UpdateExpression: 'SET balance = balance + :amount, updatedAt = :timestamp',
          ExpressionAttributeValues: {
            ':amount': totalAmountChange,
            ':timestamp': timestamp
          }
        }));
      } catch (error) {
        console.error('Failed to update wallet balance:', error);
        // Don't fail the entire operation if balance update fails
      }
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Processed ${transactions.length} transactions`,
        successful: results.successful.length,
        failed: results.failed.length,
        results
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create transactions batch' })
    };
  }
};