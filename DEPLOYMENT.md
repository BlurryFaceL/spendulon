# Spendulon Deployment Guide

## Security Setup

### 1. Environment Variables
```bash
# Copy template and fill with your values
cp .env.example .env.production

# Edit .env.production with your actual:
# - API URLs
# - Cognito settings  
# - AWS credentials (limited IAM role for S3 uploads only)
```

### 2. AWS Parameters
```bash
# Copy template and fill with your values
cp aws-infra/parameters.json aws-infra/parameters.real.json

# Edit parameters.real.json with your actual:
# - Google OAuth client ID/secret
# - SSL certificate ARN
# - Domain name
```

## Frontend Deployment

```bash
# Build production bundle
npm run build

# Deploy to S3 (replace with your bucket)
aws s3 sync build/ s3://your-spendulon-bucket --delete
```

## Backend Deployment

```bash
cd aws-infra

# Build SAM application
sam build

# Deploy with parameters file
sam deploy --parameter-file parameters.real.json

# Alternative: Deploy with inline parameters
sam deploy --parameter-overrides \
  GoogleClientId="your-client-id" \
  GoogleClientSecret="your-client-secret" \
  SSLCertificateArn="your-cert-arn"
```

## SSL Certificate Setup

1. Go to AWS Certificate Manager (ACM) in **us-east-1** region
2. Request a public certificate for your domain
3. Validate via DNS or email
4. Copy the ARN to your parameters file

## Important Security Notes

- ⚠️ Never commit `.env.production` or `parameters.real.json`
- ⚠️ Use minimal IAM permissions for client-side AWS credentials
- ⚠️ SSL certificate must be in us-east-1 for CloudFront
- ⚠️ Keep Google OAuth secrets secure