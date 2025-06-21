const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': true,
};

exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const budgetData = JSON.parse(event.body);

    // Validate required fields
    if (!budgetData.categoryId || !budgetData.amount || !budgetData.period) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: categoryId, amount, period' })
      };
    }

    // Check if budget already exists for this category
    const existingBudgets = await docClient.send(new QueryCommand({
      TableName: process.env.USER_BUDGETS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'categoryId = :categoryId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':categoryId': budgetData.categoryId
      }
    }));

    if (existingBudgets.Items && existingBudgets.Items.length > 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Budget already exists for this category' })
      };
    }

    const budgetId = crypto.randomUUID();
    const budget = {
      userId,
      budgetId,
      categoryId: budgetData.categoryId,
      amount: parseFloat(budgetData.amount),
      period: budgetData.period,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: process.env.USER_BUDGETS_TABLE,
      Item: budget
    }));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({ budget })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Could not create budget' })
    };
  }
};