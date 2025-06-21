# Spendulon - Personal Finance Tracker

<div align="center">
  <img src="public/spendulon-pie-logo.svg" alt="Spendulon Logo" width="120" height="120">
  
  **Clean. Simple. Secure.**
  
  [Visit Spendulon](https://spendulon.com)
</div>

## Overview

Spendulon is a modern personal finance tracking application that helps you manage your expenses, track transactions, and gain insights into your spending habits. Built with a serverless architecture on AWS, it offers secure authentication, intelligent categorization, and powerful analytics.

### Key Features

- 💳 **Multi-Wallet Management** - Track multiple accounts, credit cards, and cash wallets
- 🤖 **AI-Powered Categorization** - Automatic transaction categorization using machine learning
- 📊 **Visual Analytics** - Interactive charts and insights into spending patterns
- 📄 **Bank Statement Import** - Parse and import transactions from PDF bank statements
- 🎯 **Budget Tracking** - Set and monitor budgets by category
- 🔒 **Secure Authentication** - OAuth2 login with Google via AWS Cognito
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Data visualization library
- **AWS Amplify** - Authentication and API integration

### Backend
- **AWS Lambda** - Serverless compute for API endpoints
- **AWS DynamoDB** - NoSQL database for data storage
- **AWS S3** - Static website hosting and file storage
- **AWS CloudFront** - CDN for global content delivery
- **AWS Cognito** - User authentication and authorization
- **AWS API Gateway** - RESTful API management

### Machine Learning
- **Sentence Transformers** - ML model for transaction categorization
- **Python** - ML processing and PDF parsing
- **ONNX Runtime** - Optimized ML inference

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- AWS CLI configured with credentials
- SAM CLI for serverless deployment
- Python 3.9 (for ML components)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/spendulon.git
   cd spendulon
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure the following variables:
   ```
   REACT_APP_API_URL=your-api-gateway-url
   REACT_APP_USER_POOL_ID=your-cognito-pool-id
   REACT_APP_USER_POOL_CLIENT_ID=your-cognito-client-id
   REACT_APP_COGNITO_DOMAIN=your-cognito-domain
   ```

4. **Run locally**
   ```bash
   npm start
   ```

### Backend Deployment

1. **Navigate to infrastructure directory**
   ```bash
   cd aws-infra
   ```

2. **Build the SAM application**
   ```bash
   sam build
   ```

3. **Deploy to AWS**
   ```bash
   sam deploy --guided
   ```

4. **Configure parameters**
   - Follow the prompts to set stack name, region, and parameters
   - Save the configuration to `samconfig.toml`

### Frontend Deployment

1. **Build the production bundle**
   ```bash
   npm run build
   ```

2. **Deploy to S3**
   ```bash
   export S3_BUCKET_NAME=your-bucket-name
   export CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id
   ./scripts/deploy-frontend.sh
   ```

## Project Structure

```
spendulon/
├── src/                      # React frontend source
│   ├── components/           # Reusable UI components
│   ├── context/             # React context providers
│   ├── pages/               # Page components
│   ├── services/            # API service layer
│   └── utils/               # Utility functions
├── aws-infra/               # AWS SAM infrastructure
│   ├── template.yaml        # SAM template
│   ├── src/handlers/        # Lambda function code
│   │   ├── wallets/        # Wallet CRUD operations
│   │   ├── transactions/   # Transaction management
│   │   ├── categories/     # Category management
│   │   ├── ml/            # ML categorization
│   │   └── pdf/           # PDF parsing
│   └── parameters.json     # Deployment parameters
├── scripts/                 # Deployment scripts
└── public/                  # Static assets
```

## Features in Detail

### Transaction Management
- Add, edit, and delete transactions
- Automatic categorization using ML
- Support for income, expense, and transfers
- Bulk import from bank statements

### Smart Categorization
- 17 default categories (Food, Transport, Shopping, etc.)
- ML-powered category suggestions
- Custom category creation
- Learning from user feedback

### Bank Statement Import
- PDF parsing for major banks (optimized for ICICI)
- Automatic transaction extraction
- Intelligent date and amount parsing
- Duplicate detection

### Analytics & Insights
- Monthly spending trends
- Category-wise breakdown
- Budget vs actual comparison
- Expense patterns visualization

### Multi-Currency Support
- Multiple currency wallets
- Real-time balance tracking
- Transfer between wallets
- Currency-specific formatting

## API Documentation

### Authentication
All API endpoints require a valid JWT token from AWS Cognito.

```
Authorization: Bearer {token}
```

### Endpoints

#### Wallets
- `GET /wallets` - Get all user's wallets
- `POST /wallets` - Create new wallet
- `PUT /wallets/{walletId}` - Update wallet
- `DELETE /wallets/{walletId}` - Delete wallet

#### Transactions
- `GET /wallets/{walletId}/transactions` - Get transactions for a wallet
- `POST /wallets/{walletId}/transactions` - Create single transaction
- `POST /wallets/{walletId}/transactions/batch` - Create multiple transactions
- `PUT /wallets/{walletId}/transactions/{transactionId}` - Update transaction
- `DELETE /wallets/{walletId}/transactions/{transactionId}` - Delete transaction

#### Categories
- `GET /users/categories` - Get user's custom categories
- `POST /users/categories` - Create custom category
- `POST /users/categories/bulk` - Create multiple categories
- `PUT /users/categories/{categoryId}` - Update category
- `DELETE /users/categories/{categoryId}` - Delete category
- `GET /default-category-mappings` - Get default category mappings

#### Users
- `POST /users` - Create or update user profile

#### Settings
- `GET /users/settings` - Get user settings
- `PUT /users/settings` - Update user settings

#### Budgets
- `GET /users/budgets` - Get all user budgets
- `POST /users/budgets` - Create new budget
- `PUT /users/budgets/{budgetId}` - Update budget
- `DELETE /users/budgets/{budgetId}` - Delete budget

#### PDF Processing
- `GET /pdf/upload-url` - Get presigned URL for PDF upload
- `POST /pdf/parse` - Parse uploaded PDF bank statement

#### Machine Learning
- `POST /ml/categorize` - Categorize transactions using ML
- `POST /ml/feedback` - Submit feedback for ML training
- `GET /ml/feedback` - Get ML feedback history

#### Recurring Transactions
- `POST /recurring/process` - Process scheduled recurring transactions

## Security

- **Authentication**: AWS Cognito with OAuth2
- **API Security**: API Gateway with Cognito authorizer
- **Data Encryption**: DynamoDB encryption at rest
- **HTTPS**: CloudFront SSL/TLS termination
- **CORS**: Configured for frontend domain only

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## Environment Variables

### Frontend (.env)

- **REACT_APP_API_URL**: The API Gateway endpoint URL from your SAM deployment output (e.g., `https://xxxxx.execute-api.region.amazonaws.com/Prod`)
- **REACT_APP_USER_POOL_ID**: AWS Cognito User Pool ID (found in AWS Console under Cognito > User Pools)
- **REACT_APP_USER_POOL_CLIENT_ID**: AWS Cognito App Client ID (found in User Pool > App Integration > App Clients)
- **REACT_APP_COGNITO_DOMAIN**: Your Cognito hosted UI domain (configured in User Pool > App Integration > Domain)

### Backend (SAM Parameters)

- **Environment**: Deployment environment (`dev`, `staging`, or `prod`)
- **GoogleClientId**: OAuth 2.0 client ID from Google Cloud Console
- **GoogleClientSecret**: OAuth 2.0 client secret from Google Cloud Console
- **DomainName**: Your frontend domain name (e.g., `spendulon.com`)
- **SSLCertificateArn**: AWS ACM certificate ARN for HTTPS (must be in us-east-1 for CloudFront)

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure API Gateway CORS is configured
   - Check frontend URL in allowed origins

2. **Authentication Failed**
   - Verify Cognito configuration
   - Check OAuth redirect URLs

3. **ML Categorization Not Working**
   - Ensure Lambda has enough memory (1GB+)
   - Check Python dependencies

4. **PDF Import Failing**
   - Verify PDF format compatibility
   - Check Lambda timeout settings

---

<div align="center">
  Built with 🤖 and 💻
</div>