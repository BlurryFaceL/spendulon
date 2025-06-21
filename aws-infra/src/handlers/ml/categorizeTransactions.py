import json
import logging
import time
import re
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any

# Set cache directories and disable problematic optimizations before importing ML libraries
os.environ['TORCH_HOME'] = '/tmp'
os.environ['TRANSFORMERS_CACHE'] = '/tmp'
os.environ['HF_HOME'] = '/tmp'
os.environ['HF_DATASETS_CACHE'] = '/tmp'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['ONNX_DISABLE_OPTIMIZER'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'

# Import ML libraries
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    ML_AVAILABLE = True
except ImportError as e:
    logging.warning(f"ML libraries not available: {e}")
    ML_AVAILABLE = False

# Import AWS libraries
try:
    import boto3
    AWS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"AWS SDK not available: {e}")
    AWS_AVAILABLE = False

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class TransactionCategorizer:
    def __init__(self):
        self.model = None
        self.category_embeddings = None
        # Categories from frontend /src/config/categories.js
        self.income_categories = [
            "Salary", "Freelance", "Business", "Bonus", "Investments", 
            "Dividends", "Cashback", "Gifts", "Other Income"
        ]
        
        self.expense_categories = [
            "Groceries", "Food & Drink", "Transport", "Fuel", "Rent", 
            "Utilities", "Phone", "Internet", "Subscriptions", "Shopping", 
            "Healthcare", "Medicines", "Clothing", "Entertainment", "Fitness",
            "Car Maintenance", "Beauty & Personal Care", "Education", "Books", 
            "Insurance", "Travel", "Taxes", "Gifts & Donations", "Maintenance", 
            "Home Improvement", "Loan Payments", "Investments", "Miscellaneous"
        ]
        
        # All categories combined for ML processing
        self.categories = self.income_categories + self.expense_categories
        
    def load_model(self):
        """Load sentence transformer model and precompute category embeddings"""
        if not ML_AVAILABLE:
            logger.warning("ML libraries not available")
            return False
            
        if self.model is None:
            logger.info("Loading sentence transformer model...")
            start_time = time.time()
            
            try:
                # Load the original working model
                cache_folder = os.getenv('TRANSFORMERS_CACHE', '/tmp')
                self.model = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=cache_folder)
                
                # Precompute category embeddings for faster inference
                self.category_embeddings = self._precompute_category_embeddings()
                
                load_time = time.time() - start_time
                logger.info(f"Model loaded in {load_time:.2f} seconds")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load ML model: {e}")
                return False
        
        return True
    
    def _precompute_category_embeddings(self):
        """Create rich category descriptions and compute embeddings"""
        category_descriptions = {
            # Income categories
            "Salary": "salary income wage payroll employment job company monthly pay salary credit earning work",
            "Freelance": "freelance contract gig work project consulting independent contractor client payment",
            "Business": "business income revenue sales profit company commercial enterprise trade",
            "Bonus": "bonus incentive reward performance extra payment annual bonus quarterly commission",
            "Investments": "investment dividend interest capital gains stock market mutual fund returns portfolio",
            "Dividends": "dividend stock share profit distribution equity company dividend payment",
            "Cashback": "cashback reward points credit card refund discount money back return",
            "Gifts": "gift money received present birthday wedding festival occasion gift amount",
            "Other Income": "other income miscellaneous earnings various income additional money source",
            
            # Expense categories  
            "Groceries": "grocery supermarket food items vegetables fruits milk bread rice dal grocery store market",
            "Food & Drink": "restaurant food dining swiggy zomato delivery meal cafe breakfast lunch dinner snacks beverages drinks",
            "Transport": "uber ola taxi metro bus train auto rickshaw ride travel commute transport public transport",
            "Fuel": "fuel petrol diesel gas station oil pump vehicle fuel car bike scooter",
            "Rent": "rent house apartment flat accommodation housing monthly rent property home",
            "Utilities": "electricity water gas utility bill monthly utility payment power water bill",
            "Phone": "mobile phone bill postpaid prepaid recharge telecom airtel jio vodafone",
            "Internet": "internet broadband wifi data plan connection online internet bill",
            "Subscriptions": "subscription netflix prime spotify monthly subscription service premium membership",
            "Shopping": "amazon flipkart myntra shopping online store mall retail purchase clothes electronics gadgets",
            "Healthcare": "hospital doctor medical health pharmacy clinic checkup treatment dental healthcare",
            "Medicines": "medicine pharmacy medical store drug tablet capsule prescription medication",
            "Clothing": "clothes dress shirt pants shoes fashion apparel garment clothing wear",
            "Entertainment": "movie cinema theatre game gaming sports club entertainment fun recreation",
            "Fitness": "gym fitness exercise workout health club sports training physical activity",
            "Car Maintenance": "car maintenance service repair vehicle auto garage mechanic oil change",
            "Beauty & Personal Care": "salon haircut beauty parlor spa grooming personal care cosmetics skincare wellness massage",
            "Education": "school college university fees tuition education course training learning books educational",
            "Books": "books study educational material reading literature textbook learning",
            "Insurance": "insurance premium life health car vehicle motor insurance policy coverage protection",
            "Travel": "travel vacation trip hotel flight train bus booking tourism holiday",
            "Taxes": "tax income tax gst tds tax payment government tax filing",
            "Gifts & Donations": "gift donation charity church temple mosque religious giving charitable contribution",
            "Maintenance": "maintenance repair service fix plumber electrician ac washing machine appliance",
            "Home Improvement": "home improvement renovation decoration furniture interior design construction",
            "Loan Payments": "loan payment emi mortgage credit loan installment bank loan repayment",
            "Miscellaneous": "other miscellaneous unknown unclassified general expense random various different"
        }
        
        # Encode all category descriptions
        embeddings = {}
        for category in self.categories:
            description = category_descriptions.get(category, category.lower())
            embeddings[category] = self.model.encode(description, convert_to_numpy=True)
        
        return embeddings
    
    def clean_description(self, description):
        """Clean and enhance transaction description for ML categorization"""
        if not description:
            return ""
        
        # Convert to lowercase
        cleaned = description.lower()
        
        # Extract merchant from ICICI transaction patterns
        merchant = self._extract_merchant_from_transaction(cleaned)
        if merchant:
            # Create clean description focused on merchant and action
            return f"{merchant} payment transaction expense"
        
        # Remove banking noise but keep meaningful words
        noise_patterns = [
            r'/\d+',              # /numbers like /503200178232
            r'@\w+',              # @bank codes like @axisban
            r'ibl[a-f0-9]+',      # IBL reference codes
            r'\d{10,}',           # Long numbers
            r'\d{2}-\d{2}-\d{4}', # Dates
            r'payment from ph',   # Common phrase
            r'axis|union bank|canara|kotak|federal|state bank', # Bank names
        ]
        
        for pattern in noise_patterns:
            cleaned = re.sub(pattern, ' ', cleaned)
        
        # Extract meaningful transaction words
        meaningful_words = []
        words = re.findall(r'\w+', cleaned)
        
        # Keep words that are likely merchants or transaction types
        skip_words = {
            'upi', 'mmt', 'imps', 'ach', 'neft', 'bank', 'banking', 'mobile',
            'payment', 'from', 'ph', 'ltd', 'pvt', 'corp', 'coll', 'ac'
        }
        
        for word in words:
            if len(word) >= 3 and word not in skip_words and not word.isdigit():
                meaningful_words.append(word)
        
        # Combine meaningful words
        if meaningful_words:
            return ' '.join(meaningful_words[:5])  # Keep top 5 meaningful words
        
        return cleaned.strip()
    
    def _extract_merchant_from_transaction(self, description):
        """Extract merchant name from ICICI transaction description"""
        desc_lower = description.lower()
        
        # ICICI transaction patterns
        patterns = [
            # UPI patterns
            r'upi/([^/]+)/',                       # UPI/merchant/
            r'upi/([^@\s]+)@',                     # UPI/merchant@bank
            
            # Payment gateway patterns
            r'bharatpe[^/]*/pay to ([^/]+)/',      # BHARATPE/Pay To merchant/
            
            # IMPS patterns
            r'mmt/imps/[^/]*/([^/]+)/',           # MMT/IMPS/xxx/merchant/
            
            # ACH patterns  
            r'ach/([^/\s]+)',                      # ACH/merchant
            
            # Special cases
            r'fd clos.*?([a-z]+)',                 # FD closure
            r'([a-z]{4,})\s+payment',              # merchant payment
        ]
        
        for pattern in patterns:
            match = re.search(pattern, desc_lower)
            if match:
                merchant = match.group(1).strip()
                
                # Filter out common non-merchant terms
                skip_merchants = {
                    'paytm', 'phonepe', 'gpay', 'payments', 'bank', 'pvtltd', 
                    'payment', 'mobile', 'banking', 'axis', 'union', 'canara',
                    'kotak', 'federal', 'state', 'icici', 'clearing', 'corp'
                }
                
                if merchant not in skip_merchants:
                    # Clean up merchant name
                    merchant = re.sub(r'[^\w\s]', ' ', merchant)
                    merchant = re.sub(r'\s+', ' ', merchant).strip()
                    
                    if len(merchant) >= 3:  # Minimum merchant name length
                        return merchant
        
        return None
    
    def categorize_transaction(self, description, amount=None):
        """Categorize a single transaction using semantic similarity"""
        if not self.load_model():
            # Fallback to basic categorization
            return self._fallback_categorization(description, amount)
        
        start_time = time.time()
        
        # Clean description
        clean_desc = self.clean_description(description)
        
        if not clean_desc:
            return {
                "category": "Miscellaneous",
                "confidence": 0.1,
                "processing_time_ms": 0,
                "method": "empty_description"
            }
        
        # Enhance with amount context
        enhanced_desc = self._enhance_with_amount_context(clean_desc, amount)
        
        # Get transaction embedding
        transaction_embedding = self.model.encode(enhanced_desc, convert_to_numpy=True)
        
        # Calculate similarities with all categories
        similarities = {}
        for category, category_embedding in self.category_embeddings.items():
            similarity = cosine_similarity(
                [transaction_embedding], 
                [category_embedding]
            )[0][0]
            similarities[category] = float(similarity)
        
        # Find best match
        best_category = max(similarities, key=similarities.get)
        confidence = similarities[best_category]
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return {
            "category": best_category,
            "confidence": confidence,
            "processing_time_ms": processing_time,
            "method": "sentence_transformers",
            "original_description": description,
            "cleaned_description": clean_desc,
            "enhanced_description": enhanced_desc
        }
    
    def _enhance_with_amount_context(self, description, amount):
        """Add amount-based context to improve categorization"""
        enhanced = description
        
        if amount is not None:
            if amount > 0:
                enhanced += " income credit deposit money received earning"
            elif amount < -5000:
                enhanced += " large expense significant payment big amount"
            elif amount < -1000:
                enhanced += " medium expense regular payment"
            elif amount < -100:
                enhanced += " small expense minor payment"
            else:
                enhanced += " very small expense tiny payment"
        
        return enhanced
    
    def _fallback_categorization(self, description, amount):
        """Simple fallback categorization when ML is not available"""
        if not description:
            return {
                "category": "Miscellaneous",
                "confidence": 0.1,
                "processing_time_ms": 1,
                "method": "fallback_no_description"
            }
        
        desc_lower = description.lower()
        
        # Basic patterns matching frontend categories
        if any(word in desc_lower for word in ['swiggy', 'zomato', 'food', 'restaurant', 'dining']):
            return {"category": "Food & Drink", "confidence": 0.7, "processing_time_ms": 1, "method": "fallback_food"}
        elif any(word in desc_lower for word in ['uber', 'ola', 'taxi', 'transport', 'metro', 'bus']):
            return {"category": "Transport", "confidence": 0.7, "processing_time_ms": 1, "method": "fallback_transport"}
        elif any(word in desc_lower for word in ['grocery', 'supermarket', 'vegetables', 'fruits']):
            return {"category": "Groceries", "confidence": 0.7, "processing_time_ms": 1, "method": "fallback_grocery"}
        elif any(word in desc_lower for word in ['salary', 'income', 'payroll']) and amount and amount > 0:
            return {"category": "Salary", "confidence": 0.7, "processing_time_ms": 1, "method": "fallback_income"}
        elif any(word in desc_lower for word in ['fuel', 'petrol', 'diesel']):
            return {"category": "Fuel", "confidence": 0.7, "processing_time_ms": 1, "method": "fallback_fuel"}
        else:
            return {"category": "Miscellaneous", "confidence": 0.3, "processing_time_ms": 1, "method": "fallback"}
    
    def batch_categorize(self, transactions):
        """Process multiple transactions efficiently"""
        results = []
        total_start_time = time.time()
        
        for i, txn in enumerate(transactions):
            description = txn.get('description', '')
            amount = txn.get('amount')
            
            result = self.categorize_transaction(description, amount)
            result["transaction_index"] = i
            results.append(result)
        
        total_processing_time = (time.time() - total_start_time) * 1000
        
        return {
            "results": results,
            "summary": {
                "total_transactions": len(transactions),
                "total_processing_time_ms": total_processing_time,
                "average_time_per_transaction_ms": total_processing_time / len(transactions) if transactions else 0,
                "ml_available": ML_AVAILABLE,
                "high_confidence_count": len([r for r in results if r['confidence'] > 0.8]),
                "medium_confidence_count": len([r for r in results if 0.6 <= r['confidence'] <= 0.8]),
                "low_confidence_count": len([r for r in results if r['confidence'] < 0.6])
            }
        }

# Global categorizer instance (reused across warm invocations)
categorizer = None

def lambda_handler(event, context):
    """Main Lambda handler"""
    global categorizer
    
    try:
        logger.info("ML Categorization Lambda invoked")
        logger.info(f"Event: {json.dumps(event, indent=2)}")
        
        # Initialize categorizer (cached across warm starts)
        if categorizer is None:
            categorizer = TransactionCategorizer()
        
        # Parse input
        if 'body' in event:
            # API Gateway format
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            # Direct invocation format
            body = event
        
        transactions = body.get('transactions', [])
        
        if not transactions:
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": True,
                },
                "body": json.dumps({
                    "error": "No transactions provided",
                    "expected_format": {
                        "transactions": [
                            {"description": "UPI SWIGGY BANGALORE", "amount": -450}
                        ]
                    }
                })
            }
        
        logger.info(f"Processing {len(transactions)} transactions")
        
        # Process transactions
        result = categorizer.batch_categorize(transactions)
        
        logger.info(f"Processing complete. Summary: {result['summary']}")
        
        # ASYNC: Store ML results in DynamoDB for training/feedback (unified table)
        try:
            if AWS_AVAILABLE and 'results' in result:
                # Extract user info from event (if available)
                user_id = body.get('userId', 'unknown')
                wallet_id = body.get('walletId', 'unknown') 
                
                # Get ML feedback table name from environment
                ml_feedback_table = os.environ.get('ML_FEEDBACK_TABLE', 'spendulon-ml-feedback-dev')
                
                dynamodb = boto3.resource('dynamodb')
                table = dynamodb.Table(ml_feedback_table)
                
                # Store original ML results for each transaction
                for i, ml_result in enumerate(result['results']):
                    if i < len(transactions):
                        original_txn = transactions[i]
                        
                        # Create feedback record for original ML result
                        feedback_id = f"ml-original-{uuid.uuid4()}"
                        timestamp = datetime.utcnow().isoformat()
                        
                        feedback_record = {
                            'userId': user_id,  # Primary key
                            'walletId': wallet_id,  # Sort key 
                            'feedbackId': feedback_id,  # Attribute (indexed via GSI)
                            'feedbackType': 'ml_original',
                            'timestamp': timestamp,  # Separate column for debugging
                            'originalResult': {
                                'description': original_txn.get('description'),
                                'amount': original_txn.get('amount'),
                                'category': ml_result.get('category'),
                                'confidence': ml_result.get('confidence'),
                                'method': ml_result.get('method'),
                                'processing_time_ms': ml_result.get('processing_time_ms', 0)
                            },
                            'userCorrection': None,  # No user correction yet
                            'source': 'api_call',
                            'createdAt': timestamp
                        }
                        
                        # Store async (don't block main response)
                        table.put_item(Item=feedback_record)
                
                logger.info(f"Stored {len(result['results'])} ML results in DynamoDB table {ml_feedback_table}")
                
        except Exception as ddb_error:
            logger.error(f"Error storing ML results to DynamoDB: {ddb_error}")
            # Don't fail the main response for DynamoDB errors
        
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": True,
            },
            "body": json.dumps(result, indent=2)
        }
        
    except Exception as e:
        logger.error(f"Error processing transactions: {str(e)}", exc_info=True)
        
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