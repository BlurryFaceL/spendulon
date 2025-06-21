const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const { categoryId } = event.pathParameters;

    // Verify category belongs to user and is not a default category
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

    // Prevent deletion of default categories
    if (existingCategory.Item.isDefault) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Cannot delete default categories' })
      };
    }

    await docClient.send(new DeleteCommand({
      TableName: process.env.USER_CATEGORIES_TABLE,
      Key: { userId, categoryId }
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Category deleted successfully' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Could not delete user category' })
    };
  }
};