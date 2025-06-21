const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;

    // Get default categories
    const defaultResponse = await docClient.send(new QueryCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': 'DEFAULT'
      }
    }));

    // Get user's custom categories
    const userResponse = await docClient.send(new QueryCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    // Combine both default and custom categories
    const allCategories = [
      ...(defaultResponse.Items || []),
      ...(userResponse.Items || [])
    ];

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        categories: allCategories
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Could not retrieve user categories' })
    };
  }
};