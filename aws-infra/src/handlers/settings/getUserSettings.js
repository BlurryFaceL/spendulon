const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const DEFAULT_SETTINGS = {
  currency: 'INR',
  theme: 'dark',
  dateFormat: 'MM/dd/yyyy',
  startOfWeek: 'monday',
  hiddenDefaultCategories: []
};

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;

    const response = await docClient.send(new GetCommand({
      TableName: process.env.USER_SETTINGS_TABLE,
      Key: { userId }
    }));

    // If no settings found, return defaults
    const settings = response.Item ? {
      currency: response.Item.currency,
      theme: response.Item.theme,
      dateFormat: response.Item.dateFormat,
      startOfWeek: response.Item.startOfWeek,
      hiddenDefaultCategories: response.Item.hiddenDefaultCategories || []
    } : DEFAULT_SETTINGS;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ settings })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Could not retrieve user settings' })
    };
  }
};