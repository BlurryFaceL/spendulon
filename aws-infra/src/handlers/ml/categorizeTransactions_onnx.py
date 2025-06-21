# CRITICAL: Set environment variables BEFORE any imports to fix ONNX Runtime in Lambda
import os

# Set cache directories before importing ML libraries
os.environ['HF_HOME'] = '/tmp'
os.environ['HF_HUB_CACHE'] = '/tmp'

# Critical ONNX Runtime environment variables for Lambda compatibility
# MUST be set before importing onnxruntime
os.environ['ORT_DISABLE_CPU_CAPABILITY_QUERY'] = '1'  # Disable CPU detection
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['ORT_DISABLE_TELEMETRY_EVENTS'] = '1'  # Disable telemetry
os.environ['ORT_DISABLE_SYSTEM_INFO'] = '1'  # Try to disable all system info gathering

# Now import other modules
import json
import logging
import time
import re
from typing import Dict, List, Any
import numpy as np

# Import ONNX Runtime and supporting libraries
ML_AVAILABLE = False
try:
    # Import with minimal exposure to system calls
    import onnxruntime as ort
    
    # Create a custom logger to prevent default logger issues
    class DummyLogger:
        def log(self, *args, **kwargs):
            pass
    
    # Try to set up logging in multiple ways
    try:
        ort.set_default_logger_severity(4)  # ERROR level only
        ort.set_default_logger_verbosity(0)  # Minimal verbosity
    except:
        pass
    
    # Disable telemetry completely
    try:
        ort.disable_telemetry_events()
    except:
        pass
    
    from transformers import AutoTokenizer
    from sklearn.metrics.pairwise import cosine_similarity
    import requests
    ML_AVAILABLE = True
    
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info("ONNX Runtime imported successfully")
    
except Exception as e:
    logger = logging.getLogger()
    logger.setLevel(logging.ERROR)
    logger.error(f"Failed to import ONNX Runtime: {e}")
    ML_AVAILABLE = False

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class ONNXTransactionCategorizer:
    def __init__(self):
        self.session = None
        self.tokenizer = None
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
        """Load ONNX model and tokenizer"""
        if not ML_AVAILABLE:
            logger.warning("ML libraries not available")
            return False
            
        if self.session is None:
            logger.info("Loading ONNX model and tokenizer...")
            start_time = time.time()
            
            try:
                # Load tokenizer (lightweight)
                model_name = "sentence-transformers/all-MiniLM-L6-v2"
                self.tokenizer = AutoTokenizer.from_pretrained(
                    model_name, 
                    cache_dir="/tmp"
                )
                
                # Download ONNX model to /tmp
                onnx_model_path = self._download_onnx_model()
                
                # Absolute minimal ONNX session creation
                logger.info(f"Creating ONNX session with minimal config")
                self.session = ort.InferenceSession(onnx_model_path)
                
                # Precompute category embeddings
                self.category_embeddings = self._precompute_category_embeddings()
                
                load_time = time.time() - start_time
                logger.info(f"ONNX model loaded in {load_time:.2f} seconds")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load ONNX model: {e}")
                return False
        
        return True
    
    def _download_onnx_model(self):
        """Use pre-downloaded ONNX model or download if needed"""
        # First check if model is pre-downloaded in Lambda package
        package_model_path = os.path.join(os.path.dirname(__file__), "model.onnx")
        if os.path.exists(package_model_path):
            logger.info(f"Using pre-downloaded ONNX model from {package_model_path}")
            return package_model_path
            
        # Fallback to downloading to /tmp
        model_url = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx"
        model_path = "/tmp/model.onnx"
        
        if os.path.exists(model_path):
            logger.info("ONNX model already exists in /tmp")
            return model_path
            
        logger.info("Downloading ONNX model...")
        response = requests.get(model_url)
        response.raise_for_status()
        
        with open(model_path, 'wb') as f:
            f.write(response.content)
            
        logger.info(f"ONNX model saved to {model_path}")
        return model_path
    
    def _encode_text(self, text):
        """Encode text using ONNX model"""
        # Tokenize
        encoded = self.tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="np"
        )
        
        # Run ONNX inference
        inputs = {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64)
        }
        
        # Add token_type_ids only if present (models like all-MiniLM-L6-v2 don't have them)
        if "token_type_ids" in encoded and encoded["token_type_ids"] is not None:
            inputs["token_type_ids"] = encoded["token_type_ids"].astype(np.int64)
        
        outputs = self.session.run(None, inputs)
        embeddings = outputs[0]  # Last hidden state
        
        # Mean pooling with attention mask
        attention_mask = encoded["attention_mask"]
        masked_embeddings = embeddings * attention_mask[:, :, np.newaxis]
        summed = np.sum(masked_embeddings, axis=1)
        counts = np.sum(attention_mask, axis=1, keepdims=True)
        mean_pooled = summed / counts
        
        # Normalize
        norms = np.linalg.norm(mean_pooled, axis=1, keepdims=True)
        normalized = mean_pooled / norms
        
        return normalized[0]  # Return single embedding
    
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
        for category in self.categories:
            description = category_descriptions.get(category, category.lower())
            embeddings[category] = self._encode_text(description)
        
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
            # Just return the merchant name - let the model decide context
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
        
        # Get transaction embedding using ONNX
        transaction_embedding = self._encode_text(enhanced_desc)
        
        # Filter categories based on transaction amount
        if amount is not None and amount < 0:
            # Negative amount = expense, only consider expense categories
            relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                 if k in self.expense_categories}
        elif amount is not None and amount > 0:
            # Positive amount = income, only consider income categories
            relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                 if k in self.income_categories}
        else:
            # Unknown amount, consider all categories
            relevant_categories = self.category_embeddings
        
        # Calculate similarities with relevant categories only
        similarities = {}
        for category, category_embedding in relevant_categories.items():
            # Use numpy dot product for consistency
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
            "method": "onnx_runtime",
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
            # For expenses, don't add confusing generic words
            # The amount filtering already handles expense vs income
        
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
        """Process multiple transactions efficiently using true batching"""
        if not self.load_model():
            # Fallback to sequential processing
            return self._fallback_batch_categorize(transactions)
        
        results = []
        total_start_time = time.time()
        
        # Prepare batch data
        batch_descriptions = []
        batch_amounts = []
        expense_indices = []
        income_indices = []
        
        for i, txn in enumerate(transactions):
            description = txn.get('description', '')
            amount = txn.get('amount')
            
            clean_desc = self.clean_description(description)
            enhanced_desc = self._enhance_with_amount_context(clean_desc, amount)
            
            batch_descriptions.append(enhanced_desc)
            batch_amounts.append(amount)
            
            # Track expense vs income for filtering
            if amount is not None and amount < 0:
                expense_indices.append(i)
            elif amount is not None and amount > 0:
                income_indices.append(i)
        
        # Batch encode all descriptions at once
        batch_embeddings = self._encode_text_batch(batch_descriptions)
        
        # Process each transaction with its embedding
        for i, (description, amount, embedding) in enumerate(zip(batch_descriptions, batch_amounts, batch_embeddings)):
            
            # Filter categories based on amount
            if i in expense_indices:
                relevant_categories = {k: v for k, v in self.category_embeddings.items() 
                                     if k in self.expense_categories}
            elif i in income_indices:
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
            
            result = {
                "category": best_category,
                "confidence": confidence,
                "method": "onnx_batch",
                "transaction_index": i,
                "original_description": transactions[i].get('description', ''),
                "cleaned_description": self.clean_description(transactions[i].get('description', '')),
                "enhanced_description": description
            }
            results.append(result)
        
        total_processing_time = (time.time() - total_start_time) * 1000
        
        return {
            "results": results,
            "summary": {
                "total_transactions": len(transactions),
                "total_processing_time_ms": total_processing_time,
                "average_time_per_transaction_ms": total_processing_time / len(transactions) if transactions else 0,
                "ml_available": ML_AVAILABLE,
                "method": "batch_processing",
                "high_confidence_count": len([r for r in results if r['confidence'] > 0.8]),
                "medium_confidence_count": len([r for r in results if 0.6 <= r['confidence'] <= 0.8]),
                "low_confidence_count": len([r for r in results if r['confidence'] < 0.6])
            }
        }
    
    def _encode_text_batch(self, texts):
        """Encode multiple texts in a single ONNX inference call"""
        if not texts:
            return []
            
        # Tokenize all texts together
        encoded = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="np"
        )
        
        # Run ONNX inference on the entire batch
        inputs = {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64)
        }
        
        # Add token_type_ids only if present (models like all-MiniLM-L6-v2 don't have them)
        if "token_type_ids" in encoded and encoded["token_type_ids"] is not None:
            inputs["token_type_ids"] = encoded["token_type_ids"].astype(np.int64)
        
        outputs = self.session.run(None, inputs)
        embeddings = outputs[0]  # Shape: [batch_size, seq_len, hidden_size]
        
        # Mean pooling with attention mask for each item in batch
        attention_mask = encoded["attention_mask"]
        masked_embeddings = embeddings * attention_mask[:, :, np.newaxis]
        summed = np.sum(masked_embeddings, axis=1)
        counts = np.sum(attention_mask, axis=1, keepdims=True)
        mean_pooled = summed / counts
        
        # Normalize each embedding
        norms = np.linalg.norm(mean_pooled, axis=1, keepdims=True)
        normalized = mean_pooled / norms
        
        return normalized  # Shape: [batch_size, hidden_size]
    
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
        logger.info("ONNX ML Categorization Lambda invoked")
        logger.info(f"Event: {json.dumps(event, indent=2)}")
        
        # Initialize categorizer (cached across warm starts)
        if categorizer is None:
            categorizer = ONNXTransactionCategorizer()
        
        # Parse input - support both direct invocation and S3 file reading
        if 'body' in event:
            # API Gateway format
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            # Direct invocation format
            body = event
        
        # Check if we need to read from S3
        s3_bucket = body.get('s3_bucket')
        s3_key = body.get('s3_key')
        
        if s3_bucket and s3_key:
            # Read transactions from S3
            import boto3
            s3_client = boto3.client('s3')
            
            logger.info(f"Reading transactions from S3: s3://{s3_bucket}/{s3_key}")
            
            try:
                response = s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
                s3_data = json.loads(response['Body'].read().decode('utf-8'))
                transactions = s3_data.get('transactions', [])
                
                logger.info(f"Loaded {len(transactions)} transactions from S3")
                
                # Store metadata for output
                user_id = s3_data.get('userId', 'unknown')
                wallet_id = s3_data.get('walletId', 'unknown')
                source_file = s3_data.get('source_file', s3_key)
                
            except Exception as e:
                logger.error(f"Error reading from S3: {e}")
                return {
                    "statusCode": 500,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Credentials": True,
                    },
                    "body": json.dumps({
                        "error": "Failed to read transactions from S3",
                        "details": str(e)
                    })
                }
        else:
            # Direct invocation with transactions in body
            transactions = body.get('transactions', [])
            user_id = body.get('userId', 'unknown')
            wallet_id = body.get('walletId', 'unknown')
            source_file = 'direct_invocation'
        
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
        
        # If we read from S3, write categorized results back to S3 AND DynamoDB
        if s3_bucket and s3_key:
            try:
                s3_client = boto3.client('s3')
                
                # Create output data with metadata
                output_data = {
                    'userId': user_id,
                    'walletId': wallet_id,
                    'source_file': source_file,
                    'processing_timestamp': int(time.time() * 1000),
                    'categorized_transactions': []
                }
                
                # Merge categorization results with original transaction data
                for i, ml_result in enumerate(result['results']):
                    if i < len(transactions):
                        original_txn = transactions[i]
                        categorized_txn = {
                            'date': original_txn.get('date'),
                            'description': original_txn.get('description'),
                            'amount': original_txn.get('amount'),
                            'type': original_txn.get('type'),
                            'category': ml_result.get('category'),
                            'confidence': ml_result.get('confidence'),
                            'ml_method': ml_result.get('method')
                        }
                        output_data['categorized_transactions'].append(categorized_txn)
                
                output_data['summary'] = result['summary']
                
                # Write to S3 results folder
                output_key = s3_key.replace('parsed-transactions/', 'categorized-results/')
                output_key = output_key.replace('.json', '-categorized.json')
                
                s3_client.put_object(
                    Bucket=s3_bucket,
                    Key=output_key,
                    Body=json.dumps(output_data, indent=2),
                    ContentType='application/json'
                )
                
                logger.info(f"Wrote categorized results to S3: s3://{s3_bucket}/{output_key}")
                
                # ASYNC: Also store original ML results in DynamoDB for training/feedback
                try:
                    import uuid
                    from datetime import datetime
                    
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
                                'userId': user_id,
                                'feedbackId': feedback_id,
                                'timestamp': timestamp,
                                'feedbackType': 'ml_original',
                                'originalResult': {
                                    'description': original_txn.get('description'),
                                    'amount': original_txn.get('amount'),
                                    'category': ml_result.get('category'),
                                    'confidence': ml_result.get('confidence'),
                                    'method': ml_result.get('method'),
                                    'processing_time_ms': ml_result.get('processing_time_ms', 0)
                                },
                                'userCorrection': None,  # No user correction yet
                                'source': 'pdf_import',
                                'walletId': wallet_id,
                                'createdAt': timestamp
                            }
                            
                            # Store async (don't block main response)
                            table.put_item(Item=feedback_record)
                    
                    logger.info(f"Stored {len(result['results'])} ML results in DynamoDB table {ml_feedback_table}")
                    
                except Exception as ddb_error:
                    logger.error(f"Error storing ML results to DynamoDB: {ddb_error}")
                    # Don't fail the main response for DynamoDB errors
                
                # Return success with S3 location
                return {
                    "statusCode": 200,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Credentials": True,
                    },
                    "body": json.dumps({
                        "message": "Categorization complete",
                        "input_file": f"s3://{s3_bucket}/{s3_key}",
                        "output_file": f"s3://{s3_bucket}/{output_key}",
                        "summary": result['summary']
                    }, indent=2)
                }
                
            except Exception as e:
                logger.error(f"Error writing results to S3: {e}")
                # Fall through to return normal response
        
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