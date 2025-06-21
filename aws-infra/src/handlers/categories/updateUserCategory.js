const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const { categoryId } = event.pathParameters;
    const { name, icon, color, isInvestment } = JSON.parse(event.body);

    // Verify category belongs to user
    const existingCategory = await docClient.send(new GetCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      Key: { userId, categoryId }
    }));

    if (!existingCategory.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Category not found' })
      };
    }

    const timestamp = new Date().toISOString();

    // Build update expression dynamically
    let updateExpression = 'SET updatedAt = :updatedAt';
    const expressionAttributeValues = { ':updatedAt': timestamp };

    if (name !== undefined) {
      updateExpression += ', #name = :name';
      expressionAttributeValues[':name'] = name;
    }
    if (icon !== undefined) {
      updateExpression += ', icon = :icon';
      expressionAttributeValues[':icon'] = icon;
    }
    if (color !== undefined) {
      updateExpression += ', color = :color';
      expressionAttributeValues[':color'] = color;
    }
    if (isInvestment !== undefined) {
      updateExpression += ', isInvestment = :isInvestment';
      expressionAttributeValues[':isInvestment'] = isInvestment;
    }

    const updatedCategory = await docClient.send(new UpdateCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      Key: { userId, categoryId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: name !== undefined ? { '#name': 'name' } : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(updatedCategory.Attributes)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Could not update user category' })
    };
  }
};