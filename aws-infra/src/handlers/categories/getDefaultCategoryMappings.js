const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    // Get default categories from DynamoDB
    const response = await docClient.send(new QueryCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': 'DEFAULT'
      }
    }));

    // Create mapping from category name to UUID
    const nameToUuidMap = {};
    (response.Items || []).forEach(cat => {
      nameToUuidMap[cat.name] = cat.categoryId;
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        mappings: nameToUuidMap
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
      body: JSON.stringify({ error: 'Could not retrieve category mappings' })
    };
  }
};