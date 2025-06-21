const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const { walletId } = event.pathParameters;
        const userId = event.requestContext.authorizer.claims.sub;
        
        // First verify that the wallet belongs to the user
        const walletParams = {
            TableName: process.env.WALLETS_TABLE,
            Key: {
                userId,
                walletId
            }
        };
        
        const walletResult = await dynamodb.send(new GetCommand(walletParams));
        if (!walletResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({ error: 'Wallet not found' })
            };
        }
        
        // Get transactions for the wallet with userId verification
        const transactionParams = {
            TableName: process.env.TRANSACTIONS_TABLE,
            KeyConditionExpression: 'walletId = :walletId',
            FilterExpression: 'userId = :userId', // Add userId filter for security
            ExpressionAttributeValues: {
                ':walletId': walletId,
                ':userId': userId
            }
        };
        
        const result = await dynamodb.send(new QueryCommand(transactionParams));
        
        // Transform transactions to ensure consistent field naming
        const transactions = result.Items.map(transaction => {
            // Handle legacy transactions that might have 'category' instead of 'categoryId'
            if (transaction.category && !transaction.categoryId) {
                transaction.categoryId = transaction.category;
                delete transaction.category;
            }
            return transaction;
        });
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(transactions)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Could not get transactions' })
        };
    }
}; 