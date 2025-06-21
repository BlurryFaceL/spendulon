const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const categoryData = JSON.parse(event.body);

    // Validate required fields
    if (!categoryData.name || !categoryData.type) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Missing required fields: name and type are required' })
      };
    }

    const category = {
      userId,
      categoryId: categoryData.categoryId || uuidv4(), // Generate UUID for custom categories
      name: categoryData.name,
      type: categoryData.type, // 'income' or 'expense'
      icon: categoryData.icon || 'Circle',
      color: categoryData.color || '#6366f1',
      isDefault: categoryData.isDefault || false,
      isInvestment: categoryData.isInvestment || false, // New investment flag
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      Item: category
    }));

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(category)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Could not create user category' })
    };
  }
};