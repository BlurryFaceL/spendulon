const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { name, email, picture } = JSON.parse(event.body);
        
        const timestamp = new Date().toISOString();
        
        // Check if user already exists
        const existingUser = await dynamodb.send(new GetCommand({
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        }));
        
        // If user already exists, return existing user without updating
        if (existingUser.Item) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify(existingUser.Item)
            };
        }
        
        // Create new user only if they don't exist
        const userData = {
            userId,
            name: name || 'Unknown User',
            email: email || '',
            picture: picture || '',
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        await dynamodb.send(new PutCommand({
            TableName: process.env.USERS_TABLE,
            Item: userData
        }));
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(userData)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Could not create/update user' })
        };
    }
};