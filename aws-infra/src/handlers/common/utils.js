const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// Get allowed origin from environment or default
const getAllowedOrigin = () => {
    return process.env.ALLOWED_ORIGIN || 'https://spendulon.com';
};

// Common CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': getAllowedOrigin(),
    'Access-Control-Allow-Credentials': true,
};

// Verify that a wallet belongs to the specified user
async function verifyWalletOwnership(userId, walletId) {
    const params = {
        TableName: process.env.WALLETS_TABLE,
        Key: {
            userId: userId,
            walletId: walletId
        }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item;
}

// Get a specific transaction
async function getTransaction(walletId, transactionId) {
    const params = {
        TableName: process.env.TRANSACTIONS_TABLE,
        Key: {
            walletId: walletId,
            transactionId: transactionId
        }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item;
}

// Verify that a transaction belongs to the specified user
async function verifyTransactionOwnership(userId, walletId, transactionId) {
    const transaction = await getTransaction(walletId, transactionId);
    
    if (!transaction) {
        return null;
    }
    
    // Check if transaction has userId field (for new transactions)
    if (transaction.userId) {
        return transaction.userId === userId ? transaction : null;
    }
    
    // For legacy transactions without userId, verify wallet ownership
    const wallet = await verifyWalletOwnership(userId, walletId);
    return wallet ? transaction : null;
}

// Standard error responses
const errorResponses = {
    walletNotFound: {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Wallet not found' })
    },
    transactionNotFound: {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Transaction not found' })
    },
    accessDenied: {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Access denied' })
    },
    internalError: {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Internal server error' })
    }
};

module.exports = {
    getAllowedOrigin,
    corsHeaders,
    verifyWalletOwnership,
    getTransaction,
    verifyTransactionOwnership,
    errorResponses
};