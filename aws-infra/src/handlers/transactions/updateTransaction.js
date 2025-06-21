const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'PUT,OPTIONS',
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
        const { amount, description, category, categoryId, date, type, labels, avoidable, recurrence } = JSON.parse(event.body);
        
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
        
        // Get existing transaction
        const existingTransaction = await dynamodb.send(new GetCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Key: { walletId, transactionId }
        }));
        
        if (!existingTransaction.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Transaction not found' })
            };
        }
        
        // Verify transaction belongs to the user
        if (existingTransaction.Item.userId && existingTransaction.Item.userId !== userId) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Access denied' })
            };
        }
        
        const oldAmount = existingTransaction.Item.amount;
        const timestamp = new Date().toISOString();
        
        // Build update expression dynamically
        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = { ':updatedAt': timestamp };
        
        if (amount !== undefined) {
            // Calculate the correct amount based on transaction type
            let transactionAmount = Math.round(parseFloat(amount) * 100) / 100;
            const transactionType = type !== undefined ? type : existingTransaction.Item.type;
            
            if (transactionType === 'expense') {
                transactionAmount = -Math.abs(transactionAmount); // Expenses are negative
            } else if (transactionType === 'transfer_out') {
                transactionAmount = -Math.abs(transactionAmount); // Transfer out is negative (money leaving)
            } else {
                transactionAmount = Math.abs(transactionAmount); // Income and transfer_in are positive
            }
            
            updateExpression += ', amount = :amount';
            expressionAttributeValues[':amount'] = transactionAmount;
        }
        if (description !== undefined) {
            updateExpression += ', description = :description';
            expressionAttributeValues[':description'] = description;
        }
        if (category !== undefined) {
            updateExpression += ', category = :category';
            expressionAttributeValues[':category'] = category;
        }
        if (categoryId !== undefined) {
            updateExpression += ', categoryId = :categoryId';
            expressionAttributeValues[':categoryId'] = categoryId;
        }
        if (date !== undefined) {
            updateExpression += ', #date = :date';
            expressionAttributeValues[':date'] = date;
        }
        if (type !== undefined) {
            updateExpression += ', #type = :type';
            expressionAttributeValues[':type'] = type;
        }
        if (labels !== undefined) {
            updateExpression += ', labels = :labels';
            expressionAttributeValues[':labels'] = labels;
        }
        if (avoidable !== undefined) {
            updateExpression += ', avoidable = :avoidable';
            expressionAttributeValues[':avoidable'] = avoidable;
        }
        if (recurrence !== undefined) {
            updateExpression += ', recurrence = :recurrence';
            expressionAttributeValues[':recurrence'] = recurrence;
        }
        
        // Update transaction
        const updatedTransaction = await dynamodb.send(new UpdateCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Key: { walletId, transactionId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: {
                '#date': 'date',
                '#type': 'type'
            },
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));
        
        // If amount changed, update wallet balance
        if (amount !== undefined && expressionAttributeValues[':amount'] !== oldAmount) {
            const balanceDifference = expressionAttributeValues[':amount'] - oldAmount;
            
            await dynamodb.send(new UpdateCommand({
                TableName: process.env.WALLETS_TABLE,
                Key: { userId, walletId },
                UpdateExpression: 'SET balance = balance + :difference, updatedAt = :timestamp',
                ExpressionAttributeValues: {
                    ':difference': balanceDifference,
                    ':timestamp': timestamp
                }
            }));
        }
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(updatedTransaction.Attributes)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Could not update transaction' })
        };
    }
};