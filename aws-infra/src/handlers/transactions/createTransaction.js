const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
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
        const { walletId } = event.pathParameters;
        const userId = event.requestContext.authorizer.claims.sub;
        const { amount, description, note, category, date, type, labels, toWalletId, avoidable, recurrence } = JSON.parse(event.body);
        
        // Frontend sends UUID, lookup the category name
        let categoryId = category; // Frontend sends UUID
        let categoryName = null;
        
        if (category) {
            try {
                // Try direct get first (for user categories)
                let categoryResult = await dynamodb.send(new GetCommand({
                    TableName: process.env.USER_CATEGORIES_TABLE,
                    Key: {
                        userId: userId,
                        categoryId: category
                    }
                }));
                
                if (categoryResult.Item) {
                    categoryName = categoryResult.Item.name;
                } else {
                    // Try default categories
                    categoryResult = await dynamodb.send(new GetCommand({
                        TableName: process.env.USER_CATEGORIES_TABLE,
                        Key: {
                            userId: 'DEFAULT',
                            categoryId: category
                        }
                    }));
                    
                    if (categoryResult.Item) {
                        categoryName = categoryResult.Item.name;
                    } else {
                        categoryName = 'Unknown Category';
                    }
                }
            } catch (error) {
                categoryName = 'Unknown Category';
            }
        }
        
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
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wallet not found' })
            };
        }
        
        const transactionId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // Calculate the correct amount based on transaction type
        // Convert to cents/paise to avoid floating point precision issues
        let transactionAmount = Math.round(parseFloat(amount) * 100) / 100;
        if (type === 'expense') {
            transactionAmount = -Math.abs(transactionAmount); // Expenses are negative
        } else if (type === 'transfer_out') {
            transactionAmount = -Math.abs(transactionAmount); // Transfer out is negative (money leaving)
        } else {
            transactionAmount = Math.abs(transactionAmount); // Income and transfer_in are positive
        }

        const transaction = {
            walletId,
            transactionId,
            userId, // Add userId for security
            amount: transactionAmount,
            description: description || note,
            category: categoryName, // Store the proper category name
            categoryId: categoryId, // UUID for joins
            type: type || 'expense',
            date: date || timestamp,
            labels: labels || [],
            toWalletId: toWalletId || null,
            avoidable: avoidable || false, // Add avoidable field
            recurrence: recurrence || 'never', // Add recurrence field
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        // Create transaction
        const transactionParams = {
            TableName: process.env.TRANSACTIONS_TABLE,
            Item: transaction
        };
        
        await dynamodb.send(new PutCommand(transactionParams));
        
        // Update wallet balance - ensure numeric operation
        const updateWalletParams = {
            TableName: process.env.WALLETS_TABLE,
            Key: {
                userId,
                walletId
            },
            UpdateExpression: 'ADD balance :amount SET updatedAt = :timestamp',
            ExpressionAttributeValues: {
                ':amount': transactionAmount,
                ':timestamp': timestamp
            },
            ReturnValues: 'ALL_NEW'
        };
        
        const updatedWallet = await dynamodb.send(new UpdateCommand(updateWalletParams));
        
        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify({
                transaction,
                wallet: updatedWallet.Attributes
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Could not create transaction' })
        };
    }
}; 