const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// Get allowed origin from environment or default
const getAllowedOrigin = () => {
    return process.env.ALLOWED_ORIGIN || 'https://spendulon.com';
};

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;

        //const userId = event.requestContext?.authorizer?.claims?.sub;

        if (!userId) {
            // User not authenticated
            return {
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': getAllowedOrigin(),
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }
        
        const params = {
            TableName: process.env.WALLETS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };
        
        const result = await dynamodb.send(new QueryCommand(params));
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': getAllowedOrigin(),
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(result.Items)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': getAllowedOrigin(),
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Could not get wallets' })
        };
    }
}; 