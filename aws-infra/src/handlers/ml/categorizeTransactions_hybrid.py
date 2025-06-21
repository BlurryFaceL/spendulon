# CRITICAL: Set environment variables BEFORE any imports to fix ML libs in Lambda
import os

# Set cache directories before importing ML libraries
# Use the pre-downloaded model cache in Lambda package, fallback to /tmp
model_cache_dir = '/var/task/model_cache' if os.path.exists('/var/task/model_cache') else '/tmp'
os.environ['HF_HOME'] = model_cache_dir
os.environ['HF_HUB_CACHE'] = model_cache_dir
os.environ['TRANSFORMERS_CACHE'] = model_cache_dir
os.environ['SENTENCE_TRANSFORMERS_HOME'] = model_cache_dir

# Thread optimization for Lambda
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'

# Now import other modules
import json
import logging
import time
import re
from typing import Dict, List, Any
import numpy as np
import boto3

# Import ML libraries with ARM64 Lambda compatibility
try:
    # Set torch to use minimal threads before import
    import os
    os.environ['TORCH_NUM_THREADS'] = '1'
    os.environ['MKL_NUM_THREADS'] = '1'
    os.environ['OMP_NUM_THREADS'] = '1'
    
    import torch
    
    # Try to disable CPU feature detection in PyTorch
    try:
        torch.set_num_threads(1)
    except:
        pass  # Ignore if it fails
    
    from sentence_transformers import SentenceTransformer
    ML_AVAILABLE = True
    
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info("ML libraries imported successfully")
    
except Exception as e:
    logger = logging.getLogger()
    logger.setLevel(logging.ERROR)
    logger.error(f"Failed to import ML libraries: {e}")
    ML_AVAILABLE = False

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class HybridTransactionCategorizer:
    def __init__(self):
        self.model = None
        self.category_embeddings = None
        self.dynamodb = boto3.resource('dynamodb')
        self.ml_feedback_table = None
        
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
        
        # Initialize ML feedback table for pattern-based learning
        if os.environ.get('ML_FEEDBACK_TABLE'):
            try:
                self.ml_feedback_table = self.dynamodb.Table(os.environ['ML_FEEDBACK_TABLE'])
                logger.info("ML feedback table initialized for pattern learning")
            except Exception as e:
                logger.warning(f"Could not initialize ML feedback table: {e}")
                self.ml_feedback_table = None
        
    def load_model(self):
        """Load sentence transformer model"""
        if not ML_AVAILABLE:
            logger.warning("ML libraries not available")
            return False
            
        if self.model is None:
            logger.info("Loading sentence transformer model...")
            start_time = time.time()
            
            try:
                # Check if pre-downloaded model exists
                model_cache_dir = '/var/task/model_cache'
                if os.path.exists(model_cache_dir):
                    logger.info(f"Using pre-downloaded model cache at {model_cache_dir}")
                    logger.info(f"Cache directory contents: {os.listdir(model_cache_dir) if os.path.exists(model_cache_dir) else 'Not found'}")
                else:
                    logger.warning(f"Pre-downloaded model cache not found at {model_cache_dir}, falling back to /tmp")
                    model_cache_dir = '/tmp'
                
                # Use pre-downloaded model from Lambda package
                self.model = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=model_cache_dir)
                
                # Precompute category embeddings
                self.category_embeddings = self._precompute_category_embeddings()
                
                load_time = time.time() - start_time
                logger.info(f"Model loaded in {load_time:.2f} seconds")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                return False
        
        return True
    
    def _precompute_category_embeddings(self):
        """Create rich category descriptions and compute embeddings"""
        category_descriptions = {
            # Income categories
            "Salary": "salary income wage payroll employment job company monthly pay salary credit earning work",
            "Freelance": "freelance contract gig work project consulting independent contractor client freelance income professional services",
            "Business": "business income revenue sales profit company commercial enterprise trade",
            "Bonus": "bonus incentive reward performance extra payment annual bonus quarterly commission",
            "Investments": "investment dividend interest capital gains stock market mutual fund returns portfolio",
            "Dividends": "dividend stock share profit distribution equity company dividend payment",
            "Cashback": "cashback reward points credit card refund discount money back return",
            "Gifts": "gift money received present birthday wedding festival occasion gift amount",
            "Other Income": "other income miscellaneous earnings various income additional money source",
            
            # Expense categories  
            "Groceries": "grocery supermarket food items vegetables fruits milk bread rice dal grocery store market",
            "Food & Drink": "restaurant food dining swiggy zomato dunzo bigbasket grofers delivery meal cafe breakfast lunch dinner snacks beverages drinks food delivery online food order eating restaurant payment food service dining out takeaway pizza burger dominos mcdonald kfc subway",
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
        descriptions_list = []
        categories_list = []
        
        for category in self.categories:
            description = category_descriptions.get(category, category.lower())
            descriptions_list.append(description)
            categories_list.append(category)
        
        # Batch encode all descriptions
        logger.info(f"Computing embeddings for {len(descriptions_list)} categories...")
        encoded_embeddings = self.model.encode(descriptions_list, convert_to_numpy=True)
        
        for category, embedding in zip(categories_list, encoded_embeddings):
            embeddings[category] = embedding
        
        return embeddings
    
    def extract_description_prefix(self, description):
        """Extract description prefix for pattern matching (same logic as storeFeedback.js)"""
        if not description:
            return 'UNKNOWN'
        
        desc = description.lower().strip()
        
        # UPI patterns
        if desc.startswith('upi/'):
            # Extract: upi/merchant@bank -> upi/merchant (keep lowercase)
            match = re.search(r'^upi/([^@/]+)', desc)
            return f"upi/{match.group(1)}" if match else desc.split('/')[0] + '/' + (desc.split('/')[1] or '').split('@')[0]
        
        if desc.startswith('upi-'):
            # Extract: upi-merchantname -> upi-merchantname (keep lowercase)
            match = re.search(r'^upi-([^\s|]+)', desc)
            return match.group(0) if match else desc.split(' ')[0].split('|')[0]
        
        # Banking patterns - capture company name for IMPS
        if desc.startswith('mmt/imps/'):
            # mmt/imps/503200178232/compassion/sbin0002801 -> mmt/imps/compassion (keep lowercase)
            parts = desc.split('/')
            if len(parts) >= 4:
                return f"{parts[0]}/{parts[1]}/{parts[3]}"  # mmt/imps/company
            return f"{parts[0]}/{parts[1]}" if len(parts) >= 2 else parts[0]
        
        if desc.startswith('neft/') or desc.startswith('rtgs/'):
            parts = desc.split('/')
            return f"{parts[0]}/{parts[1]}" if len(parts) >= 2 else parts[0]
        
        if desc.startswith('ach/'):
            parts = desc.split('/')
            if len(parts) >= 2:
                # Extract full company name after ACH/
                company_part = parts[1].strip()
                return f"ACH/{company_part}"
            return 'ACH'
        
        # Credit card patterns - check for cc and autopay presence
        if 'cc' in desc and 'autopay' in desc:
            return 'cc_autopay'
        
        # For other patterns, take first meaningful part before space or |
        first_part = desc.split(' ')[0].split('|')[0].strip()
        return first_part[:50]  # Limit length
    
    def query_user_feedback(self, user_id, wallet_id, description):
        """Query user's historical feedback for similar transaction patterns"""
        if not self.ml_feedback_table or not user_id or not wallet_id:
            logger.info(f"❌ No feedback table or missing user_id/wallet_id: table={bool(self.ml_feedback_table)}, user_id={user_id}, wallet_id={wallet_id}")
            return None
        
        try:
            description_prefix = self.extract_description_prefix(description)
            wallet_id_prefix = f"{wallet_id}#{description_prefix}"
            
            logger.info(f"🔍 Querying feedback for pattern: '{description_prefix}' from description: '{description}'")
            logger.info(f"🔍 Full GSI key: '{wallet_id_prefix}'")
            
            # Query GSI for similar corrections
            response = self.ml_feedback_table.query(
                IndexName='UserWalletIndex',
                KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id) & 
                                     boto3.dynamodb.conditions.Key('walletId_descriptionPrefix').eq(wallet_id_prefix),
                ScanIndexForward=False,  # Get most recent first
                Limit=5  # Get up to 5 similar corrections
            )
            
            items = response.get('Items', [])
            logger.info(f"📊 DynamoDB query returned {len(items)} items")
            
            if items:
                for i, item in enumerate(items):
                    logger.info(f"  Item {i+1}: prefix='{item.get('descriptionPrefix', 'missing')}', category='{item.get('correctedCategory', 'missing')}'")
            
            if not items:
                logger.info(f"⚠️ No historical feedback found for pattern: '{description_prefix}'")
                return None
            
            # Get the most common corrected category
            category_map = {}
            for item in items:
                category = item.get('correctedCategory')
                if category:
                    category_map[category] = category_map.get(category, 0) + 1
            
            if not category_map:
                return None
            
            # Find most frequent category
            suggested_category = max(category_map, key=category_map.get)
            confidence = category_map[suggested_category] / len(items)
            
            logger.info(f"Found {len(items)} historical corrections for pattern '{description_prefix}': suggesting '{suggested_category}' with {confidence:.2f} confidence")
            
            return {
                'category': suggested_category,
                'confidence': confidence,
                'based_on_corrections': len(items),
                'description_prefix': description_prefix,
                'method': 'historical_pattern'
            }
            
        except Exception as e:
            logger.warning(f"Error querying user feedback: {e}")
            return None
    
    def clean_description(self, description):
        """Clean and enhance transaction description for ML categorization"""
        if not description:
            return ""
        
        # Convert to lowercase
        cleaned = description.lower()
        
        # Extract merchant from ICICI transaction patterns
        merchant = self._extract_merchant_from_transaction(cleaned)
        if merchant:
            return merchant
        
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
    
    def categorize_transaction(self, description, amount=None, user_id=None, wallet_id=None):
        """Categorize a single transaction using historical patterns + semantic similarity"""
        start_time = time.time()
        
        # Step 1: Check user's historical corrections first
        if user_id and wallet_id and description:
            historical_result = self.query_user_feedback(user_id, wallet_id, description)
            if historical_result and historical_result['confidence'] >= 0.7:  # High confidence threshold
                processing_time = (time.time() - start_time) * 1000
                return {
                    "category": historical_result['category'],
                    "confidence": historical_result['confidence'],
                    "processing_time_ms": processing_time,
                    "method": "historical_pattern",
                    "based_on_corrections": historical_result['based_on_corrections'],
                    "description_prefix": historical_result['description_prefix'],
                    "original_description": description
                }
        
        # Step 2: Fallback to ML if no model available
        if not self.load_model():
            return self._fallback_categorization(description, amount)
        
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
        
        # Filter categories based on transaction amount
        if amount is not None and amount < 0:
            relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                 if k in self.expense_categories}
        elif amount is not None and amount > 0:
            relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                 if k in self.income_categories}
        else:
            relevant_categories = self.category_embeddings
        
        # Calculate similarities with relevant categories only
        similarities = {}
        for category, category_embedding in relevant_categories.items():
            # Cosine similarity
            similarity = np.dot(transaction_embedding, category_embedding) / (
                np.linalg.norm(transaction_embedding) * np.linalg.norm(category_embedding)
            )
            similarities[category] = float(similarity)
        
        # Find best match
        best_category = max(similarities, key=similarities.get)
        confidence = similarities[best_category]
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return {
            "category": best_category,
            "confidence": confidence,
            "processing_time_ms": processing_time,
            "method": "sentence_transformer",
            "original_description": description,
            "cleaned_description": clean_desc,
            "enhanced_description": enhanced_desc
        }
    
    def _enhance_with_amount_context(self, description, amount):
        """Add amount-based context to improve categorization"""
        enhanced = description
        
        if amount is not None:
            if amount > 0:
                enhanced += " income credit deposit"
        
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
    
    def batch_categorize(self, transactions, user_id=None, wallet_id=None):
        """Process multiple transactions efficiently with historical pattern learning"""
        results = []
        total_start_time = time.time()
        historical_hits = 0
        
        # Step 1: Check historical patterns first for each transaction
        for i, txn in enumerate(transactions):
            description = txn.get('description', '')
            amount = txn.get('amount')
            
            logger.info(f"📝 Transaction {i+1}: '{description}' (amount: {amount})")
            
            # Try historical pattern first
            if user_id and wallet_id and description:
                historical_result = self.query_user_feedback(user_id, wallet_id, description)
                if historical_result and historical_result['confidence'] >= 0.7:
                    logger.info(f"✅ Using historical pattern for transaction {i+1}: '{historical_result['category']}' (confidence: {historical_result['confidence']})")
                    historical_result.update({
                        "transaction_index": i,
                        "original_description": description
                    })
                    results.append(historical_result)
                    historical_hits += 1
                    continue
                else:
                    if historical_result:
                        logger.info(f"⚠️ Historical pattern found but low confidence ({historical_result['confidence']}) for transaction {i+1}")
                    else:
                        logger.info(f"❌ No historical pattern found for transaction {i+1}")
            
            # Mark for ML processing if no historical match
            results.append(None)  # Placeholder for ML processing
        
        # Step 2: Batch process remaining transactions with ML
        ml_indices = [i for i, result in enumerate(results) if result is None]
        
        if ml_indices and self.load_model():
            # Prepare batch data for ML processing
            batch_descriptions = []
            for i in ml_indices:
                txn = transactions[i]
                description = txn.get('description', '')
                amount = txn.get('amount')
                
                clean_desc = self.clean_description(description)
                enhanced_desc = self._enhance_with_amount_context(clean_desc, amount)
                batch_descriptions.append(enhanced_desc)
        
            # Batch encode all descriptions at once
            if batch_descriptions:
                batch_embeddings = self.model.encode(batch_descriptions, convert_to_numpy=True)
            else:
                batch_embeddings = []
            
            # Process ML results for transactions that need it
            ml_batch_idx = 0
            for i in ml_indices:
                txn = transactions[i]
                amount = txn.get('amount')
                
                if ml_batch_idx < len(batch_embeddings):
                    embedding = batch_embeddings[ml_batch_idx]
                    
                    # Filter categories based on amount
                    if amount is not None and amount < 0:
                        relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                             if k in self.expense_categories}
                    elif amount is not None and amount > 0:
                        relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                             if k in self.income_categories}
                    else:
                        relevant_categories = self.category_embeddings
                    
                    # Calculate similarities
                    similarities = {}
                    for category, category_embedding in relevant_categories.items():
                        similarity = np.dot(embedding, category_embedding) / (
                            np.linalg.norm(embedding) * np.linalg.norm(category_embedding)
                        )
                        similarities[category] = float(similarity)
                    
                    # Find best match
                    best_category = max(similarities, key=similarities.get)
                    confidence = similarities[best_category]
                    
                    ml_result = {
                        "category": best_category,
                        "confidence": confidence,
                        "method": "batch_transformer",
                        "transaction_index": i,
                        "original_description": txn.get('description', ''),
                        "cleaned_description": self.clean_description(txn.get('description', '')),
                        "enhanced_description": batch_descriptions[ml_batch_idx] if ml_batch_idx < len(batch_descriptions) else ""
                    }
                else:
                    # Fallback for any missing embeddings
                    ml_result = self._fallback_categorization(txn.get('description', ''), amount)
                    ml_result["transaction_index"] = i
                
                results[i] = ml_result  # Replace None placeholder
                ml_batch_idx += 1
        
        # Step 3: Handle remaining None placeholders with fallback
        for i, result in enumerate(results):
            if result is None:
                txn = transactions[i]
                fallback_result = self._fallback_categorization(txn.get('description', ''), txn.get('amount'))
                fallback_result["transaction_index"] = i
                results[i] = fallback_result
        
        total_processing_time = (time.time() - total_start_time) * 1000
        
        return {
            "results": results,
            "summary": {
                "total_transactions": len(transactions),
                "total_processing_time_ms": total_processing_time,
                "average_time_per_transaction_ms": total_processing_time / len(transactions) if transactions else 0,
                "ml_available": ML_AVAILABLE,
                "method": "hybrid_historical_ml",
                "historical_pattern_hits": historical_hits,
                "ml_processed": len(ml_indices),
                "high_confidence_count": len([r for r in results if r.get('confidence', 0) > 0.8]),
                "medium_confidence_count": len([r for r in results if 0.6 <= r.get('confidence', 0) <= 0.8]),
                "low_confidence_count": len([r for r in results if r.get('confidence', 0) < 0.6])
            }
        }
    
    def _fallback_batch_categorize(self, transactions):
        """Fallback to sequential processing when ML not available"""
        results = []
        total_start_time = time.time()
        
        for i, txn in enumerate(transactions):
            description = txn.get('description', '')
            amount = txn.get('amount')
            
            result = self._fallback_categorization(description, amount)
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
                "method": "fallback_sequential",
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
        logger.info("Hybrid ML Categorization Lambda invoked")
        logger.info(f"Event: {json.dumps(event, indent=2)}") 
        
        # Initialize categorizer (cached across warm starts)
        if categorizer is None:
            categorizer = HybridTransactionCategorizer()
        
        # Parse input
        if 'body' in event:
            # API Gateway format
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            # Direct invocation format
            body = event
        
        transactions = body.get('transactions', [])
        user_id = body.get('userId')
        wallet_id = body.get('walletId')
        
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
                        ],
                        "userId": "user123",
                        "walletId": "wallet456"
                    }
                })
            }
        
        logger.info(f"Processing {len(transactions)} transactions for user {user_id}, wallet {wallet_id}")
        
        # Process transactions with historical pattern learning
        result = categorizer.batch_categorize(transactions, user_id=user_id, wallet_id=wallet_id)
        
        logger.info(f"Processing complete. Summary: {result['summary']}")
        
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