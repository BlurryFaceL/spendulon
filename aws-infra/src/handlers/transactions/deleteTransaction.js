const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': true
};

exports.handler = async (event) => {
    // Handle OPTIONS preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { walletId, transactionId } = event.pathParameters;
        
        // Verify wallet belongs to user
        const wallet = await dynamodb.send(new GetCommand({
            TableName: process.env.WALLETS_TABLE,
            Key: { userId, walletId }
        }));
        
        if (!wallet.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wallet not found' })
            };
        }
        
        // Get transaction to verify it exists and get amount for balance adjustment
        const transaction = await dynamodb.send(new GetCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Key: { walletId, transactionId }
        }));
        
        if (!transaction.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Transaction not found' })
            };
        }
        
        // Verify transaction belongs to the user
        if (transaction.Item.userId && transaction.Item.userId !== userId) {
            return {
                statusCode: 404, // Return 404 to not reveal existence
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Transaction not found' })
            };
        }
        
        const transactionAmount = transaction.Item.amount;
        const timestamp = new Date().toISOString();
        
        // Delete transaction
        await dynamodb.send(new DeleteCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Key: { walletId, transactionId }
        }));
        
        // Update wallet balance (subtract the transaction amount)
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.WALLETS_TABLE,
            Key: { userId, walletId },
            UpdateExpression: 'SET balance = balance - :amount, updatedAt = :timestamp',
            ExpressionAttributeValues: {
                ':amount': transactionAmount,
                ':timestamp': timestamp
            }
        }));
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                message: 'Transaction deleted successfully',
                deletedAmount: transactionAmount
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Could not delete transaction' })
        };
    }
};