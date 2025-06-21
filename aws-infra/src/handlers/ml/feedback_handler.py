import json
import logging
import boto3
import time
from decimal import Decimal

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    Handle customer feedback for ML categorization corrections
    
    Expected input:
    {
        "userId": "user123",
        "transactionDescription": "UPI/SWIGGY/Payment", 
        "amount": -450,
        "predictedCategory": "Miscellaneous",
        "actualCategory": "Food & Drink",
        "confidence": 0.25
    }
    """
    
    try:
        logger.info("Feedback handler invoked")
        logger.info(f"Event: {json.dumps(event, indent=2)}")
        
        # Parse input
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        # Validate required fields
        required_fields = ['userId', 'transactionDescription', 'predictedCategory', 'actualCategory']
        for field in required_fields:
            if field not in body:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Credentials": True,
                    },
                    "body": json.dumps({
                        "error": f"Missing required field: {field}",
                        "required_fields": required_fields
                    })
                }
        
        # Extract data
        user_id = body['userId']
        description = body['transactionDescription']
        amount = body.get('amount')
        predicted_category = body['predictedCategory']
        actual_category = body['actualCategory']
        confidence = body.get('confidence', 0.0)
        
        # Store feedback in DynamoDB
        table_name = 'spendulon-ml-feedback-dev'  # Create this table
        table = dynamodb.Table(table_name)
        
        # Create feedback record
        feedback_item = {
            'userId': user_id,
            'feedbackId': f"{user_id}#{int(time.time() * 1000)}",  # Sort key
            'transactionDescription': description,
            'amount': Decimal(str(amount)) if amount is not None else None,
            'predictedCategory': predicted_category,
            'actualCategory': actual_category,
            'confidence': Decimal(str(confidence)),
            'timestamp': int(time.time()),
            'createdAt': int(time.time() * 1000)
        }
        
        # Put item in table
        table.put_item(Item=feedback_item)
        
        logger.info(f"Stored feedback for user {user_id}: {predicted_category} -> {actual_category}")
        
        # Also update user patterns table for quick lookup
        patterns_table_name = 'spendulon-user-patterns-dev'
        try:
            patterns_table = dynamodb.Table(patterns_table_name)
            
            # Create pattern key from cleaned description
            pattern_key = _create_pattern_key(description)
            
            pattern_item = {
                'userId': user_id,
                'patternKey': pattern_key,
                'description': description,
                'preferredCategory': actual_category,
                'feedbackCount': 1,
                'lastUpdated': int(time.time()),
                'confidence': Decimal(str(confidence))
            }
            
            # Use update expression to increment count if pattern exists
            patterns_table.put_item(
                Item=pattern_item,
                ConditionExpression='attribute_not_exists(patternKey)'
            )
            
        except patterns_table.meta.client.exceptions.ConditionalCheckFailedException:
            # Pattern already exists, increment feedback count
            patterns_table.update_item(
                Key={'userId': user_id, 'patternKey': pattern_key},
                UpdateExpression='SET feedbackCount = feedbackCount + :inc, lastUpdated = :time, preferredCategory = :cat',
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':time': int(time.time()),
                    ':cat': actual_category
                }
            )
        except Exception as e:
            logger.warning(f"Could not update patterns table: {e}")
        
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": True,
            },
            "body": json.dumps({
                "message": "Feedback recorded successfully",
                "feedbackId": feedback_item['feedbackId'],
                "patternKey": pattern_key
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing feedback: {str(e)}", exc_info=True)
        
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": True,
            },
            "body": json.dumps({
                "error": "Internal server error",
                "details": str(e)
            })
        }

def _create_pattern_key(description):
    """Create a normalized pattern key from transaction description"""
    import re
    
    # Convert to lowercase and extract meaningful parts
    cleaned = description.lower()
    
    # Extract merchant patterns (same logic as ML categorizer)
    patterns = [
        r'upi/([^/]+)/',                       # UPI/merchant/
        r'upi/([^@\s]+)@',                     # UPI/merchant@bank
        r'bharatpe[^/]*/pay to ([^/]+)/',      # BHARATPE/Pay To merchant/
        r'mmt/imps/[^/]*/([^/]+)/',           # MMT/IMPS/xxx/merchant/
        r'ach/([^/\s]+)',                      # ACH/merchant
    ]
    
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            merchant = match.group(1).strip()
            merchant = re.sub(r'[^\w\s]', '', merchant)  # Remove special chars
            if len(merchant) >= 3:
                return f"merchant_{merchant}"
    
    # Fallback: use first few meaningful words
    words = re.findall(r'\w+', cleaned)
    meaningful_words = [w for w in words if len(w) >= 3 and not w.isdigit()][:3]
    
    if meaningful_words:
        return f"pattern_{'_'.join(meaningful_words)}"
    
    return f"unknown_{hash(description) % 10000}"