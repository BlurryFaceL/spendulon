const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { name, currency, type = 'bank', isDefault = false, icon = 'building-2', balance = 0 } = JSON.parse(event.body);
        
        
        const walletId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // If this wallet is being set as default, unset other defaults for this user
        if (isDefault) {
            // Get all existing wallets for this user
            const existingWallets = await dynamodb.send(new QueryCommand({
                TableName: process.env.WALLETS_TABLE,
                KeyConditionExpression: 'userId = :userId',
                FilterExpression: 'isDefault = :true',
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':true': true
                }
            }));
            
            // Update each existing default wallet to not be default
            if (existingWallets.Items && existingWallets.Items.length > 0) {
                const updatePromises = existingWallets.Items.map(wallet => 
                    dynamodb.send(new UpdateCommand({
                        TableName: process.env.WALLETS_TABLE,
                        Key: { userId: wallet.userId, walletId: wallet.walletId },
                        UpdateExpression: 'SET isDefault = :false',
                        ExpressionAttributeValues: { ':false': false }
                    }))
                );
                await Promise.all(updatePromises);
            }
        }
        
        const wallet = {
            userId,
            walletId,
            name,
            currency,
            type,
            isDefault,
            icon,
            balance: parseFloat(balance) || 0,
            initialBalance: parseFloat(balance) || 0, // Store the initial balance separately
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        await dynamodb.send(new PutCommand({
            TableName: process.env.WALLETS_TABLE,
            Item: wallet
        }));
        
        return {
            statusCode: 201,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(wallet)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Could not create wallet' })
        };
    }
}; 