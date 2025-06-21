const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Processing recurring transactions for next 7 days...');
  
  try {
    const today = new Date();
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const next7DaysString = next7Days.toISOString().split('T')[0];
    
    // Scan for transactions with recurrence != 'never'
    const scanParams = {
      TableName: process.env.TRANSACTIONS_TABLE,
      FilterExpression: 'recurrence <> :never',
      ExpressionAttributeValues: {
        ':never': 'never'
      }
    };
    
    const result = await docClient.send(new ScanCommand(scanParams));
    const recurringTransactions = result.Items || [];
    
    console.log(`Found ${recurringTransactions.length} recurring transactions to process`);
    
    let createdCount = 0;
    
    for (const transaction of recurringTransactions) {
      try {
        const dueDates = calculateDueDatesInRange(transaction, todayString, next7DaysString);
        
        for (const dueDate of dueDates) {
          await createRecurringTransaction(transaction, dueDate);
          createdCount++;
        }
      } catch (error) {
        console.error(`Error processing transaction ${transaction.transactionId}:`, error);
      }
    }
    
    console.log(`Successfully created ${createdCount} recurring transactions`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${recurringTransactions.length} recurring transactions, created ${createdCount} new transactions`,
        processed: recurringTransactions.length,
        created: createdCount
      })
    };
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process recurring transactions' })
    };
  }
};

function calculateDueDatesInRange(transaction, startDateString, endDateString) {
  const lastDate = new Date(transaction.date);
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);
  const dueDates = [];
  
  let nextDate = new Date(lastDate);
  
  // Calculate next occurrence based on recurrence type
  switch (transaction.recurrence) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return []; // Unknown recurrence type
  }
  
  // Keep advancing until we find a date that's in our range
  while (nextDate < startDate) {
    switch (transaction.recurrence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
  }
  
  // Collect all due dates within the 7-day range
  while (nextDate <= endDate) {
    const dueDateString = nextDate.toISOString().split('T')[0];
    
    // Check if this transaction already exists for this date
    // We'll check this in the createRecurringTransaction function
    dueDates.push(dueDateString);
    
    // Advance to next occurrence
    switch (transaction.recurrence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
  }
  
  return dueDates;
}

async function createRecurringTransaction(originalTransaction, dueDate) {
  // Check if a recurring transaction already exists for this date
  const existingTransactions = await docClient.send(new ScanCommand({
    TableName: process.env.TRANSACTIONS_TABLE,
    FilterExpression: 'walletId = :walletId AND #date = :dueDate AND parentTransactionId = :parentId',
    ExpressionAttributeNames: {
      '#date': 'date'
    },
    ExpressionAttributeValues: {
      ':walletId': originalTransaction.walletId,
      ':dueDate': dueDate,
      ':parentId': originalTransaction.transactionId
    }
  }));
  
  if (existingTransactions.Items && existingTransactions.Items.length > 0) {
    console.log(`Recurring transaction already exists for ${dueDate}, skipping...`);
    return;
  }
  
  const newTransactionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Create new transaction based on the original
  const newTransaction = {
    walletId: originalTransaction.walletId,
    transactionId: newTransactionId,
    userId: originalTransaction.userId,
    amount: originalTransaction.amount,
    description: `${originalTransaction.description} (Recurring)`,
    category: originalTransaction.category,
    categoryId: originalTransaction.categoryId,
    type: originalTransaction.type,
    date: dueDate,
    labels: originalTransaction.labels || [],
    toWalletId: originalTransaction.toWalletId || null,
    avoidable: originalTransaction.avoidable || false,
    recurrence: originalTransaction.recurrence, // Keep the same recurrence
    isRecurring: true, // Mark as auto-generated recurring transaction
    parentTransactionId: originalTransaction.transactionId, // Link to original
    createdAt: timestamp,
    updatedAt: timestamp
  };
  
  // Create the new transaction
  await docClient.send(new PutCommand({
    TableName: process.env.TRANSACTIONS_TABLE,
    Item: newTransaction
  }));
  
  // Update wallet balance
  await docClient.send(new UpdateCommand({
    TableName: process.env.WALLETS_TABLE,
    Key: {
      userId: originalTransaction.userId,
      walletId: originalTransaction.walletId
    },
    UpdateExpression: 'SET balance = balance + :amount, updatedAt = :timestamp',
    ExpressionAttributeValues: {
      ':amount': newTransaction.amount,
      ':timestamp': timestamp
    }
  }));
  
  // Note: We don't update the original transaction's date anymore
  // since we're processing multiple dates in advance and checking for duplicates
  
  console.log(`Created recurring transaction: ${newTransactionId} for ${dueDate}`);
}