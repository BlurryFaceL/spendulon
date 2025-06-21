const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
};

/**
 * Extract description prefix for pattern matching (same logic as storeFeedback.js)
 */
function extractDescriptionPrefix(description) {
  if (!description) return 'UNKNOWN';
  
  const desc = description.trim();
  
  // UPI patterns
  if (desc.startsWith('UPI/')) {
    // Extract: UPI/merchant@bank -> UPI/merchant
    const match = desc.match(/^UPI\/([^@\/]+)/);
    return match ? `UPI/${match[1]}` : desc.split('/')[0] + '/' + (desc.split('/')[1] || '').split('@')[0];
  }
  
  if (desc.startsWith('UPI-')) {
    // Extract: UPI-MERCHANTNAME -> UPI-MERCHANTNAME
    const match = desc.match(/^UPI-([^\s|]+)/);
    return match ? match[0] : desc.split(' ')[0].split('|')[0];
  }
  
  // Banking patterns - capture company name for IMPS
  if (desc.startsWith('MMT/IMPS/')) {
    // MMT/IMPS/503200178232/COMPASSION/SBIN0002801 -> MMT/IMPS/COMPASSION
    const parts = desc.split('/');
    if (parts.length >= 4) {
      return `${parts[0]}/${parts[1]}/${parts[3]}`; // MMT/IMPS/COMPANY
    }
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  
  if (desc.startsWith('NEFT/') || desc.startsWith('RTGS/')) {
    const parts = desc.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  
  if (desc.startsWith('ACH/')) {
    const parts = desc.split('/');
    if (parts.length >= 2) {
      // Extract full company name after ACH/
      const companyPart = parts[1].trim();
      return `ACH/${companyPart}`;
    }
    return 'ACH';
  }
  
  // Check if this looks like a banking transaction with key phrases
  // Updated to include all ICICI bank statement legends and common banking patterns
  const bankingPrefixes = [
    // UPI patterns
    'UPI/', 'UPI-',
    // ICICI specific codes (uppercase for consistency with existing patterns)
    'BBPS', 'BCTT', 'BIL/', 'BPAY', 'CCWD', 'DTAX', 'EBA/', 'ISEC', 'IDTX', 
    'IMPS/', 'INF/', 'INFT', 'LCCBRN', 'LNPY', 'MMT/', 'NETG', 'NEFT/', 'ONL/', 
    'PAC/', 'PAVC', 'PAYC', 'RCHG', 'SGB', 'SMO/', 'TOP/', 'UCCBRN', 'VAT/', 
    'MAT/', 'NFS/', 'VPS/', 'IPS/', 'RTGS/',
    // Generic banking patterns
    'ACH/', 'CORP/', 'BANK/', 'OFI/', 'COLL', 'SAL-', 'SALARY', 'CMS/', 
    'ECS/', 'NACH/', 'MANDATE/', 'REVERSAL', 'REFUND', 'INTEREST', 'DIVIDEND',
    // Additional common patterns
    'FD CLOS', 'CREDIT', 'DEBIT', 'CHARGES', 'TAX', 'TDS', 'GST'
  ];
  const hasBankingPattern = bankingPrefixes.some(prefix => desc.includes(prefix));
  
  if (hasBankingPattern) {
    // For banking transactions, take first meaningful part before space or |
    const firstPart = desc.split(' ')[0].split('|')[0].trim();
    return firstPart.substring(0, 50); // Limit length
  } else {
    // For credit card merchant names (no banking patterns), preserve more context
    // Take up to first 3 words or until | character, whichever comes first
    const fullDescription = desc.split('|')[0].trim();
    const words = fullDescription.split(' ');
    const meaningfulPart = words.slice(0, Math.min(3, words.length)).join(' ');
    return meaningfulPart.substring(0, 50); // Limit length
  }
}

/**
 * Find similar transaction corrections for a given description
 */
async function findSimilarCorrections(userId, walletId, description) {
  const descriptionPrefix = extractDescriptionPrefix(description);
  const walletId_descriptionPrefix = `${walletId}#${descriptionPrefix}`;
  
  try {
    const params = {
      TableName: process.env.ML_FEEDBACK_TABLE,
      IndexName: 'UserWalletIndex',
      KeyConditionExpression: 'userId = :userId AND walletId_descriptionPrefix = :walletId_descriptionPrefix',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':walletId_descriptionPrefix': walletId_descriptionPrefix
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 10 // Get up to 10 similar corrections
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    
    return {
      descriptionPrefix,
      similarCorrections: result.Items || [],
      count: result.Count || 0
    };
    
  } catch (error) {
    console.error('Error querying similar corrections:', error);
    return {
      descriptionPrefix,
      similarCorrections: [],
      count: 0,
      error: error.message
    };
  }
}

/**
 * Get ML correction suggestion based on historical user feedback
 */
async function getMlSuggestion(userId, walletId, description) {
  const similarData = await findSimilarCorrections(userId, walletId, description);
  
  if (similarData.count === 0) {
    return {
      hasSuggestion: false,
      descriptionPrefix: similarData.descriptionPrefix,
      message: 'No similar transactions found'
    };
  }
  
  // Get the most common corrected category from similar transactions
  const categoryMap = {};
  similarData.similarCorrections.forEach(correction => {
    const category = correction.correctedCategory;
    categoryMap[category] = (categoryMap[category] || 0) + 1;
  });
  
  // Find the most frequently corrected category
  const suggestedCategory = Object.keys(categoryMap).reduce((a, b) => 
    categoryMap[a] > categoryMap[b] ? a : b
  );
  
  const confidence = categoryMap[suggestedCategory] / similarData.count;
  
  return {
    hasSuggestion: true,
    suggestedCategory,
    confidence,
    descriptionPrefix: similarData.descriptionPrefix,
    basedOnCorrections: similarData.count,
    recentCorrections: similarData.similarCorrections.slice(0, 3), // Show top 3 recent corrections
    message: `Based on ${similarData.count} similar transaction(s), suggesting "${suggestedCategory}" with ${Math.round(confidence * 100)}% confidence`
  };
}

exports.handler = async (event) => {
  console.log('Query ML Feedback event:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Extract userId from JWT token
    const userId = event.requestContext?.authorizer?.claims?.sub;
    
    if (!userId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Unauthorized - missing user ID'
        })
      };
    }

    const queryParams = event.queryStringParameters || {};
    const { walletId, description, action = 'suggestion' } = queryParams;
    
    if (!walletId || !description) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required parameters: walletId, description'
        })
      };
    }

    let result;
    
    if (action === 'suggestion') {
      // Get ML suggestion based on user's past corrections
      result = await getMlSuggestion(userId, walletId, description);
    } else if (action === 'similar') {
      // Get raw similar corrections
      result = await findSimilarCorrections(userId, walletId, description);
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid action. Use "suggestion" or "similar"'
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        action,
        userId,
        walletId,
        description,
        result
      })
    };

  } catch (error) {
    console.error('Error in query ML feedback:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

// Export utility functions for use in other modules
exports.findSimilarCorrections = findSimilarCorrections;
exports.getMlSuggestion = getMlSuggestion;
exports.extractDescriptionPrefix = extractDescriptionPrefix;