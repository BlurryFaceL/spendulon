const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

exports.handler = async (event) => {
  const functions = process.env.FUNCTIONS_TO_WARM.split(',');
  
  await Promise.all(functions.map(async (functionName) => {
    try {
      await lambda.invoke({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ source: 'warmup' })
      }).promise();
      console.log(`Successfully warmed up ${functionName}`);
    } catch (error) {
      console.error(`Error warming up ${functionName}:`, error);
    }
  }));
  
  return { statusCode: 200, body: 'Warmup complete' };
}; 