const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { walletId } = event.pathParameters;
        
        // Check if wallet exists and belongs to user
        const wallet = await dynamodb.send(new GetCommand({
            TableName: process.env.WALLETS_TABLE,
            Key: { userId, walletId }
        }));
        
        if (!wallet.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({ error: 'Wallet not found' })
            };
        }
        
        // Get all transactions for this wallet to delete them along with the wallet
        const transactions = await dynamodb.send(new QueryCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            KeyConditionExpression: 'walletId = :walletId',
            ExpressionAttributeValues: { ':walletId': walletId }
        }));
        
        // Delete all transactions first (if any exist)
        if (transactions.Items && transactions.Items.length > 0) {
            const deletePromises = transactions.Items.map(transaction => 
                dynamodb.send(new DeleteCommand({
                    TableName: process.env.TRANSACTIONS_TABLE,
                    Key: { 
                        walletId: transaction.walletId, 
                        transactionId: transaction.transactionId 
                    }
                }))
            );
            await Promise.all(deletePromises);
        }
        
        // Delete the wallet
        await dynamodb.send(new DeleteCommand({
            TableName: process.env.WALLETS_TABLE,
            Key: { userId, walletId }
        }));
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ message: 'Wallet deleted successfully' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Could not delete wallet' })
        };
    }
};