const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
};

/**
 * Extract description prefix for pattern matching
 * Examples:
 * - "UPI/merchant@bank/Payment..." -> "UPI/merchant"
 * - "UPI-MERCHANTNAME | other details" -> "UPI-MERCHANTNAME"
 * - "MMT/IMPS/123/Company Name" -> "MMT/IMPS"
 * - "ACH/COMPANY NAME/details" -> "ACH/COMPANY"
 */
function extractDescriptionPrefix(description) {
  if (!description) return 'UNKNOWN';
  
  // Clean description first - remove multi-line artifacts and normalize
  let desc = description.toLowerCase().trim();
  
  // Remove everything after | or newline (PDF parsing artifacts)
  desc = desc.split('|')[0].split('\n')[0].trim();
  
  // UPI patterns
  if (desc.startsWith('upi/')) {
    // Extract: upi/merchant@bank -> upi/merchant
    const match = desc.match(/^upi\/([^@\/]+)/);
    return match ? `upi/${match[1]}` : desc.split('/')[0] + '/' + (desc.split('/')[1] || '').split('@')[0];
  }
  
  if (desc.startsWith('upi-')) {
    // Extract: UPI-MERCHANTNAME -> UPI-MERCHANTNAME
    const match = desc.match(/^upi-([^\s|]+)/);
    return match ? match[0] : desc.split(' ')[0].split('|')[0];
  }
  
  // Banking patterns - capture company name for IMPS
  if (desc.startsWith('mmt/imps/')) {
    // MMT/IMPS/503200178232/COMPASSION/SBIN0002801 -> mmt/imps/compassion
    const parts = desc.split('/');
    if (parts.length >= 4) {
      return `${parts[0]}/${parts[1]}/${parts[3]}`; // mmt/imps/company
    }
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  
  if (desc.startsWith('neft/') || desc.startsWith('rtgs/')) {
    const parts = desc.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  
  if (desc.startsWith('ach/')) {
    const parts = desc.split('/');
    if (parts.length >= 2) {
      // Extract full company name after ACH/ but clean any trailing artifacts
      const companyPart = parts[1].split('|')[0].split('\n')[0].trim();
      return `ach/${companyPart}`;
    }
    return 'ach';
  }
  
  // Credit card patterns - check for cc and autopay presence
  if (desc.includes('cc') && desc.includes('autopay')) {
    return 'cc_autopay';
  }
  
  // Check if this looks like a banking transaction with key phrases
  // Updated to include all ICICI bank statement legends and common banking patterns
  const bankingPrefixes = [
    // UPI patterns
    'upi/', 'upi-',
    // ICICI specific codes
    'bbps', 'bctt', 'bil/', 'bpay', 'ccwd', 'dtax', 'eba/', 'isec', 'idtx', 
    'imps/', 'inf/', 'inft', 'lccbrn', 'lnpy', 'mmt/', 'netg', 'neft/', 'onl/', 
    'pac/', 'pavc', 'payc', 'rchg', 'sgb', 'smo/', 'top/', 'uccbrn', 'vat/', 
    'mat/', 'nfs/', 'vps/', 'ips/', 'rtgs/',
    // Generic banking patterns
    'ach/', 'corp/', 'bank/', 'ofi/', 'coll', 'sal-', 'salary', 'cms/', 
    'ecs/', 'nach/', 'mandate/', 'reversal', 'refund', 'interest', 'dividend',
    // Additional common patterns
    'fd clos', 'credit', 'debit', 'charges', 'tax', 'tds', 'gst'
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

exports.handler = async (event) => {
  console.log('Store ML Feedback event:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { walletId, originalResult, userCorrection, timestamp } = body;
    
    // Extract userId from JWT token
    const userId = event.requestContext?.authorizer?.claims?.sub;

    if (!userId || !walletId || !originalResult || !userCorrection) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required fields: userId, walletId, originalResult, userCorrection'
        })
      };
    }

    const feedbackId = `${userId}_${walletId}_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const feedbackTimestamp = timestamp || new Date().toISOString();
    
    // Extract description prefix for pattern matching
    const originalDescription = originalResult.description || '';
    const userCorrectedDescription = userCorrection.description || originalDescription;
    const descriptionPrefix = extractDescriptionPrefix(userCorrectedDescription);
    
    // Create composite key for GSI: walletId#descriptionPrefix
    const walletId_descriptionPrefix = `${walletId}#${descriptionPrefix}`;

    const feedbackItem = {
      feedbackId,  // Primary key: userId_walletId_timestamp_uuid
      userId,      // GSI partition key
      walletId_descriptionPrefix, // GSI sort key: walletId#descriptionPrefix
      walletId,
      timestamp: feedbackTimestamp,
      
      // Original ML result (for debugging)
      originalCategory: originalResult.category,
      originalConfidence: originalResult.confidence || 0,
      originalDescription: originalDescription,
      originalAmount: originalResult.amount || 0,
      originalDate: originalResult.date || '',
      originalType: originalResult.type || '',
      
      // User correction (for learning)
      correctedCategory: userCorrection.category,
      correctedDescription: userCorrectedDescription,
      correctedAmount: userCorrection.amount || 0,
      correctedDate: userCorrection.date || '',
      correctedType: userCorrection.type || '',
      
      // Pattern matching info (only description-based)
      descriptionPrefix,
      fullDescription: userCorrectedDescription,
      
      // Metadata
      correctionType: originalResult.category !== userCorrection.category ? 'category_changed' : 'category_confirmed',
      source: body.source || 'manual_entry',
      createdAt: new Date().toISOString()
    };

    const params = {
      TableName: process.env.ML_FEEDBACK_TABLE,
      Item: feedbackItem
    };

    await dynamodb.send(new PutCommand(params));

    console.log('ML feedback stored:', feedbackId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Feedback stored successfully',
        feedbackId,
        feedbackType: feedbackItem.feedbackType
      })
    };

  } catch (error) {
    console.error('Error storing ML feedback:', error);
    
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