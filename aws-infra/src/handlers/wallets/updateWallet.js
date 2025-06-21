const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { walletId } = event.pathParameters;
        const { name, currency, type, isDefault, icon, initialBalance } = JSON.parse(event.body);
        
        // Validate wallet exists and belongs to user
        const existingWallet = await dynamodb.send(new GetCommand({
            TableName: process.env.WALLETS_TABLE,
            Key: { userId, walletId }
        }));
        
        if (!existingWallet.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({ error: 'Wallet not found' })
            };
        }
        
        // If setting this wallet as default, unset other defaults
        if (isDefault) {
            // Get all existing wallets for this user that are default
            const existingWallets = await dynamodb.send(new QueryCommand({
                TableName: process.env.WALLETS_TABLE,
                KeyConditionExpression: 'userId = :userId',
                FilterExpression: 'isDefault = :true',
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':true': true
                }
            }));
            
            // Update each existing default wallet to not be default (excluding current wallet)
            if (existingWallets.Items && existingWallets.Items.length > 0) {
                const updatePromises = existingWallets.Items
                    .filter(wallet => wallet.walletId !== walletId) // Filter out current wallet
                    .map(wallet => 
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
        
        const timestamp = new Date().toISOString();
        
        // Build update expression dynamically
        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = { ':updatedAt': timestamp };
        
        if (name !== undefined) {
            updateExpression += ', #name = :name';
            expressionAttributeValues[':name'] = name;
        }
        if (currency !== undefined) {
            updateExpression += ', currency = :currency';
            expressionAttributeValues[':currency'] = currency;
        }
        if (type !== undefined) {
            updateExpression += ', #type = :type';
            expressionAttributeValues[':type'] = type;
        }
        if (isDefault !== undefined) {
            updateExpression += ', isDefault = :isDefault';
            expressionAttributeValues[':isDefault'] = isDefault;
        }
        if (icon !== undefined) {
            updateExpression += ', icon = :icon';
            expressionAttributeValues[':icon'] = icon;
        }
        if (initialBalance !== undefined) {
            updateExpression += ', initialBalance = :initialBalance';
            expressionAttributeValues[':initialBalance'] = parseFloat(initialBalance);
        }
        
        const result = await dynamodb.send(new UpdateCommand({
            TableName: process.env.WALLETS_TABLE,
            Key: { userId, walletId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: {
                '#name': 'name',
                '#type': 'type'
            },
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(result.Attributes)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Could not update wallet' })
        };
    }
};