#!/bin/bash

# Configuration
BUCKET_NAME="${S3_BUCKET_NAME:-spendulon-frontend-dev}"
BUILD_DIR="build"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID}" # Set via environment variable

# Build the app
echo "Building React app..."
npm run build

# Sync to S3
echo "Deploying to S3..."
aws s3 sync $BUILD_DIR s3://$BUCKET_NAME --delete

# Set proper content types
aws s3 cp s3://$BUCKET_NAME/index.html s3://$BUCKET_NAME/index.html \
  --content-type="text/html" --metadata-directive="REPLACE"

# Invalidate CloudFront cache (if using CloudFront)
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"

echo "Deployment complete!"
echo "Website URL: http://$BUCKET_NAME.s3-website.${AWS_REGION:-eu-west-2}.amazonaws.com"