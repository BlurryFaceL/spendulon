const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({});

const BUCKET_NAME = process.env.S3_BUCKET;
const UPLOAD_EXPIRY = 300; // 5 minutes

exports.handler = async (event) => {
  // CORS headers for spendulon.com
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://spendulon.com",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Credentials": "false"
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    console.log('Generate upload URL request:', JSON.stringify(event, null, 2));
    console.log('AWS Region:', process.env.AWS_REGION);
    console.log('Bucket name:', BUCKET_NAME);

    // Get userId from JWT token
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Parse request body
    const body = JSON.parse(event.body);
    const { walletId, filename } = body;

    if (!userId || !walletId || !filename) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required fields: userId, walletId, filename'
        })
      };
    }

    // Create unique S3 key
    const timestamp = Date.now();
    const s3Key = `pdf-uploads/${userId}/${timestamp}-${filename}`;
    const processingId = `${userId}-${timestamp}`;

    // Generate presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: 'application/pdf',
      Metadata: {
        userId: userId,
        walletId: walletId,
        processingId: processingId,
        originalFilename: filename
      }
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: UPLOAD_EXPIRY 
    });

    console.log(`Generated upload URL for: s3://${BUCKET_NAME}/${s3Key}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        uploadUrl: uploadUrl,
        s3Key: s3Key,
        s3Bucket: BUCKET_NAME,
        processingId: processingId,
        expiresIn: UPLOAD_EXPIRY
      })
    };

  } catch (error) {
    console.error('Error generating upload URL:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to generate upload URL',
        details: error.message
      })
    };
  }
};