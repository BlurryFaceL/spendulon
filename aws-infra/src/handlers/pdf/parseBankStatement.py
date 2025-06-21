#!/usr/bin/env python3

import json
import logging  
import base64
import boto3
import os
import tempfile
import pdfplumber
import re
from datetime import datetime
from typing import Dict, List, Any
import time

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class ICICIStatementParser:
    """Parse ICICI Bank PDF statements"""
    
    def __init__(self):
        self.temp_files = []
    
    def parse_pdf_from_base64(self, pdf_base64_content, password=None):
        """Parse PDF from base64 encoded content with optional password"""
        try:
            # Decode base64 content
            pdf_bytes = base64.b64decode(pdf_base64_content)
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(pdf_bytes)
                temp_file_path = temp_file.name
                self.temp_files.append(temp_file_path)
            
            # Parse the PDF
            transactions = self._parse_icici_statement(temp_file_path, password)
            
            # Clean up
            self._cleanup_temp_files()
            
            return transactions
            
        except Exception as e:
            logger.error(f"Error parsing PDF from base64: {e}")
            self._cleanup_temp_files()
            raise
    
    def parse_pdf_from_s3(self, bucket, key, password=None):
        """Parse PDF from S3 bucket with optional password"""
        try:
            # Download PDF from S3
            s3_client = boto3.client('s3')
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                s3_client.download_fileobj(bucket, key, temp_file)
                temp_file_path = temp_file.name
                self.temp_files.append(temp_file_path)
            
            # Parse the PDF
            transactions = self._parse_icici_statement(temp_file_path, password)
            
            # Clean up
            self._cleanup_temp_files()
            
            return transactions
            
        except Exception as e:
            logger.error(f"Error parsing PDF from S3: {e}")
            self._cleanup_temp_files()
            raise
    
    def _parse_icici_statement(self, pdf_path, password=None):
        """Generic bank statement parser with automatic schema inference"""
        
        logger.info("🚀 _parse_icici_statement called - starting bank detection")
        
        # First, check what type of statement this is
        try:
            with pdfplumber.open(pdf_path, password=password) as pdf:
                text = ''
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + '\n'
        except Exception as e:
            # Check if this is a password-related error
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ['password', 'encrypted', 'decrypt', 'authentication']):
                logger.error(f"PDF password authentication failed: {e}")
                raise Exception("PDF is password protected. Please provide the correct password.")
            else:
                logger.error(f"❌ Failed to extract text for statement detection: {e}")
                logger.error(f"❌ Text extraction failed - will fall back to table extraction only")
                text = ''
        
        logger.info(f"✅ Text extraction complete. Text length: {len(text)} chars")
        logger.info(f"✅ Text sample (first 100 chars): {repr(text[:100])}")
        
        # Check for different bank credit card formats with more precise detection
        # Look for bank names in the first few lines (header area) to avoid false positives
        first_500_chars = text[:500].lower()
        first_1000_chars = text[:1000].lower()
        
        logger.info(f"🔍 Statement detection - first 500 chars: {repr(first_500_chars[:200])}")
        logger.info(f"🔍 Looking for ICICI patterns in first 1000 chars")
        logger.info(f"🔍 Does text contain 'icici'? {'icici' in text.lower()}")
        logger.info(f"🔍 Does first_500_chars contain 'icici'? {'icici' in first_500_chars}")
        logger.info(f"🔍 Full text length: {len(text)} chars")
        
        # SBI Credit Card - check first (most specific patterns)
        if any(pattern in first_500_chars for pattern in ['sbi card', 'sbi credit card', 'state bank of india']) and \
           any(keyword in text.lower() for keyword in ['credit card', 'statement']):
            logger.info("Detected SBI Credit Card statement, using specialized text parsing")
            lines = text.split('\n')
            return self._parse_sbi_credit_card_text(lines)
        
        # HDFC Credit Card - check header area, not entire document
        elif any(pattern in first_500_chars for pattern in ['hdfc bank', 'hdfc credit card', 'hdfc card']) and \
             any(keyword in text.lower() for keyword in ['credit card', 'statement']):
            logger.info("Detected HDFC Credit Card statement, using specialized text parsing")
            lines = text.split('\n')
            return self._parse_hdfc_credit_card_text(lines)
        
        # IndusInd Credit Card
        elif any(pattern in first_500_chars for pattern in ['indusind', 'indusind bank']) and \
             any(keyword in text.lower() for keyword in ['credit card', 'statement']):
            logger.info("Detected IndusInd Credit Card statement, using specialized text parsing")
            lines = text.split('\n')
            return self._parse_indusind_credit_card_text(lines)
        
        # For ICICI credit cards, combine table and text parsing (enhanced detection)
        elif ('icici' in text.lower()):
            logger.info(f"🔍 Found ICICI in text, checking credit card patterns...")
            logger.info(f"🔍 Text contains credit: {'credit' in text.lower()}")
            logger.info(f"🔍 Text contains card: {'card' in text.lower()}")
            logger.info(f"🔍 Text contains statement: {'statement' in text.lower()}")
            
            # Very broad ICICI detection since table parsing is failing
            if True:  # Force ICICI processing for any ICICI document
                logger.info("🔍 Detected ICICI Credit Card - using enhanced parsing approach")
                logger.info(f"🔍 ICICI detection matched - first 200 chars: {repr(first_1000_chars[:200])}")
                
                # Force text parsing for ICICI CC (more reliable than table extraction)
                logger.info("🚀 Starting text-based parsing for ICICI CC")
                lines = text.split('\n')
                text_transactions = self._parse_icici_credit_card_text(lines)
                
                # Also try table-based extraction
                logger.info("🚀 Starting table-based parsing for ICICI CC")
                table_transactions = self._parse_with_table_extraction(pdf_path, password)
                
                # Combine transactions from both methods
                all_transactions = []
                
                # Add text transactions first (usually more comprehensive)
                if text_transactions:
                    all_transactions.extend(text_transactions)
                    logger.info(f"✅ Text extraction found {len(text_transactions)} transactions")
                
                # Add table transactions (avoid duplicates)
                if table_transactions:
                    existing_signatures = set()
                    for txn in all_transactions:
                        sig = f"{txn['date']}|{txn['amount']}|{txn['description'][:20]}"
                        existing_signatures.add(sig)
                
                    added_from_table = 0
                    for txn in table_transactions:
                        sig = f"{txn['date']}|{txn['amount']}|{txn['description'][:20]}"
                        if sig not in existing_signatures:
                            all_transactions.append(txn)
                            existing_signatures.add(sig)
                            added_from_table += 1
                        else:
                            logger.info(f"Skipping duplicate from table: {txn['date']} - {txn['description'][:30]}")
                    
                    logger.info(f"✅ Table extraction found {len(table_transactions)} transactions ({added_from_table} new, {len(table_transactions) - added_from_table} duplicates)")
                
                if all_transactions:
                    logger.info(f"🎉 Successfully parsed {len(all_transactions)} total ICICI CC transactions")
                    return all_transactions
                else:
                    logger.warning("❌ No transactions found with ICICI CC parsing - falling back to generic parsing")
        
        # For other formats, try table-based extraction first
        table_transactions = self._parse_with_table_extraction(pdf_path, password)
        if table_transactions:
            logger.info(f"Table extraction found {len(table_transactions)} transactions")
            return table_transactions
        
        # Fallback to generic text-based parsing for other formats
        return self._parse_with_schema_inference(pdf_path, password)
    
    def _parse_with_table_extraction(self, pdf_path, password=None):
        """Extract transactions using table detection with enhanced debugging"""
        all_transactions = []
        
        try:
            with pdfplumber.open(pdf_path, password=password) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    logger.info(f"Processing page {page_num}")
                    
                    # Try different table extraction strategies
                    tables = page.extract_tables()
                    logger.info(f"Found {len(tables)} tables on page {page_num}")
                    
                    # If no tables found, try with different settings
                    if not tables:
                        # Try with explicit table settings
                        tables = page.extract_tables(table_settings={
                            "vertical_strategy": "lines_strict",
                            "horizontal_strategy": "lines_strict"
                        })
                        logger.info(f"Retry with strict lines found {len(tables)} tables")
                    
                    if not tables:
                        # Try text-based table detection
                        text_lines = page.extract_text().split('\n')
                        potential_table = self._detect_text_table(text_lines, page_num)
                        if potential_table:
                            tables = [potential_table]
                            logger.info(f"Text-based detection found table with {len(potential_table)} rows")
                    
                    # Track header table and transaction tables separately for ICICI CC format
                    icici_cc_header = None
                    icici_cc_column_mapping = None
                    
                    for table_idx, table in enumerate(tables):
                        if not table or len(table) < 1:
                            logger.info(f"Skipping table {table_idx + 1}: insufficient rows ({len(table) if table else 0})")
                            continue
                        
                        logger.info(f"Table {table_idx + 1} structure: {len(table)} rows, {len(table[0]) if table[0] else 0} columns")
                        
                        # Check if this is an ICICI CC header table (1 row, 6 columns)
                        if len(table) == 1 and len(table[0]) == 6:
                            row = table[0]
                            row_text = [str(cell).lower().strip() if cell else '' for cell in row]
                            if 'date' in row_text[0] and 'serno' in row_text[1] and 'transaction details' in row_text[2]:
                                logger.info(f"✅ Found ICICI CC header table {table_idx + 1}: {row}")
                                icici_cc_header = row
                                icici_cc_column_mapping = self._infer_column_mapping(row)
                                logger.info(f"ICICI CC column mapping: {icici_cc_column_mapping}")
                                continue
                        
                        # Check if this is an ICICI CC transaction table (1 row, 6 columns with data)
                        if len(table) == 1 and len(table[0]) == 6:
                            row = table[0]
                            logger.info(f"🔍 Checking potential ICICI CC transaction row: {row}")
                            
                            # Check if this looks like transaction data (has date and amount)
                            if self._looks_like_icici_cc_transaction(row):
                                logger.info(f"✅ Found ICICI CC transaction table {table_idx + 1}: {row}")
                                try:
                                    transaction = self._parse_icici_cc_table_row(row, icici_cc_header)
                                    if transaction:
                                        all_transactions.append(transaction)
                                        logger.info(f"✅ Parsed ICICI CC transaction: {transaction['date']} - {transaction['amount']} - {transaction['description']}")
                                    else:
                                        logger.info(f"❌ Failed to parse ICICI CC transaction row")
                                except Exception as e:
                                    logger.error(f"❌ Failed to parse ICICI CC transaction: {e}", exc_info=True)
                                continue
                            else:
                                logger.info(f"❌ Row doesn't look like ICICI CC transaction: {row}")
                        
                        # Also check for potential ICICI CC rows without header context
                        elif len(table) == 1 and len(table[0]) == 6:
                            row = table[0]
                            logger.info(f"🔍 Checking potential ICICI CC transaction row (no header): {row}")
                            
                            if self._looks_like_icici_cc_transaction(row):
                                logger.info(f"✅ Found standalone ICICI CC transaction: {row}")
                                try:
                                    # Use default header for parsing
                                    default_header = ['Date', 'SerNo.', 'Transaction Details', 'Reward Points', 'Intl Amount', 'Amount']
                                    transaction = self._parse_icici_cc_table_row(row, default_header)
                                    if transaction:
                                        all_transactions.append(transaction)
                                        logger.info(f"✅ Parsed standalone ICICI CC transaction: {transaction['date']} - {transaction['amount']} - {transaction['description']}")
                                    else:
                                        logger.info(f"❌ Failed to parse standalone ICICI CC transaction row")
                                except Exception as e:
                                    logger.error(f"❌ Failed to parse standalone ICICI CC transaction: {e}", exc_info=True)
                                continue
                        
                        # Regular table processing for non-ICICI CC format
                        if len(table) < 2:
                            logger.info(f"Skipping table {table_idx + 1}: insufficient rows for regular processing")
                            continue
                        
                        # Find the actual header row (might not be first row)
                        header_row_idx, headers = self._find_header_row(table)
                        if header_row_idx == -1:
                            logger.info(f"No valid headers found in table {table_idx + 1}")
                            continue
                        
                        logger.info(f"Found headers at row {header_row_idx}: {headers}")
                        
                        # Map headers to our schema
                        column_mapping = self._infer_column_mapping(headers)
                        logger.info(f"Column mapping: {column_mapping}")
                        
                        if 'date_col' not in column_mapping and not self._has_date_pattern(table):
                            logger.info(f"No date column found, skipping table {table_idx + 1}")
                            continue
                        
                        # Parse transactions from table (starting after header row)
                        data_rows = table[header_row_idx + 1:]
                        logger.info(f"Processing {len(data_rows)} data rows")
                        
                        for row_idx, row in enumerate(data_rows, 1):
                            try:
                                logger.info(f"Processing row {row_idx}: {row}")
                                # Handle multi-line rows (like HDFC format)
                                transactions = self._parse_multiline_row(row, headers, column_mapping)
                                if transactions:
                                    for txn in transactions:
                                        all_transactions.append(txn)
                                    logger.info(f"✅ Parsed {len(transactions)} transactions from row {row_idx}")
                                else:
                                    logger.info(f"❌ Row {row_idx} returned None - failed validation")
                            except Exception as e:
                                logger.error(f"❌ Failed to parse row {row_idx}: {e}", exc_info=True)
                
                logger.info(f"Table extraction found {len(all_transactions)} transactions")
                
                # ICICI CC Fallback: If we found very few transactions but detected ICICI CC patterns,
                # also try text-based parsing as a fallback
                if len(all_transactions) <= 2:  # Very few transactions found
                    try:
                        # Get the full text to check if this might be ICICI CC
                        with pdfplumber.open(pdf_path, password=password) as pdf:
                            text = ''
                            for page in pdf.pages:
                                page_text = page.extract_text()
                                if page_text:
                                    text += page_text + '\n'
                        
                        # Check if this looks like ICICI CC but we missed it in table parsing
                        if 'icici' in text.lower() and any(keyword in text.lower() for keyword in ['credit', 'card', 'statement']):
                            logger.info(f"🔄 ICICI CC fallback: Only found {len(all_transactions)} transactions, trying text-based parsing")
                            lines = text.split('\n')
                            text_transactions = self._parse_icici_credit_card_text(lines)
                            
                            if text_transactions and len(text_transactions) > len(all_transactions):
                                logger.info(f"✅ Text-based fallback found {len(text_transactions)} transactions (vs {len(all_transactions)} from tables)")
                                return text_transactions
                            else:
                                logger.info(f"📝 Text-based fallback found {len(text_transactions) if text_transactions else 0} transactions (keeping table results)")
                    
                    except Exception as e:
                        logger.error(f"❌ ICICI CC fallback parsing failed: {e}")
                
                return all_transactions
                
        except Exception as e:
            logger.error(f"Table extraction failed: {e}", exc_info=True)
            return []
    
    def _infer_column_mapping(self, headers):
        """Intelligently map column headers to transaction fields"""
        mapping = {}
        
        # Date column patterns
        date_patterns = ['date', 'transaction date', 'txn date', 'value date', 'posting date']
        # Description patterns - enhanced for ICICI credit cards
        desc_patterns = ['description', 'particulars', 'narration', 'remarks', 'transaction remarks', 'details', 'transaction details']
        # Amount patterns - enhanced for ICICI credit cards
        amount_patterns = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'dr amount', 'cr amount', 'amount (in', 'intl amount']
        # Balance patterns
        balance_patterns = ['balance', 'running balance', 'closing balance', 'available balance']
        
        logger.info(f"Mapping headers: {headers}")
        
        for idx, header in enumerate(headers):
            header_lower = str(header).lower().strip()
            logger.info(f"Processing header {idx}: '{header_lower}'")
            
            # Date detection
            if any(pattern in header_lower for pattern in date_patterns):
                if 'date_col' not in mapping:  # Prefer first date column
                    mapping['date_col'] = idx
                    logger.info(f"Mapped date column to index {idx}")
            
            # Description detection - enhanced patterns
            elif any(pattern in header_lower for pattern in desc_patterns):
                mapping['desc_col'] = idx
                logger.info(f"Mapped description column to index {idx}")
            
            # Amount detection (handle debit/credit separately)
            elif any(pattern in header_lower for pattern in ['debit', 'withdrawal', 'dr']):
                mapping['debit_col'] = idx
                logger.info(f"Mapped debit column to index {idx}")
            elif any(pattern in header_lower for pattern in ['credit', 'deposit', 'cr']):
                mapping['credit_col'] = idx
                logger.info(f"Mapped credit column to index {idx}")
            elif 'amount' in header_lower and 'debit_col' not in mapping and 'credit_col' not in mapping:
                mapping['amount_col'] = idx
                logger.info(f"Mapped amount column to index {idx}")
            
            # Balance detection
            elif any(pattern in header_lower for pattern in balance_patterns):
                mapping['balance_col'] = idx
                logger.info(f"Mapped balance column to index {idx}")
        
        logger.info(f"Final column mapping: {mapping}")
        return mapping
    
    def _parse_multiline_row(self, row, headers, column_mapping):
        """Parse a row that may contain multiple transactions in newline-separated format (HDFC style)"""
        try:
            # Check if any cells contain newlines (indicating multiple transactions)
            has_multiline = any('\n' in str(cell) if cell else False for cell in row)
            
            if not has_multiline:
                # Single transaction row
                transaction = self._parse_table_row(row, headers, column_mapping)
                return [transaction] if transaction else []
            
            # For HDFC format, use dates/balances as the primary indicator of transaction count
            date_col = column_mapping.get('date_col')
            balance_col = column_mapping.get('balance_col')
            
            # Get transaction count from dates or balances
            transaction_count = 1
            if date_col is not None and row[date_col] and '\n' in str(row[date_col]):
                transaction_count = len(str(row[date_col]).split('\n'))
            elif balance_col is not None and row[balance_col] and '\n' in str(row[balance_col]):
                transaction_count = len(str(row[balance_col]).split('\n'))
            
            logger.info(f"Multi-line row detected with {transaction_count} transactions")
            
            # Split all cells into lines
            split_cells = {}
            for cell_idx, cell in enumerate(row):
                if cell and '\n' in str(cell):
                    split_cells[cell_idx] = [line.strip() for line in str(cell).split('\n')]
                else:
                    split_cells[cell_idx] = [str(cell) if cell else '']
            
            # For HDFC format, handle debit/credit distribution using balance changes
            debit_col = column_mapping.get('debit_col')
            credit_col = column_mapping.get('credit_col')
            
            # Get all individual amounts from both debit and credit columns
            all_amounts = []
            debit_amounts = []
            credit_amounts = []
            
            if debit_col is not None and row[debit_col]:
                debit_strs = [amt.strip() for amt in str(row[debit_col]).split('\n') if amt.strip()]
                for amt in debit_strs:
                    parsed = self._parse_single_amount(amt)
                    if parsed:
                        debit_amounts.append(-abs(parsed))
            
            if credit_col is not None and row[credit_col]:
                credit_strs = [amt.strip() for amt in str(row[credit_col]).split('\n') if amt.strip()]
                for amt in credit_strs:
                    parsed = self._parse_single_amount(amt)
                    if parsed:
                        credit_amounts.append(abs(parsed))
            
            # Generic approach: Use balance changes to determine the correct amount sequence
            # This is more robust than hard-coding patterns
            if balance_col is not None and row[balance_col]:
                balance_strs = [bal.strip() for bal in str(row[balance_col]).split('\n') if bal.strip()]
                balances = []
                for bal in balance_strs:
                    parsed = self._parse_single_amount(bal)
                    if parsed:
                        balances.append(parsed)
                
                logger.info(f"Found {len(balances)} balance values for amount calculation")
                
                # Calculate amounts from balance changes
                if len(balances) >= 2:
                    # For HDFC format with multiple transactions and balances:
                    # We need to include the first transaction amount from debit/credit data
                    # then calculate the remaining from balance changes
                    
                    # First transaction: use the first debit amount
                    if len(debit_amounts) > 0:
                        all_amounts.append(debit_amounts[0])  # First transaction amount
                    
                    # Then calculate subsequent changes from balance differences
                    for i in range(len(balances) - 1):
                        balance_change = balances[i+1] - balances[i]
                        all_amounts.append(balance_change)
                    
                    logger.info(f"Calculated amounts from balance changes: {all_amounts}")
                    
                    # Ensure we have the right number of transactions
                    if len(all_amounts) > transaction_count:
                        all_amounts = all_amounts[:transaction_count]
                    elif len(all_amounts) < transaction_count:
                        # Add remaining amounts from debit/credit data
                        remaining_debits = debit_amounts[1:]  # Skip first debit (already used)
                        remaining_credits = credit_amounts
                        all_amounts.extend(remaining_debits + remaining_credits)
                else:
                    # If we don't have enough balances, fall back to smart distribution
                    all_amounts = self._smart_amount_distribution(
                        debit_amounts, credit_amounts, row, column_mapping
                    )
            else:
                # No balance column, use smart distribution
                all_amounts = self._smart_amount_distribution(
                    debit_amounts, credit_amounts, row, column_mapping
                )
            
            # If we still don't have enough amounts, fall back to simple concatenation
            if len(all_amounts) < transaction_count:
                logger.warning(f"Smart distribution provided {len(all_amounts)} amounts for {transaction_count} transactions, falling back")
                all_amounts = debit_amounts + credit_amounts
            
            logger.info(f"Using {len(all_amounts)} amounts for {transaction_count} transactions")
            
            # Build transactions with proper description grouping
            transactions = []
            
            # Get description lines for intelligent grouping
            desc_col = column_mapping.get('desc_col')
            description_lines = []
            if desc_col is not None and row[desc_col]:
                desc_text = str(row[desc_col])
                if '\n' in desc_text:
                    description_lines = [line.strip() for line in desc_text.split('\n') if line.strip()]
            
            logger.info(f"All description lines: {description_lines}")
            
            # For HDFC format, group descriptions based on UPI patterns
            grouped_descriptions = self._group_hdfc_descriptions(description_lines, transaction_count)
            logger.info(f"Grouped descriptions: {grouped_descriptions}")
            
            for txn_idx in range(transaction_count):
                single_row = []
                for cell_idx, cell in enumerate(row):
                    lines = split_cells.get(cell_idx, [''])
                    if txn_idx < len(lines):
                        single_row.append(lines[txn_idx])
                    else:
                        single_row.append('')
                
                # Override description with grouped description
                if desc_col is not None and txn_idx < len(grouped_descriptions):
                    single_row[desc_col] = grouped_descriptions[txn_idx]
                
                # Override amount columns with correct amounts
                if txn_idx < len(all_amounts):
                    if debit_col is not None:
                        single_row[debit_col] = ''
                    if credit_col is not None:
                        single_row[credit_col] = ''
                    
                    amount = all_amounts[txn_idx]
                    if amount < 0:
                        if debit_col is not None:
                            single_row[debit_col] = str(abs(amount))
                    else:
                        if credit_col is not None:
                            single_row[credit_col] = str(amount)
                
                transaction = self._parse_table_row(single_row, headers, column_mapping)
                if transaction:
                    transactions.append(transaction)
            
            return transactions
            
        except Exception as e:
            logger.debug(f"Error parsing multiline row: {e}")
            return []
    
    def _parse_table_row(self, row, headers, column_mapping):
        """Parse a single table row into a transaction"""
        try:
            # Extract date
            date_str = row[column_mapping['date_col']] if 'date_col' in column_mapping else None
            if not date_str:
                return None
            
            # Parse date (handle multiple formats)
            date = self._parse_date_flexible(str(date_str))
            if not date:
                return None
            
            # Extract description (handle multi-line descriptions)
            description = ''
            if 'desc_col' in column_mapping:
                desc_cell = row[column_mapping['desc_col']] or ''
                if '\n' in str(desc_cell):
                    # Join multi-line descriptions with space
                    desc_lines = [line.strip() for line in str(desc_cell).split('\n') if line.strip()]
                    description = ' | '.join(desc_lines)
                else:
                    description = str(desc_cell)
            
            # Extract amount (handle debit/credit columns)
            amount = 0
            if 'debit_col' in column_mapping and 'credit_col' in column_mapping:
                debit = self._parse_amount(row[column_mapping['debit_col']])
                credit = self._parse_amount(row[column_mapping['credit_col']])
                if debit:
                    amount = -abs(debit)  # Debits are negative
                elif credit:
                    amount = abs(credit)  # Credits are positive
            elif 'amount_col' in column_mapping:
                amount_str = str(row[column_mapping['amount_col']]).strip()
                amount = self._parse_single_amount(amount_str)
                
                if amount is not None:
                    # For HDFC credit cards and other formats, check if amount already has sign from suffix
                    if 'Cr' in amount_str:
                        # Already handled by _parse_single_amount (positive)
                        pass
                    elif amount > 0:
                        # No suffix - need to determine sign from context
                        # Check if this looks like a statement summary item (should be filtered out)
                        if description and any(keyword in description.lower() for keyword in 
                                               ['minimum amount due', 'total dues', 'payment due', 'credit limit', 'available credit']):
                            # This is a summary item, skip it
                            return None
                        
                        # For regular transactions without Cr suffix, treat as expenses (negative)
                        # Exception: if description clearly indicates income
                        if any(word in description.lower() for word in ['credit', 'cashback', 'refund', 'reversal', 'transfer credit']):
                            amount = abs(amount)  # Keep positive for income
                        else:
                            amount = -abs(amount)  # Make negative for expenses
            
            # Extract balance
            balance = None
            if 'balance_col' in column_mapping:
                balance = self._parse_amount(row[column_mapping['balance_col']])
            
            # Determine transaction type
            transaction_type = 'income' if amount > 0 else 'expense'
            
            return {
                'date': date,
                'description': description.strip(),
                'amount': amount,
                'balance': balance,
                'type': transaction_type,
                'mode': None,  # Can be inferred later from description
                'details': description.strip(),
                'raw_line': ' | '.join(str(cell) for cell in row if cell)
            }
            
        except Exception as e:
            logger.debug(f"Error parsing row: {e}")
            return None
    
    def _parse_date_flexible(self, date_str):
        """Parse date from various formats"""
        if not date_str:
            return None
            
        # Handle multi-line dates (HDFC format: '01/04/25\n01/04/25\n01/04/25\n02/04/25\n21/04/25')
        date_str = str(date_str).strip()
        if '\n' in date_str:
            # Take the first valid date from multi-line dates
            lines = date_str.split('\n')
            for line in lines:
                line = line.strip()
                if line and len(line) >= 8:  # At least DD/MM/YY format
                    parsed_date = self._parse_single_date(line)
                    if parsed_date:
                        return parsed_date
        else:
            return self._parse_single_date(date_str)
        
        return None
    
    def _parse_single_date(self, date_str):
        """Parse a single date string"""
        date_formats = [
            '%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%Y/%m/%d',
            '%d-%m-%y', '%d/%m/%y', '%d %b %Y', '%d %B %Y',
            '%d-%b-%Y', '%d-%b-%y', '%d/%b/%Y', '%d/%b/%y',
            '%d %b %y', '%d %B %y'  # Added credit card formats like "20 Apr 25"
        ]
        
        for fmt in date_formats:
            try:
                parsed = datetime.strptime(date_str.strip(), fmt)
                return parsed.strftime('%d-%m-%Y')  # Standardize format
            except:
                continue
        
        return None
    
    def _parse_amount(self, amount_str):
        """Parse amount from string, handling commas and decimals"""
        if not amount_str:
            return None
        
        # Handle multi-line amounts (similar to dates)
        amount_str = str(amount_str).strip()
        if '\n' in amount_str:
            # Try each line to find a valid amount
            lines = amount_str.split('\n')
            for line in lines:
                line = line.strip()
                if line:
                    parsed_amount = self._parse_single_amount(line)
                    if parsed_amount is not None:
                        return parsed_amount
        else:
            return self._parse_single_amount(amount_str)
        
        return None
    
    def _parse_single_amount(self, amount_str):
        """Parse a single amount string"""
        try:
            # Remove currency symbols and spaces
            cleaned = str(amount_str).replace('₹', '').replace('Rs', '').replace('INR', '')
            cleaned = cleaned.replace(',', '').replace(' ', '').strip()
            
            # Handle empty or dash values
            if not cleaned or cleaned == '-' or cleaned == '0.0' or cleaned == '':
                return None
            
            # Handle credit card format with C/D/CR/DR suffixes (like "174.00 C", "130.00 D", "10,546.66 CR")
            is_credit = False
            is_debit = False
            if cleaned.endswith('CR') or cleaned.endswith('C') or cleaned.endswith('Cr'):
                is_credit = True
                cleaned = cleaned.rstrip('CR').rstrip('Cr').rstrip('C').strip()
            elif cleaned.endswith('DR') or cleaned.endswith('D') or cleaned.endswith('Dr'):
                is_debit = True
                cleaned = cleaned.rstrip('DR').rstrip('Dr').rstrip('D').strip()
            
            # Try to convert to float
            amount = float(cleaned)
            
            # Apply sign based on credit card notation
            if is_credit:
                return abs(amount)  # Credits are positive
            elif is_debit:
                return -abs(amount)  # Debits are negative
            else:
                # For amounts without suffix, we need context to determine sign
                # This will be handled by the calling function based on transaction type
                return amount  # Return as-is for regular amounts
                
        except (ValueError, TypeError):
            pass
        
        return None
    
    def _find_header_row(self, table):
        """Find the actual header row in a table (may not be first row)"""
        for idx, row in enumerate(table):
            if not row:
                continue
            
            # Convert to lowercase for analysis
            row_text = [str(cell).lower().strip() if cell else '' for cell in row]
            
            # Check if this looks like a header row
            header_indicators = [
                'date', 'transaction', 'particulars', 'description', 'amount', 
                'balance', 'debit', 'credit', 'withdrawal', 'deposit', 'remarks',
                'value date', 'txn date', 'cheque', 'no.', 's no', 'details',
                'serno', 'ser no', 'serial', 'reward', 'points', 'intl', 'international'
            ]
            
            # Check for ICICI credit card specific header pattern (exact match)
            # ICICI CC format: ['Date', 'SerNo.', 'Transaction Details', 'Reward\nPoints', 'Intl.#\namount', 'Amount (in`)']
            if len(row) == 6 and 'date' in row_text[0] and 'serno' in row_text[1] and 'transaction details' in row_text[2]:
                logger.info(f"✅ Found ICICI Credit Card header at row {idx}: {row_text}")
                return idx, row_text
            
            # Check for generic headers
            header_score = sum(1 for cell in row_text if any(indicator in cell for indicator in header_indicators))
            
            # Log header analysis for debugging
            if header_score > 0:
                logger.info(f"Row {idx} header analysis: cells={row_text}, score={header_score}")
            
            if header_score >= 2:  # At least 2 header-like cells
                return idx, row_text
        
        return -1, []
    
    def _detect_text_table(self, text_lines, page_num):
        """Detect table structure from text lines when pdfplumber fails"""
        table_rows = []
        
        # Look for the header line with multiple transaction-related keywords
        header_indicators = ['date', 'transaction', 'particulars', 'amount', 'balance', 'remarks']
        
        for i, line in enumerate(text_lines):
            line_lower = line.lower()
            
            # Check if this line contains multiple header indicators
            if sum(1 for indicator in header_indicators if indicator in line_lower) >= 3:
                logger.info(f"Found potential header at line {i}: {line}")
                
                # Try to parse this as a header
                # Split by common delimiters
                potential_headers = self._split_line_intelligently(line)
                if len(potential_headers) >= 4:  # Need at least 4 columns
                    table_rows.append(potential_headers)
                    
                    # Now look for data rows following this header
                    for j in range(i + 1, min(i + 50, len(text_lines))):  # Look ahead 50 lines max
                        data_line = text_lines[j].strip()
                        if not data_line or len(data_line) < 10:
                            continue
                        
                        # Check if this looks like a transaction row
                        if self._looks_like_transaction_row(data_line):
                            data_cells = self._split_line_intelligently(data_line)
                            if len(data_cells) >= len(potential_headers) - 2:  # Allow some variance
                                table_rows.append(data_cells)
                    
                    if len(table_rows) > 1:  # Header + at least 1 data row
                        logger.info(f"Text table detection found {len(table_rows)} rows")
                        return table_rows
        
        return None
    
    def _split_line_intelligently(self, line):
        """Split a line into cells using multiple strategies"""
        # Strategy 1: Split by multiple spaces (3+ spaces likely indicate column separation)
        if '   ' in line:
            parts = [part.strip() for part in line.split('   ') if part.strip()]
            if len(parts) >= 4:
                return parts
        
        # Strategy 2: Split by tabs
        if '\t' in line:
            parts = [part.strip() for part in line.split('\t') if part.strip()]
            if len(parts) >= 4:
                return parts
        
        # Strategy 3: Look for amount patterns and work backwards
        import re
        amount_pattern = r'\b\d{1,3}(?:,\d{3})*\.?\d{0,2}\b'
        amounts = list(re.finditer(amount_pattern, line))
        
        if len(amounts) >= 2:  # Likely has amount and balance
            # This is a more complex parsing strategy
            # For now, return a simple split
            parts = line.split()
            return parts
        
        # Fallback: simple word split
        return line.split()
    
    def _looks_like_transaction_row(self, line):
        """Check if a line looks like a transaction row"""
        # Check for date patterns
        date_patterns = [
            r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',  # DD-MM-YYYY or DD/MM/YYYY
            r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b',    # YYYY-MM-DD
            r'\b\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}\b' # DD MMM YY/YYYY (credit card format)
        ]
        
        has_date = any(re.search(pattern, line) for pattern in date_patterns)
        
        # Check for amount patterns
        amount_pattern = r'\b\d{1,3}(?:,\d{3})*\.?\d{0,2}\b'
        has_amounts = len(re.findall(amount_pattern, line)) >= 1
        
        # Check for transaction keywords - updated to include ICICI specific codes
        transaction_keywords = [
            # UPI patterns
            'upi', 'upi-',
            # ICICI specific codes (lowercase for pattern matching)
            'bbps', 'bctt', 'bil', 'bpay', 'ccwd', 'dtax', 'eba', 'isec', 'idtx', 
            'imps', 'inf', 'inft', 'lccbrn', 'lnpy', 'mmt', 'netg', 'neft', 'onl', 
            'pac', 'pavc', 'payc', 'rchg', 'sgb', 'smo', 'top', 'uccbrn', 'vat', 
            'mat', 'nfs', 'vps', 'ips', 'rtgs',
            # Generic banking patterns
            'ach', 'banking', 'transfer', 'payment', 'corp', 'bank', 'ofi', 'coll', 
            'salary', 'cms', 'ecs', 'nach', 'mandate', 'reversal', 'refund', 'interest',
            'charges', 'tax', 'tds', 'gst', 'dividend', 'bonus', 'commission', 'credit', 'debit'
        ]
        has_keywords = any(keyword in line.lower() for keyword in transaction_keywords)
        
        return has_date and (has_amounts or has_keywords)
    
    def _has_date_pattern(self, table):
        """Check if table has date patterns in any column"""
        date_patterns = [
            r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',
            r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b',
            r'\b\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}\b'  # DD MMM YY/YYYY (credit card format)
        ]
        
        for row in table[1:6]:  # Check first few data rows
            for cell in row:
                if cell and any(re.search(pattern, str(cell)) for pattern in date_patterns):
                    return True
        return False
    
    def _looks_like_icici_cc_transaction(self, row):
        """Check if a row looks like an ICICI credit card transaction"""
        if not row or len(row) != 6:
            return False
        
        # Check if first column looks like a date (DD/MM/YYYY format)
        date_cell = str(row[0]).strip()
        if not re.match(r'\d{2}/\d{2}/\d{4}', date_cell):
            return False
        
        # Check if last column looks like an amount (with or without CR/DR suffix)
        amount_cell = str(row[5]).strip()
        # More flexible pattern to catch all amount formats
        if not re.search(r'[\d,]+\.?\d*(\s*(CR|DR))?$', amount_cell) and not re.search(r'^\d+[\d,]*\.?\d*$', amount_cell):
            return False
        
        # Check if transaction details column has meaningful content
        details_cell = str(row[2]).strip()
        if len(details_cell) < 2:  # Very low threshold
            return False
        
        # Serial number should be mostly numeric (allow some flexibility)
        serial_cell = str(row[1]).strip()
        if not re.match(r'^\d+', serial_cell):  # Starts with digits
            return False
        
        logger.info(f"✅ Row looks like ICICI CC transaction: {row}")
        return True
    
    def _parse_icici_cc_table_row(self, row, header):
        """Parse ICICI credit card table row specifically"""
        try:
            # ICICI CC table format: ['Date', 'SerNo.', 'Transaction Details', 'Reward\nPoints', 'Intl.#\namount', 'Amount (in`)']
            # Data formats:
            # - ['02/05/2025', '11192250773', 'BBPS Payment received', '0', '', '10,546.66 CR']
            # - ['03/05/2025', '11192250774', 'SWIGGY BANGALORE', '0', '', '450.00']
            
            date_str = str(row[0]).strip()
            serial_no = str(row[1]).strip()
            description = str(row[2]).strip()
            reward_points = str(row[3]).strip()
            intl_amount = str(row[4]).strip()
            amount_str = str(row[5]).strip()
            
            logger.info(f"🔍 Parsing ICICI CC row: date={date_str}, serial={serial_no}, desc={description}, amount={amount_str}")
            
            # Parse date
            date = self._parse_date_flexible(date_str)
            if not date:
                logger.info(f"❌ Invalid date: {date_str}")
                return None
            
            # Parse amount with enhanced CR/DR handling
            amount = self._parse_single_amount(amount_str)
            if amount is None:
                logger.info(f"❌ Could not parse amount: {amount_str}")
                return None
            
            # Enhanced transaction type determination for ICICI CC
            description_upper = description.upper()
            
            # Check for explicit CR/DR suffixes first
            if 'CR' in amount_str.upper():
                amount = abs(amount)  # Credits are positive
                transaction_type = 'income'
                logger.info(f"✅ Credit transaction (CR suffix): {amount}")
            elif 'DR' in amount_str.upper():
                amount = -abs(amount)  # Debits are negative
                transaction_type = 'expense'
                logger.info(f"✅ Debit transaction (DR suffix): {amount}")
            else:
                # No suffix - determine from context
                if any(keyword in description_upper for keyword in [
                    'PAYMENT', 'BBPS', 'CREDIT', 'REFUND', 'REVERSAL', 'CASHBACK', 'REWARD'
                ]):
                    amount = abs(amount)
                    transaction_type = 'income'
                    logger.info(f"✅ Inferred credit transaction (keywords): {amount}")
                else:
                    # Default to expense for purchases/charges
                    amount = -abs(amount)
                    transaction_type = 'expense'
                    logger.info(f"✅ Inferred debit transaction (default): {amount}")
            
            transaction = {
                'date': date,
                'description': description,
                'amount': amount,
                'type': transaction_type,
                'mode': 'CREDIT_CARD',
                'details': f"SerNo: {serial_no} | {description}" + (f" | Reward Points: {reward_points}" if reward_points and reward_points != '0' else ''),
                'raw_line': ' | '.join(str(cell) for cell in row if cell)
            }
            
            logger.info(f"✅ Successfully parsed ICICI CC transaction: {transaction}")
            return transaction
            
        except Exception as e:
            logger.error(f"❌ Error parsing ICICI CC table row: {e}", exc_info=True)
            return None
    
    def _parse_with_schema_inference(self, pdf_path, password=None):
        """Fallback text-based parsing with intelligent pattern matching"""
        with pdfplumber.open(pdf_path, password=password) as pdf:
            text = ''
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + '\n'
        
        lines = text.split('\n')
        
        # Check if this is an IndusInd credit card statement (check this first as it's more specific)
        if 'indusind' in text.lower() and any(keyword in text.lower() for keyword in ['credit card', 'statement']):
            logger.info("Detected IndusInd Credit Card statement, using specialized text parsing")
            return self._parse_indusind_credit_card_text(lines)
        
        # Check if this is an HDFC credit card statement
        if 'hdfc' in text.lower() and any(keyword in text.lower() for keyword in ['credit card', 'statement']):
            logger.info("Detected HDFC Credit Card statement, using specialized text parsing")
            return self._parse_hdfc_credit_card_text(lines)
        
        # Check if this is an ICICI credit card statement
        if 'icici' in text.lower() and any(keyword in text.lower() for keyword in ['credit card', 'statement']):
            logger.info("Detected ICICI Credit Card statement, using specialized text parsing")
            return self._parse_icici_credit_card_text(lines)
        
        # Original text-based parsing logic for bank statements
        transactions = []
        previous_balance = None
        
        # Find transaction table section
        in_transaction_section = False
        
        # Enhanced transaction indicators for comprehensive parsing
        # Updated to include all ICICI bank statement legends and common banking patterns
        transaction_indicators = [
            # UPI patterns
            'UPI/', 'UPI-',
            # ICICI specific codes from bank statement legends
            'BBPS', 'BCTT', 'BIL/', 'BPAY', 'CCWD', 'DTAX', 'EBA/', 'ISEC', 'IDTX', 
            'IMPS/', 'INF/', 'INFT', 'LCCBRN', 'LNPY', 'MMT/', 'NETG', 'NEFT/', 'ONL/', 
            'PAC/', 'PAVC', 'PAYC', 'RCHG', 'SGB', 'SMO/', 'TOP/', 'UCCBRN', 'VAT/', 
            'MAT/', 'NFS/', 'VPS/', 'IPS/', 'RTGS/',
            # Generic banking patterns
            'ACH/', 'CORP/', 'BANK/', 'OFI/', 'COLL', 'SAL-', 'SALARY', 'CMS/', 
            'ECS/', 'NACH/', 'MANDATE/', 'REVERSAL', 'REFUND', 'INTEREST',
            'CHARGES', 'TAX', 'TDS', 'GST', 'DIVIDEND', 'BONUS', 'COMMISSION',
            # Additional common patterns
            'FD clos', 'ATM/', 'POS/', 'CREDIT', 'DEBIT'
        ]
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Start of transaction table - more flexible detection
            if ('DATE' in line and 'PARTICULARS' in line and 'BALANCE' in line) or \
               ('Date' in line and 'Description' in line) or \
               ('DATE' in line and 'DESCRIPTION' in line):
                in_transaction_section = True
                continue
            
            if not in_transaction_section:
                continue
            
            # Handle B/F (balance forward) and C/F (carry forward)
            if any(term in line for term in ['B/F', 'C/F', 'BALANCE B/F', 'BALANCE C/F']):
                balance_match = re.search(r'([\d,]+\.\d{2})$', line)
                if balance_match:
                    previous_balance = float(balance_match.group(1).replace(',', ''))
                continue
            
            # Skip credit card statement summary items
            credit_card_summary_terms = [
                'minimum amount due', 'minimum due', 'payment due', 'total amount due',
                'outstanding balance', 'current balance', 'previous balance',
                'credit limit', 'available credit', 'cash advance limit',
                'statement date', 'due date', 'payment due date',
                'total credits', 'total debits', 'finance charges',
                'late payment fee', 'overlimit fee', 'annual fee'
            ]
            line_lower = line.lower()
            if any(term in line_lower for term in credit_card_summary_terms):
                logger.info(f"Skipping credit card summary line: {line}")
                continue
            
            # Multiple transaction patterns to catch different formats
            transaction_patterns = [
                # Standard: DD-MM-YYYY [MODE] [DETAILS] [AMOUNT] BALANCE
                r'(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$',
                # Alternative: DD/MM/YYYY format
                r'(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$',
                # Credit card format: DD MMM YY with C/D/CR/DR suffix
                r'(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+(.+?)\s+([\d,]+\.\d{2}\s*(?:CR|DR|C|D)?)$',
                # With explicit debit/credit columns
                r'(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$',
                # Simplified pattern for edge cases
                r'(\d{2}[-/]\d{2}[-/]\d{4})\s+(.+)\s+([\d,]+\.\d{2})$'
            ]
            
            transaction_match = None
            pattern_used = None
            
            for pattern in transaction_patterns:
                match = re.match(pattern, line)
                if match:
                    transaction_match = match
                    pattern_used = pattern
                    break
            
            # Also try to find lines that contain transaction indicators even without perfect regex match
            if not transaction_match:
                # Look for lines with transaction indicators and amounts
                if any(indicator in line for indicator in transaction_indicators):
                    # Try to extract date, description and amounts more flexibly
                    # Try multiple date patterns for flexible matching
                    date_patterns_flex = [
                        r'(\d{2}[-/]\d{2}[-/]\d{4})',           # DD-MM-YYYY
                        r'(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})'   # DD MMM YY
                    ]
                    date_match = None
                    for pattern in date_patterns_flex:
                        date_match = re.search(pattern, line)
                        if date_match:
                            break
                    # Updated amount pattern to include credit card C/D/CR/DR suffixes
                    amount_matches = re.findall(r'([\d,]+\.\d{2}\s*(?:CR|DR|C|D)?)', line)
                    
                    if date_match and len(amount_matches) >= 2:
                        # Create a synthetic match object
                        date = date_match.group(1)
                        # Find the part between date and amounts
                        start_pos = line.find(date) + len(date)
                        end_pos = line.rfind(amount_matches[-1])
                        middle_part = line[start_pos:end_pos].strip()
                        
                        # Remove all amount strings from middle part
                        for amount_str in amount_matches[:-1]:
                            middle_part = middle_part.replace(amount_str, '').strip()
                        
                        if len(amount_matches) >= 2:
                            transaction_match = type('Match', (), {
                                'group': lambda self, n: [None, date, middle_part, amount_matches[-2], amount_matches[-1]][n]
                            })()
                            pattern_used = 'flexible'
            
            if transaction_match:
                date = transaction_match.group(1)
                middle_part = transaction_match.group(2).strip()
                
                # Handle different pattern structures safely
                try:
                    if pattern_used == 'flexible' or len(transaction_match.group(0).split()) > 4:
                        # For flexible patterns or 5-group patterns
                        groups = transaction_match.group(0).split()
                        amount_candidates = [g for g in groups if re.match(r'[\d,]+\.\d{2}$', g)]
                        if len(amount_candidates) >= 2:
                            amount_1 = float(amount_candidates[-2].replace(',', ''))
                            balance = float(amount_candidates[-1].replace(',', ''))
                        else:
                            continue
                    else:
                        # Standard 4-group pattern - check if groups exist
                        if hasattr(transaction_match, 'groups') and len(transaction_match.groups()) >= 4:
                            amount_1 = float(transaction_match.group(3).replace(',', ''))
                            balance = float(transaction_match.group(4).replace(',', ''))
                        else:
                            # Try to extract amounts from the line directly
                            amounts = re.findall(r'([\d,]+\.\d{2})', transaction_match.group(0))
                            if len(amounts) >= 2:
                                amount_1 = float(amounts[-2].replace(',', ''))
                                balance = float(amounts[-1].replace(',', ''))
                            else:
                                continue
                except (IndexError, ValueError, AttributeError) as e:
                    logger.debug(f"Error parsing amounts from line: {e}")
                    continue
                
                # Collect ALL lines that belong to this transaction
                description_lines = []
                
                # Start with middle_part if it has transaction info
                if any(pattern in middle_part for pattern in transaction_indicators):
                    description_lines.append(middle_part)
                
                # Look backward to collect all lines until previous transaction or empty line
                collected_lines = []
                for j in range(1, 15):  # Increased range to catch more lines
                    if i - j >= 0:
                        prev_line = lines[i - j].strip()
                        if not prev_line or len(prev_line) <= 2:
                            continue
                        # Stop if we hit another transaction line with date
                        if re.match(r'\d{2}[-/]\d{2}[-/]\d{4}', prev_line):
                            break
                        # Add any line that looks like transaction info
                        if any(pattern in prev_line for pattern in transaction_indicators):
                            collected_lines.append(prev_line)
                        # Also catch continuation lines with meaningful content
                        elif len(prev_line) > 10 and not prev_line.replace(' ', '').replace(',', '').replace('.', '').isdigit():
                            # Check if it's likely a description continuation
                            if any(char.isalpha() for char in prev_line) and not prev_line.startswith('Page'):
                                collected_lines.append(prev_line)
                
                # Keep chronological order (first line first)
                description_lines.extend(collected_lines)
                
                # Combine all description lines in their original order
                if description_lines:
                    main_description = ' | '.join(description_lines)
                else:
                    main_description = middle_part
                
                # Enhanced mode parsing
                mode = None
                details = None
                
                if 'MOBILE BANKING' in middle_part:
                    mode = 'MOBILE BANKING'
                    details = middle_part.replace('MOBILE BANKING', '').strip()
                elif 'ATM' in middle_part.upper():
                    mode = 'ATM'
                    details = middle_part
                elif 'ONLINE' in middle_part.upper():
                    mode = 'ONLINE'
                    details = middle_part
                else:
                    # Check if middle_part starts with a mode
                    parts = middle_part.split(' ', 1)
                    if len(parts) > 1 and not parts[0].replace(',', '').replace('.', '').isdigit():
                        # Check if first part looks like a mode
                        if any(char in parts[0] for char in ['-', '/', ':']):
                            mode = parts[0]
                            details = parts[1]
                        else:
                            details = middle_part
                    else:
                        details = middle_part
                
                # Enhanced deposit/withdrawal detection
                if previous_balance is not None:
                    expected_balance_after_withdrawal = previous_balance - amount_1
                    expected_balance_after_deposit = previous_balance + amount_1
                    
                    # Check which one matches the actual balance (with tolerance)
                    if abs(balance - expected_balance_after_withdrawal) < abs(balance - expected_balance_after_deposit):
                        amount = -amount_1
                        transaction_type = 'expense'
                    else:
                        amount = amount_1
                        transaction_type = 'income'
                else:
                    # Enhanced fallback detection - updated with ICICI specific patterns
                    income_keywords = [
                        'fd clos', 'credit', 'salary', 'sal-', 'interest', 'dividend', 'bonus', 'refund', 'reversal',
                        # ICICI specific income patterns
                        'inf/', 'inft', 'rchg', 'sgb'  # Fund transfers, recharges can be income in some contexts
                    ]
                    expense_keywords = [
                        'payment', 'transfer', 'withdrawal', 'charges', 'tax', 'tds', 'gst',
                        # ICICI specific expense patterns
                        'bbps', 'bpay', 'ccwd', 'dtax', 'idtx', 'bil/', 'onl/', 'top/', 'pac/', 'pavc', 'payc',
                        'lccbrn', 'uccbrn', 'vat/', 'mat/', 'nfs/'  # Bill payments, taxes, fees
                    ]
                    
                    description_lower = main_description.lower()
                    if any(keyword in description_lower for keyword in income_keywords):
                        amount = amount_1
                        transaction_type = 'income'
                    elif any(keyword in description_lower for keyword in expense_keywords):
                        amount = -amount_1
                        transaction_type = 'expense'
                    else:
                        # Default to expense for safety
                        amount = -amount_1
                        transaction_type = 'expense'
                
                transaction = {
                    'date': date,
                    'mode': mode,
                    'description': main_description or details or middle_part,
                    'details': details or middle_part,
                    'amount': amount,
                    'balance': balance,
                    'type': transaction_type,
                    'raw_line': line,
                    'pattern_used': pattern_used or 'standard'
                }
                
                transactions.append(transaction)
                previous_balance = balance
        
        return transactions
    
    def _extract_meaningful_description(self, transaction):
        """Extract meaningful description for ML categorization"""
        description = transaction.get('description', '')
        
        # Clean up HDFC credit card descriptions with timestamps and locations
        description = self._clean_hdfc_cc_description(description)
        
        # If description contains multiple parts separated by |, use the most meaningful one
        if ' | ' in description:
            parts = description.split(' | ')
            # Prefer parts with 'Payment', then longer descriptions
            for part in sorted(parts, key=lambda x: (len(x), 'Payment' in x), reverse=True):
                if 'UPI/' in part and 'Payment' in part:
                    return part
                elif any(keyword in part for keyword in ['MMT/', 'ACH/', 'SAL', 'FD clos']):
                    return part
            # Return the longest/most meaningful part
            return parts[0]
        
        return description
    
    def _clean_hdfc_cc_description(self, description):
        """Clean HDFC credit card descriptions by removing timestamps and locations"""
        if not description:
            return description
        
        # HDFC CC patterns to clean:
        # "09:43:59 AVENUEECOMMERCELIMITED Mumbai" -> "AVENUEECOMMERCELIMITED"
        # "22:38:58 MyntraDesignsPvtLtd BANGALORE 70" -> "MyntraDesignsPvtLtd"
        # "23:35:11 MYNTRADESIGNS GURGOAN 31" -> "MYNTRADESIGNS"
        
        import re
        
        # Pattern 1: Remove timestamp at the beginning (HH:MM:SS)
        # Remove timestamp pattern like "09:43:59 " or "22:38:58 "
        description = re.sub(r'^\d{2}:\d{2}:\d{2}\s+', '', description)
        
        # Pattern 2: Remove location and numbers at the end
        # Remove patterns like " Mumbai", " BANGALORE 70", " GURGOAN 31"
        # This removes city names followed by optional numbers/codes
        city_patterns = [
            r'\s+Mumbai\s*\d*\s*$',
            r'\s+MUMBAI\s*\d*\s*$', 
            r'\s+Delhi\s*\d*\s*$',
            r'\s+DELHI\s*\d*\s*$',
            r'\s+Bangalore\s*\d*\s*$',
            r'\s+BANGALORE\s*\d*\s*$',
            r'\s+Bengaluru\s*\d*\s*$',
            r'\s+BENGALURU\s*\d*\s*$',
            r'\s+Chennai\s*\d*\s*$',
            r'\s+CHENNAI\s*\d*\s*$',
            r'\s+Hyderabad\s*\d*\s*$',
            r'\s+HYDERABAD\s*\d*\s*$',
            r'\s+Pune\s*\d*\s*$',
            r'\s+PUNE\s*\d*\s*$',
            r'\s+Kolkata\s*\d*\s*$',
            r'\s+KOLKATA\s*\d*\s*$',
            r'\s+Ahmedabad\s*\d*\s*$',
            r'\s+AHMEDABAD\s*\d*\s*$',
            r'\s+Jaipur\s*\d*\s*$',
            r'\s+JAIPUR\s*\d*\s*$',
            r'\s+Lucknow\s*\d*\s*$',
            r'\s+LUCKNOW\s*\d*\s*$',
            r'\s+Chandigarh\s*\d*\s*$',
            r'\s+CHANDIGARH\s*\d*\s*$',
            r'\s+Gurgaon\s*\d*\s*$',
            r'\s+GURGAON\s*\d*\s*$',
            r'\s+Gurgoan\s*\d*\s*$',  # Handle typo in your example
            r'\s+GURGOAN\s*\d*\s*$',
            r'\s+Noida\s*\d*\s*$',
            r'\s+NOIDA\s*\d*\s*$',
            r'\s+Faridabad\s*\d*\s*$',
            r'\s+FARIDABAD\s*\d*\s*$',
            # Generic pattern: Remove any city-like word followed by numbers at the end
            r'\s+[A-Z]{3,}\s*\d+\s*$',  # Match BANGALORE 70, GURGOAN 31, etc.
            r'\s+[A-Z][a-z]{2,}\s*\d*\s*$'  # Match Mumbai, Chennai, etc.
        ]
        
        for pattern in city_patterns:
            description = re.sub(pattern, '', description, flags=re.IGNORECASE)
        
        # Pattern 3: Remove standalone numbers at the end
        # Remove trailing numbers like " 70", " 31", " 123" that might be location codes
        description = re.sub(r'\s+\d{1,3}\s*$', '', description)
        
        # Pattern 4: Clean up common merchant name suffixes
        # Remove common business suffixes that don't help with categorization
        business_suffixes = [
            r'\s+LIMITED\s*$',
            r'\s+LTD\s*$', 
            r'\s+PVT\s*$',
            r'\s+PRIVATE\s*$',
            r'\s+INDIA\s*$',
            r'\s+IN\s*$'
        ]
        
        for suffix in business_suffixes:
            description = re.sub(suffix, '', description, flags=re.IGNORECASE)
        
        # Final cleanup: Remove extra spaces and return cleaned description
        cleaned = re.sub(r'\s+', ' ', description).strip()
        
        # Log the cleaning for debugging
        if cleaned != description.strip():
            logger.info(f"Cleaned HDFC CC description: '{description.strip()}' -> '{cleaned}'")
        
        return cleaned
    
    def _smart_amount_distribution(self, debit_amounts, credit_amounts, row, column_mapping):
        """Intelligently distribute debit/credit amounts based on transaction patterns"""
        desc_col = column_mapping.get('desc_col')
        
        # Get description lines to understand transaction order
        description_lines = []
        if desc_col is not None and row[desc_col]:
            desc_text = str(row[desc_col])
            if '\n' in desc_text:
                description_lines = [line.strip() for line in desc_text.split('\n') if line.strip()]
            else:
                description_lines = [desc_text.strip()]
        
        logger.info(f"Description lines for smart distribution: {description_lines}")
        
        # Strategy 1: If we have equal numbers of descriptions and amounts, use simple order
        total_amounts = len(debit_amounts) + len(credit_amounts)
        if len(description_lines) == total_amounts:
            logger.info(f"Simple mapping: {len(description_lines)} descriptions = {total_amounts} amounts")
            # Simple sequential mapping
            all_amounts = []
            debit_idx = 0
            credit_idx = 0
            
            for i, desc in enumerate(description_lines):
                # Check if this description suggests credit/income
                if any(keyword in desc.upper() for keyword in ['REV-', 'CREDIT', 'DEPOSIT', 'REFUND', 'INTEREST']):
                    if credit_idx < len(credit_amounts):
                        all_amounts.append(credit_amounts[credit_idx])
                        credit_idx += 1
                    elif debit_idx < len(debit_amounts):  # Fallback to debit
                        all_amounts.append(debit_amounts[debit_idx])
                        debit_idx += 1
                else:
                    # Default to debit
                    if debit_idx < len(debit_amounts):
                        all_amounts.append(debit_amounts[debit_idx])
                        debit_idx += 1
                    elif credit_idx < len(credit_amounts):  # Fallback to credit
                        all_amounts.append(credit_amounts[credit_idx])
                        credit_idx += 1
            
            return all_amounts
        
        # Strategy 2: If descriptions don't match, use pattern recognition
        logger.info(f"Complex mapping: {len(description_lines)} descriptions, {total_amounts} amounts")
        
        # For cases where we have more descriptions than amounts or vice versa
        # Use a heuristic approach based on common banking patterns
        if len(credit_amounts) == 1 and len(debit_amounts) >= 2:
            # Common pattern: multiple debits with one credit
            # Try to find where the credit logically fits based on description patterns
            credit_position = 0
            
            # Look for reversal or credit indicators in descriptions
            for i, desc in enumerate(description_lines[:len(debit_amounts) + 1]):
                if any(keyword in desc.upper() for keyword in ['REV-', 'REVERSAL', 'REFUND']):
                    credit_position = i
                    break
            
            # If no clear indicator, place credit in the middle
            if credit_position == 0:
                credit_position = len(debit_amounts) // 2
            
            logger.info(f"Placing credit at position {credit_position}")
            
            # Build sequence with credit at determined position
            all_amounts = []
            debit_idx = 0
            for i in range(len(debit_amounts) + len(credit_amounts)):
                if i == credit_position and len(credit_amounts) > 0:
                    all_amounts.append(credit_amounts[0])
                else:
                    if debit_idx < len(debit_amounts):
                        all_amounts.append(debit_amounts[debit_idx])
                        debit_idx += 1
            
            return all_amounts
        
        # Fallback: simple concatenation
        logger.info(f"Fallback: simple concatenation")
        return debit_amounts + credit_amounts
    
    def _group_hdfc_descriptions(self, description_lines, transaction_count):
        """Group HDFC description lines into proper transactions"""
        if not description_lines:
            return [''] * transaction_count
        
        # HDFC pattern analysis: look for transaction start indicators
        transaction_starts = ['UPI-', 'REV-', 'CC0006', 'NEFT-', 'IMPS-', 'ACH-']
        
        grouped = []
        current_group = []
        
        for line in description_lines:
            # Check if this line starts a new transaction
            is_transaction_start = any(line.startswith(start) for start in transaction_starts)
            
            if is_transaction_start and current_group:
                # Save previous group and start new one
                grouped.append(' | '.join(current_group))
                current_group = [line]
            else:
                # Add to current group
                current_group.append(line)
        
        # Add the last group
        if current_group:
            grouped.append(' | '.join(current_group))
        
        # Ensure we have exactly transaction_count descriptions
        while len(grouped) < transaction_count:
            grouped.append('')
        
        return grouped[:transaction_count]
    
    def _parse_icici_credit_card_text(self, lines):
        """Parse ICICI credit card statements from text lines"""
        transactions = []
        
        # ICICI Credit Card patterns:
        # Pattern 1: DD/MM/YYYY SerialNumber Description Amount CR/DR
        # Pattern 2: DD/MM/YYYY SerialNumber Description Amount (without CR/DR)
        # Pattern 3: DD/MM/YYYY SerialNumber Description RewardPoints IntlAmount Amount CR/DR
        
        logger.info(f"🔍 Starting ICICI CC text parsing with {len(lines)} lines")
        
        # First, let's see what lines contain dates
        date_lines = []
        for i, line in enumerate(lines):
            line = line.strip()
            if re.search(r'\d{2}/\d{2}/\d{4}', line):
                date_lines.append((i, line))
        
        logger.info(f"📅 Found {len(date_lines)} lines with dates")
        for i, (line_no, line) in enumerate(date_lines[:10]):  # Log first 10 date lines
            logger.info(f"Date line {i+1}: {line}")
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Skip obvious non-transaction lines
            if len(line) < 20 or not re.search(r'\d{2}/\d{2}/\d{4}', line):
                continue
            
            logger.info(f"🔍 Processing ICICI CC line {i}: {line}")
            
            # Multiple patterns to catch different ICICI CC transaction formats
            patterns = [
                # Pattern 1: Date SerNo Description Amount CR/DR
                r'(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)\s+([\d,]+\.?\d*)\s+(CR|DR)\s*$',
                # Pattern 2: Date SerNo Description RewardPoints IntlAmount Amount CR/DR
                r'(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)\s+(\d+)\s+([^\d\s]*)\s+([\d,]+\.?\d*)\s+(CR|DR)\s*$',
                # Pattern 3: Date SerNo Description Amount (no CR/DR suffix - most common for purchases)
                r'(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)\s+([\d,]+\.?\d*)\s*$',
                # Pattern 4: Date SerNo Description RewardPoints Amount (no CR/DR)
                r'(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)\s+(\d+)\s+([\d,]+\.?\d*)\s*$',
                # Pattern 5: More flexible pattern with optional spaces and suffixes
                r'(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)\s+([\d,]+\.?\d*)\s*(CR|DR)?\s*.*$',
                # Pattern 6: Very flexible - any line starting with date and serial number
                r'(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)[\s\d,]*?([\d,]+\.?\d*)\s*(CR|DR)?.*$'
            ]
            
            match = None
            pattern_used = None
            
            for idx, pattern in enumerate(patterns):
                match = re.search(pattern, line)
                if match:
                    pattern_used = idx + 1
                    logger.debug(f"✅ Matched pattern {pattern_used}: {match.groups()}")
                    break
            
            if match:
                try:
                    if pattern_used == 1:  # Date SerNo Description Amount CR/DR
                        date_str = match.group(1)
                        serial_no = match.group(2)
                        description = match.group(3).strip()
                        amount_str = match.group(4)
                        cr_dr_suffix = match.group(5)
                    elif pattern_used == 2:  # Date SerNo Description RewardPoints IntlAmount Amount CR/DR
                        date_str = match.group(1)
                        serial_no = match.group(2)
                        description = match.group(3).strip()
                        reward_points = match.group(4)
                        intl_amount = match.group(5)
                        amount_str = match.group(6)
                        cr_dr_suffix = match.group(7)
                    elif pattern_used == 3:  # Date SerNo Description Amount (no suffix)
                        date_str = match.group(1)
                        serial_no = match.group(2)
                        description = match.group(3).strip()
                        amount_str = match.group(4)
                        cr_dr_suffix = ''
                    elif pattern_used == 4:  # Date SerNo Description RewardPoints Amount (no CR/DR)
                        date_str = match.group(1)
                        serial_no = match.group(2)
                        description = match.group(3).strip()
                        reward_points = match.group(4)
                        amount_str = match.group(5)
                        cr_dr_suffix = ''
                    elif pattern_used == 5:  # Flexible pattern with optional suffixes
                        date_str = match.group(1)
                        serial_no = match.group(2)
                        description = match.group(3).strip()
                        amount_str = match.group(4)
                        cr_dr_suffix = match.group(5) or ''
                    elif pattern_used == 6:  # Very flexible pattern
                        date_str = match.group(1)
                        serial_no = match.group(2)
                        description = match.group(3).strip()
                        amount_str = match.group(4)
                        cr_dr_suffix = match.group(5) or ''
                    
                    # Parse the amount
                    amount = float(amount_str.replace(',', ''))
                    
                    # Determine transaction type and sign
                    if cr_dr_suffix == 'CR':
                        amount = abs(amount)  # Credits are positive
                        transaction_type = 'income'
                    elif cr_dr_suffix == 'DR':
                        amount = -abs(amount)  # Debits are negative
                        transaction_type = 'expense'
                    else:
                        # No suffix - use context to determine type
                        # Check description for payment/credit indicators
                        description_upper = description.upper()
                        if any(keyword in description_upper for keyword in [
                            'PAYMENT', 'BBPS', 'CREDIT', 'REFUND', 'REVERSAL', 'CASHBACK'
                        ]):
                            amount = abs(amount)
                            transaction_type = 'income'
                        else:
                            # Default to expense for purchases
                            amount = -abs(amount)
                            transaction_type = 'expense'
                    
                    # Parse date
                    date = self._parse_date_flexible(date_str)
                    
                    if date and amount != 0:  # Skip zero amounts
                        transaction = {
                            'date': date,
                            'description': description,
                            'amount': amount,
                            'type': transaction_type,
                            'mode': 'CREDIT_CARD',
                            'details': f"SerNo: {serial_no} | {description}",
                            'raw_line': line
                        }
                        
                        transactions.append(transaction)
                        logger.info(f"✅ Parsed ICICI CC transaction (Pattern {pattern_used}): {date} - {amount} - {description[:30]}...")
                    else:
                        logger.debug(f"Skipped transaction: invalid date or zero amount")
                        
                except (ValueError, IndexError) as e:
                    logger.debug(f"Could not parse amount from line: {line} - {e}")
                    continue
            else:
                logger.debug(f"❌ No pattern matched for line: {line[:50]}...")
        
        logger.info(f"ICICI Credit Card text parsing found {len(transactions)} transactions")
        return transactions
    
    def _parse_indusind_credit_card_text(self, lines):
        """Parse IndusInd credit card statements from text lines"""
        transactions = []
        
        # IndusInd Credit Card pattern: DD/MM/YYYY MERCHANT_DESCRIPTION AMOUNT DR/CR
        # Example: 04/05/2025 EAZYDINER PRIVATE LIMI GURGAON IN RESTAURANTS 41 2051.00 DR
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Look for lines that match IndusInd credit card transaction pattern
            # Pattern: Date Description Amount DR/CR
            indusind_cc_pattern = r'(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(DR|CR)'
            match = re.search(indusind_cc_pattern, line)
            
            if match:
                date_str = match.group(1)
                description = match.group(2).strip()
                amount_str = match.group(3)
                dr_cr_suffix = match.group(4)
                
                # Parse the amount
                try:
                    amount = float(amount_str.replace(',', ''))
                    
                    # Apply sign based on DR/CR
                    if dr_cr_suffix == 'CR':
                        amount = abs(amount)  # Credits are positive
                        transaction_type = 'income'
                    else:  # DR
                        amount = -abs(amount)  # Debits are negative
                        transaction_type = 'expense'
                    
                    # Parse date
                    date = self._parse_date_flexible(date_str)
                    
                    if date:
                        transaction = {
                            'date': date,
                            'description': description,
                            'amount': amount,
                            'type': transaction_type,
                            'mode': 'CREDIT_CARD',
                            'details': f"IndusInd CC | {description}",
                            'raw_line': line
                        }
                        
                        transactions.append(transaction)
                        logger.info(f"✅ Parsed IndusInd CC transaction: {date} - {amount} - {description}")
                    
                except ValueError as e:
                    logger.debug(f"Could not parse amount from line: {line} - {e}")
                    continue
        
        logger.info(f"IndusInd Credit Card text parsing found {len(transactions)} transactions")
        return transactions
    
    def _parse_hdfc_credit_card_text(self, lines):
        """Parse HDFC credit card statements from text lines"""
        transactions = []
        
        # HDFC Credit Card pattern: DD/MM/YYYY MERCHANT_DESCRIPTION AMOUNT [Cr]
        # Examples:
        # 17/05/2025 1% Swiggy Cashback (Ref# ST251380084000010969336) 15.72Cr
        # 19/05/2025 SWIGGY INSTAMART BANGALORE 825.00
        # 01/06/2025 TELE TRANSFER CREDIT (Ref# ST251530083000010428001) 13,334.00Cr
        
        # Statement summary items to ignore
        summary_keywords = [
            'minimum amount due', 'minimum due', 'payment due', 'total amount due',
            'outstanding balance', 'current balance', 'previous balance',
            'credit limit', 'available credit', 'cash advance limit',
            'statement date', 'due date', 'payment due date',
            'total credits', 'total debits', 'finance charges',
            'late payment fee', 'overlimit fee', 'annual fee',
            'In case you wish to update', 'please write a letter',
            'For queries', 'Contact', 'Customer Care'
        ]
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Skip lines that are clearly statement summary or policy text
            line_lower = line.lower()
            if any(keyword in line_lower for keyword in summary_keywords):
                logger.debug(f"Skipping summary/policy line: {line[:50]}...")
                continue
            
            # Look for lines that match HDFC credit card transaction pattern
            # Pattern: Date Description Amount[Cr]
            hdfc_cc_pattern = r'(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})(Cr)?'
            match = re.search(hdfc_cc_pattern, line)
            
            if match:
                date_str = match.group(1)
                description = match.group(2).strip()
                amount_str = match.group(3)
                cr_suffix = match.group(4)  # 'Cr' or None
                
                # Additional validation: ensure description looks like a real transaction
                # Skip if description is too short or looks like summary text
                if len(description) < 5:
                    logger.debug(f"Skipping short description: {line}")
                    continue
                
                # Skip if description contains summary keywords
                if any(keyword in description.lower() for keyword in summary_keywords):
                    logger.debug(f"Skipping summary description: {description}")
                    continue
                
                # Parse the amount
                try:
                    amount = float(amount_str.replace(',', ''))
                    
                    # Apply sign based on Cr suffix
                    if cr_suffix == 'Cr':
                        amount = abs(amount)  # Credits are positive (cashback, payments, refunds)
                        transaction_type = 'income'
                    else:
                        amount = -abs(amount)  # Regular purchases are negative
                        transaction_type = 'expense'
                    
                    # Parse date
                    date = self._parse_date_flexible(date_str)
                    
                    if date:
                        transaction = {
                            'date': date,
                            'description': description,
                            'amount': amount,
                            'type': transaction_type,
                            'mode': 'CREDIT_CARD',
                            'details': f"HDFC CC | {description}",
                            'raw_line': line
                        }
                        
                        transactions.append(transaction)
                        logger.info(f"✅ Parsed HDFC CC transaction: {date} - {amount} - {description[:30]}...")
                    
                except ValueError as e:
                    logger.debug(f"Could not parse amount from line: {line} - {e}")
                    continue
        
        logger.info(f"HDFC Credit Card text parsing found {len(transactions)} transactions")
        return transactions
    
    def _parse_sbi_credit_card_text(self, lines):
        """Parse SBI credit card statements from text lines"""
        transactions = []
        
        # SBI Credit Card pattern: DD MMM YY MERCHANT_DESCRIPTION AMOUNT [C/D]
        # Example patterns observed:
        # 20 Apr 25  SWIGGY*ORDER  174.00 D
        # 22 Apr 25  PAYMENT RECEIVED  130.00 C
        
        # Statement summary items to ignore (be more specific to avoid filtering actual transactions)
        summary_keywords = [
            'minimum amount due', 'minimum due', 'payment due', 'total amount due',
            'outstanding balance', 'current balance', 'previous balance',
            'credit limit', 'available credit', 'cash advance limit',
            'statement date', 'due date', 'payment due date',
            'total credits', 'total debits', 'finance charges',
            'late payment fee', 'overlimit fee', 'annual fee',
            'reward points summary', 'cashback summary', 'offer details',
            'important information', 'terms and conditions', 't&c apply',
            'cashback will be posted', 'balance enquiry', 'finance charges'
        ]
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Skip lines that are clearly statement summary or policy text
            line_lower = line.lower()
            if any(keyword in line_lower for keyword in summary_keywords):
                logger.debug(f"Skipping summary/policy line: {line[:50]}...")
                continue
            
            # Look for lines that match SBI credit card transaction pattern
            # Pattern: DD MMM YY Description Amount [C/D]
            # First extract date, then find amount + C/D at the end, everything in between is description
            date_pattern = r'^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+'
            amount_pattern = r'\s+([0-9,]+\.?\d{0,2})\s*([CD])\s*$'
            
            date_match = re.match(date_pattern, line)
            amount_match = re.search(amount_pattern, line)
            
            if date_match and amount_match:
                date_str = date_match.group(1).strip()
                amount_str = amount_match.group(1).strip()
                cd_suffix = amount_match.group(2)  # 'C' or 'D'
                
                # Extract description as everything between date and amount
                date_end = date_match.end()
                amount_start = amount_match.start()
                description = line[date_end:amount_start].strip()
                
                # Additional validation: ensure description looks like a real transaction
                # Skip if description is too short or looks like summary text
                if len(description) < 3:
                    logger.debug(f"Skipping short description: {line}")
                    continue
                
                # Skip if description contains summary keywords
                if any(keyword in description.lower() for keyword in summary_keywords):
                    logger.debug(f"Skipping summary description: {description}")
                    continue
                
                # Parse the amount
                try:
                    amount = float(amount_str.replace(',', ''))
                    
                    # Apply sign based on C/D suffix
                    if cd_suffix == 'C':
                        amount = abs(amount)  # Credits are positive (payments, refunds, cashback)
                        transaction_type = 'income'
                    elif cd_suffix == 'D':
                        amount = -abs(amount)  # Debits are negative (purchases)
                        transaction_type = 'expense'
                    else:
                        # No suffix - determine from description context
                        if any(word in description.lower() for word in ['payment', 'credit', 'cashback', 'refund', 'reversal']):
                            amount = abs(amount)  # Keep positive for income
                            transaction_type = 'income'
                        else:
                            amount = -abs(amount)  # Make negative for expenses
                            transaction_type = 'expense'
                    
                    # Parse date
                    date = self._parse_date_flexible(date_str)
                    
                    if date:
                        transaction = {
                            'date': date,
                            'description': description,
                            'amount': amount,
                            'type': transaction_type,
                            'mode': 'CREDIT_CARD',
                            'details': f"SBI CC | {description}",
                            'raw_line': line
                        }
                        
                        transactions.append(transaction)
                        logger.info(f"✅ Parsed SBI CC transaction: {date} - {amount} - {description[:30]}...")
                    
                except ValueError as e:
                    logger.debug(f"Could not parse amount from line: {line} - {e}")
                    continue
        
        logger.info(f"SBI Credit Card text parsing found {len(transactions)} transactions")
        return transactions
    
    def _cleanup_temp_files(self):
        """Clean up temporary files"""
        for temp_file in self.temp_files:
            try:
                os.unlink(temp_file)
            except Exception as e:
                logger.warning(f"Could not delete temp file {temp_file}: {e}")
        self.temp_files = []

def lambda_handler(event, context):
    """Main Lambda handler for PDF parsing and ML categorization"""
    
    # CORS headers for spendulon.com
    cors_headers = {
        "Access-Control-Allow-Origin": "https://spendulon.com",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Credentials": "false"
    }
    
    # Handle OPTIONS preflight request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": ""
        }
    
    try:
        logger.info("PDF Parser Lambda invoked")
        logger.info(f"Event: {json.dumps(event, indent=2)}")
        
        # Parse input
        if 'body' in event:
            # API Gateway format
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            # Direct invocation format
            body = event
        
        pdf_content = body.get('pdf_content')
        s3_bucket = body.get('s3_bucket')
        s3_key = body.get('s3_key')
        categorize = body.get('categorize', True)  # Default to True
        password = body.get('password')  # Optional PDF password
        
        if not pdf_content and not (s3_bucket and s3_key):
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({
                    "error": "No PDF content provided",
                    "expected_format": {
                        "option1": {"pdf_content": "base64_encoded_pdf_content"},
                        "option2": {"s3_bucket": "bucket-name", "s3_key": "path/to/file.pdf"},
                        "categorize": True
                    }
                })
            }
        
        # Parse PDF
        parser = ICICIStatementParser()
        if s3_bucket and s3_key:
            transactions = parser.parse_pdf_from_s3(s3_bucket, s3_key, password)
        else:
            transactions = parser.parse_pdf_from_base64(pdf_content, password)
        
        logger.info(f"Parsed {len(transactions)} transactions from PDF")
        
        result = {
            "transactions": transactions,
            "summary": {
                "total_transactions": len(transactions),
                "total_debits": len([t for t in transactions if t['amount'] < 0]),
                "total_credits": len([t for t in transactions if t['amount'] > 0]),
                "total_debit_amount": sum([t['amount'] for t in transactions if t['amount'] < 0]),
                "total_credit_amount": sum([t['amount'] for t in transactions if t['amount'] > 0])
            }
        }
        
        # Send transactions to ML Lambda for categorization if requested
        if categorize and transactions:
            try:
                # Prepare data for ML Lambda processing (direct transaction passing)
                
                # Create a unique timestamp for tracking
                timestamp = int(time.time() * 1000)
                
                # Get userId from JWT token claims (secure and reliable)
                if 'requestContext' in event and 'authorizer' in event['requestContext']:
                    user_id = event['requestContext']['authorizer']['claims']['sub']
                    logger.info(f"✅ Successfully extracted userId from JWT token: {user_id}")
                else:
                    user_id = body.get('userId', 'unknown')  # Fallback for direct invocation
                    logger.warning(f"⚠️ No JWT token found, using userId from body: {user_id}")
                
                wallet_id = body.get('walletId', 'unknown')
                logger.info(f"📊 Processing PDF for userId: {user_id}, walletId: {wallet_id}") 
                
                # Prepare transactions for ML processing
                ml_input = {
                    'userId': user_id,
                    'walletId': wallet_id,
                    'timestamp': timestamp,
                    'source_file': s3_key if s3_key else 'uploaded_pdf',
                    'transactions': []
                }
                
                for txn in transactions:
                    # Extract meaningful description for ML categorization
                    ml_description = parser._extract_meaningful_description(txn)
                    
                    ml_input['transactions'].append({
                        'description': ml_description,
                        'amount': txn['amount'],
                        'date': txn['date'],
                        'type': txn['type']
                    })
                
                # Invoke ML Lambda for categorization (no S3 write needed - direct transaction passing)
                lambda_client = boto3.client('lambda')
                ml_payload = {
                    'transactions': ml_input['transactions'],
                    'userId': user_id,
                    'walletId': wallet_id
                }
                
                try:
                    ml_function_name = os.environ.get('ML_CATEGORIZER_FUNCTION', 'CategorizeTransactionsFunction')
                    ml_response = lambda_client.invoke(
                        FunctionName=ml_function_name,
                        InvocationType='RequestResponse',  # Synchronous call
                        Payload=json.dumps(ml_payload)
                    )
                    
                    ml_result = json.loads(ml_response['Payload'].read())
                    logger.info(f"ML Lambda response: {ml_result}")
                    
                    if ml_response['StatusCode'] == 200:
                        result['ml_categorization'] = ml_result
                        
                        # Parse ML response with direct transaction results
                        if 'body' in ml_result:
                            ml_body = json.loads(ml_result['body']) if isinstance(ml_result['body'], str) else ml_result['body']
                            
                            # Get categorized transactions directly from ML response
                            if 'results' in ml_body:
                                categorized_results = ml_body['results']
                                
                                # Merge categories back into transactions
                                for i, txn in enumerate(result['transactions']):
                                    if i < len(categorized_results):
                                        cat_result = categorized_results[i]
                                        txn['category'] = cat_result.get('category', 'Other')
                                        txn['category_confidence'] = cat_result.get('confidence', 0.0)
                                        txn['ml_prediction'] = {
                                            'method': cat_result.get('method', 'unknown'),
                                            'processing_time_ms': cat_result.get('processing_time_ms', 0)
                                        }
                                
                                result['message'] = "Transactions parsed and categorized successfully"
                                logger.info(f"Successfully merged {len(categorized_results)} categorized transactions")
                            else:
                                logger.warning("No results found in ML response body")
                                result['message'] = "Transactions parsed, but no ML results found"
                        else:
                            # Handle direct result format (non-API Gateway response)
                            if 'results' in ml_result:
                                categorized_results = ml_result['results']
                                
                                # Merge categories back into transactions
                                for i, txn in enumerate(result['transactions']):
                                    if i < len(categorized_results):
                                        cat_result = categorized_results[i]
                                        txn['category'] = cat_result.get('category', 'Other')
                                        txn['category_confidence'] = cat_result.get('confidence', 0.0)
                                        txn['ml_prediction'] = {
                                            'method': cat_result.get('method', 'unknown'),
                                            'processing_time_ms': cat_result.get('processing_time_ms', 0)
                                        }
                                
                                result['message'] = "Transactions parsed and categorized successfully"
                                logger.info(f"Successfully merged {len(categorized_results)} categorized transactions")
                            else:
                                logger.warning("No results found in ML response")
                                result['message'] = "Transactions parsed, but no ML results found"
                    else:
                        result['categorization_error'] = ml_result
                        result['message'] = "Transactions parsed but categorization failed"
                        
                except Exception as ml_error:
                    logger.error(f"Error invoking ML Lambda: {ml_error}")
                    result['categorization_error'] = str(ml_error)
                    result['message'] = "Transactions parsed but ML categorization failed"
                
                # ML categorization completed (stored in DDB via ML lambda)
                    
            except Exception as e:
                logger.error(f"Error processing categorization: {e}")
                result['categorization_error'] = str(e)
        
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps(result, indent=2)
        }
        
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}", exc_info=True)
        
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({
                "error": "Internal server error",
                "details": str(e)
            })
        }

# Test function for local development
def test_local():
    """Test function with sample PDF"""
    
    # This would need a real PDF file for testing
    sample_pdf_path = '/Users/isaacabhishek/Downloads/Statement_2025MTH02_283537256-unlocked.pdf'
    
    if os.path.exists(sample_pdf_path):
        # Read PDF file and convert to base64
        with open(sample_pdf_path, 'rb') as f:
            pdf_bytes = f.read()
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        test_event = {
            "pdf_content": pdf_base64,
            "categorize": True
        }
        
        result = lambda_handler(test_event, None)
        print("Test Result:")
        print(json.dumps(result, indent=2))
    else:
        print(f"Test PDF file not found: {sample_pdf_path}")

if __name__ == "__main__":
    test_local()