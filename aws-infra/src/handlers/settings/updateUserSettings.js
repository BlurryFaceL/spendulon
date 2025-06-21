const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Allowed values for validation
const ALLOWED_VALUES = {
  currency: ['USD', 'INR', 'EUR', 'GBP', 'JPY'],
  theme: ['dark', 'light', 'system'],
  dateFormat: ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'],
  startOfWeek: ['monday', 'sunday']
};

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const settingsData = JSON.parse(event.body);

    // Validate settings
    for (const [key, value] of Object.entries(settingsData)) {
      if (ALLOWED_VALUES[key] && !ALLOWED_VALUES[key].includes(value)) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
          },
          body: JSON.stringify({ 
            message: `Invalid value for ${key}: ${value}. Allowed values: ${ALLOWED_VALUES[key].join(', ')}` 
          })
        };
      }
    }

    const settings = {
      userId,
      currency: settingsData.currency || 'INR',
      theme: settingsData.theme || 'dark',
      dateFormat: settingsData.dateFormat || 'MM/dd/yyyy',
      startOfWeek: settingsData.startOfWeek || 'monday',
      hiddenDefaultCategories: settingsData.hiddenDefaultCategories || [],
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: process.env.USER_SETTINGS_TABLE,
      Item: settings
    }));

    // Return just the settings data (not internal fields)
    const responseSettings = {
      currency: settings.currency,
      theme: settings.theme,
      dateFormat: settings.dateFormat,
      startOfWeek: settings.startOfWeek,
      hiddenDefaultCategories: settings.hiddenDefaultCategories
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ settings: responseSettings })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Could not update user settings' })
    };
  }
};