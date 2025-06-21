const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const { categories } = JSON.parse(event.body);

    if (!categories || !Array.isArray(categories)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Invalid categories data' })
      };
    }

    // Generate human-readable categoryId like frontend does
    const generateCategoryId = (name) => {
      return name.toLowerCase().replace(/\s+/g, '-');
    };

    const timestamp = new Date().toISOString();
    const processedCategories = [];

    // Process categories in batches of 25 (DynamoDB BatchWrite limit)
    for (let i = 0; i < categories.length; i += 25) {
      const batch = categories.slice(i, i + 25);
      
      const putRequests = batch.map(categoryData => ({
        PutRequest: {
          Item: {
            userId,
            categoryId: categoryData.id || generateCategoryId(categoryData.name),
            name: categoryData.name,
            type: categoryData.type,
            icon: categoryData.icon || 'Circle',
            color: categoryData.color || '#6366f1',
            isDefault: categoryData.isDefault || false,
            isInvestment: categoryData.isInvestment || false,
            createdAt: timestamp,
            updatedAt: timestamp
          }
        }
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.USER_CATEGORIES_TABLE]: putRequests
        }
      }));

      processedCategories.push(...putRequests.map(req => req.PutRequest.Item));
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: `Successfully created ${processedCategories.length} categories`,
        categories: processedCategories
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
      body: JSON.stringify({ error: 'Could not bulk create user categories' })
    };
  }
};