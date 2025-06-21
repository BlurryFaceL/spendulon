import { parseISO, parse, isValid } from 'date-fns';

class CsvImportService {
  // Common date formats to try
  dateFormats = [
    'yyyy-MM-dd',
    'dd-MM-yyyy',
    'MM-dd-yyyy',
    'yyyy/MM/dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'yyyy-MM-dd\'T\'HH:mm:ssXXX',
    'yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX',
    'dd MMM yyyy',
    'MMM dd, yyyy',
    'MMMM dd, yyyy'
  ];

  // Parse CSV content into array of objects
  parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must contain headers and at least one data row');
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return { headers, data };
  }

  // Parse a single CSV line handling quoted values
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Don't forget the last field
    result.push(current.trim());
    
    return result;
  }

  // Analyze CSV data to suggest column mappings
  analyzeCsvData(headers, data) {
    const analysis = {
      suggestedMappings: {},
      columnStats: {}
    };

    // Analyze each column
    headers.forEach(header => {
      const allColumnData = data.map(row => row[header] || '');
      const nonEmptyColumnData = allColumnData.filter(val => val.trim());
      
      analysis.columnStats[header] = {
        totalRows: allColumnData.length,
        nonEmptyRows: nonEmptyColumnData.length,
        uniqueValues: new Set(nonEmptyColumnData).size,
        sampleValues: nonEmptyColumnData.slice(0, 5),
        dataType: this.detectColumnType(allColumnData, nonEmptyColumnData)
      };

      // Suggest mappings based on header names and data
      const suggestion = this.suggestMapping(header, nonEmptyColumnData);
      if (suggestion) {
        analysis.suggestedMappings[header] = suggestion;
      }
    });

    return analysis;
  }

  // Detect the type of data in a column
  detectColumnType(allColumnData, nonEmptyColumnData) {
    // If all values are empty, it's still text (just empty text)
    if (nonEmptyColumnData.length === 0) return 'text';

    const sample = nonEmptyColumnData.slice(0, 10);
    
    // Check if all values are dates
    if (sample.every(val => this.isDate(val))) {
      return 'date';
    }
    
    // Check if all values are numbers
    if (sample.every(val => this.isNumeric(val))) {
      return 'number';
    }
    
    // Check if values look like currency
    if (sample.every(val => this.isCurrency(val))) {
      return 'currency';
    }
    
    return 'text';
  }

  // Check if a value is a date
  isDate(value) {
    if (!value) return false;
    
    // Try parsing with different formats
    for (const format of this.dateFormats) {
      try {
        const parsed = parse(value, format, new Date());
        if (isValid(parsed)) return true;
      } catch (e) {
        // Continue to next format
      }
    }
    
    // Try ISO parse
    try {
      const parsed = parseISO(value);
      return isValid(parsed);
    } catch (e) {
      return false;
    }
  }

  // Check if a value is numeric
  isNumeric(value) {
    if (!value) return false;
    // Remove currency symbols and commas
    const cleaned = value.toString().replace(/[₹$€£¥,]/g, '').trim();
    return !isNaN(cleaned) && !isNaN(parseFloat(cleaned));
  }

  // Check if a value looks like currency
  isCurrency(value) {
    if (!value) return false;
    const currencyPattern = /^[₹$€£¥]?\s*-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d{1,3}(,\d{3})*(\.\d{1,2})?\s*[₹$€£¥]?$/;
    return currencyPattern.test(value.toString().trim());
  }

  // Suggest mapping based on header name and data
  suggestMapping(header, columnData) {
    const headerLower = header.toLowerCase();
    
    // Date mappings
    if (headerLower.includes('date') || 
        headerLower.includes('time') || 
        headerLower.includes('when')) {
      return 'date';
    }
    
    // Amount mappings
    if (headerLower.includes('amount') || 
        headerLower.includes('value') || 
        headerLower.includes('sum') ||
        headerLower.includes('total') ||
        headerLower.includes('price')) {
      return 'amount';
    }
    
    // Description mappings
    if (headerLower.includes('description') || 
        headerLower.includes('desc') || 
        headerLower.includes('note') ||
        headerLower.includes('memo') ||
        headerLower.includes('detail') ||
        headerLower.includes('particular')) {
      return 'description';
    }
    
    // Category mappings
    if (headerLower.includes('category') || 
        headerLower.includes('cat') || 
        headerLower.includes('type') ||
        headerLower.includes('class')) {
      return 'category';
    }
    
    // Transaction type mappings
    if (headerLower.includes('type') || 
        headerLower.includes('direction') || 
        headerLower.includes('debit') ||
        headerLower.includes('credit')) {
      return 'type';
    }
    
    // Analyze data if header name doesn't give hints
    const dataType = this.detectColumnType(columnData, columnData.filter(val => val.trim()));
    if (dataType === 'date') {
      return 'date';
    }
    if (dataType === 'currency') {
      return 'amount';
    }
    
    return null;
  }

  // Parse date with multiple format attempts
  parseDate(dateString) {
    if (!dateString) return null;
    
    // Try each format
    for (const format of this.dateFormats) {
      try {
        const parsed = parse(dateString, format, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Continue to next format
      }
    }
    
    // Try ISO parse as last resort
    try {
      const parsed = parseISO(dateString);
      if (isValid(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Failed to parse
    }
    
    return null;
  }

  // Parse amount from various formats
  parseAmount(amountString) {
    if (!amountString) return 0;
    
    // Convert to string and remove currency symbols and spaces
    const cleaned = amountString
      .toString()
      .replace(/[₹$€£¥\s]/g, '')
      .replace(/,/g, ''); // Remove thousand separators
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  // Detect transaction type from various indicators
  detectTransactionType(row, mappings) {
    // Check if there's a type column mapped
    if (mappings.type) {
      const typeValue = row[mappings.type]?.toLowerCase() || '';
      
      // Transfer In patterns (check FIRST - most specific)
      if (typeValue.includes('incoming transfer') ||
          typeValue.includes('transfer in') ||
          typeValue.includes('received transfer') ||
          typeValue.includes('inward transfer') ||
          typeValue.includes('transfer from') ||
          (typeValue.includes('transfer') && (typeValue.includes('in') || typeValue.includes('incoming') || typeValue.includes('received')))) {
        return 'transfer_in';
      }
      
      // Transfer Out patterns (check SECOND - specific)
      if (typeValue.includes('outgoing transfer') ||
          typeValue.includes('transfer out') ||
          typeValue.includes('sent transfer') ||
          typeValue.includes('outward transfer') ||
          typeValue.includes('transfer to') ||
          (typeValue.includes('transfer') && (typeValue.includes('out') || typeValue.includes('outgoing') || typeValue.includes('sent')))) {
        return 'transfer_out';
      }
      
      // Generic transfer (check THIRD - fallback for transfers)
      if (typeValue.includes('transfer')) {
        return 'transfer_out';
      }
      
      // Income patterns (check FOURTH - after transfers)
      if (typeValue.includes('income') || 
          typeValue.includes('credit') || 
          typeValue.includes('deposit') ||
          typeValue.includes('salary') ||
          typeValue.includes('refund') ||
          typeValue.includes('cashback') ||
          typeValue.includes('bonus') ||
          typeValue.includes('incoming')) {  // moved 'incoming' to end
        return 'income';
      }
      
      // Expense patterns (check LAST)
      if (typeValue.includes('expense') || 
          typeValue.includes('debit') || 
          typeValue.includes('withdrawal') ||
          typeValue.includes('payment') ||
          typeValue.includes('purchase') ||
          typeValue.includes('outgoing')) {  // moved 'outgoing' to end
        return 'expense';
      }
    }
    
    // If no type column, check amount sign
    if (mappings.amount) {
      const amount = this.parseAmount(row[mappings.amount]);
      return amount >= 0 ? 'income' : 'expense';
    }
    
    // Default to expense
    return 'expense';
  }

  // Convert CSV data to transactions using mappings
  convertToTransactions(data, mappings) {
    const transactions = [];
    
    for (const row of data) {
      // Skip rows without required fields
      if (!mappings.date || !mappings.amount) {
        console.warn('Skipping row - missing date or amount mapping');
        continue;
      }
      
      const dateValue = row[mappings.date];
      const amountValue = row[mappings.amount];
      
      if (!dateValue || !amountValue) {
        continue;
      }
      
      // Parse date
      const date = this.parseDate(dateValue);
      if (!date) {
        console.warn('Skipping row - invalid date:', dateValue);
        continue;
      }
      
      // Parse amount
      const amount = this.parseAmount(amountValue);
      if (amount === 0) {
        console.warn('Skipping row - invalid amount:', amountValue);
        continue;
      }
      
      // Detect transaction type
      const type = this.detectTransactionType(row, mappings);
      
      // Create transaction object
      const transaction = {
        date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        amount: type === 'expense' || type === 'transfer_out' ? -Math.abs(amount) : Math.abs(amount),
        type: type,
        description: mappings.description ? row[mappings.description] || '' : '',
        category: mappings.category ? row[mappings.category] || 'Other' : 'Other',
        original: row // Keep original for reference
      };
      
      transactions.push(transaction);
    }
    
    return transactions;
  }
}

const csvImportService = new CsvImportService();
export default csvImportService;