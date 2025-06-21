const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

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
    const budgetId = event.pathParameters.budgetId;
    const updateData = JSON.parse(event.body);

    // Verify budget exists and belongs to user
    const existingBudget = await docClient.send(new GetCommand({
      TableName: process.env.USER_BUDGETS_TABLE,
      Key: { userId, budgetId }
    }));

    if (!existingBudget.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Budget not found' })
      };
    }

    // Build update expression
    let updateExpression = 'SET updatedAt = :updatedAt';
    let expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };

    if (updateData.amount !== undefined) {
      updateExpression += ', amount = :amount';
      expressionAttributeValues[':amount'] = parseFloat(updateData.amount);
    }

    if (updateData.period !== undefined) {
      updateExpression += ', period = :period';
      expressionAttributeValues[':period'] = updateData.period;
    }

    if (updateData.categoryId !== undefined) {
      updateExpression += ', categoryId = :categoryId';
      expressionAttributeValues[':categoryId'] = updateData.categoryId;
    }

    const response = await docClient.send(new UpdateCommand({
      TableName: process.env.USER_BUDGETS_TABLE,
      Key: { userId, budgetId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ budget: response.Attributes })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Could not update budget' })
    };
  }
};