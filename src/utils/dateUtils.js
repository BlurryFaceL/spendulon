/**
 * Utility functions for handling date parsing and formatting
 */

/**
 * Parse transaction date strings that can be in DD-MM-YYYY or YYYY-MM-DD format
 * @param {string} dateString - Date string to parse
 * @returns {Date} - Parsed Date object
 */
export const parseTransactionDate = (dateString) => {
  if (!dateString) return new Date();
  
  // Check if date is in DD-MM-YYYY format (from PDF import)
  if (dateString.includes('-') && dateString.length === 10) {
    const dateParts = dateString.split('-');
    if (dateParts.length === 3 && dateParts[0].length === 2) {
      // DD-MM-YYYY format, convert to YYYY-MM-DD for proper Date parsing
      const [day, month, year] = dateParts;
      return new Date(`${year}-${month}-${day}`);
    }
  }
  
  // Otherwise, try parsing as-is (for YYYY-MM-DD or other formats)
  return new Date(dateString);
};

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD format for HTML date inputs
 * @param {string} dateString - Date string in DD-MM-YYYY format
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const convertToHtmlDateFormat = (dateString) => {
  if (!dateString) return '';
  
  if (dateString.includes('-') && dateString.length === 10) {
    const dateParts = dateString.split('-');
    if (dateParts.length === 3 && dateParts[0].length === 2) {
      // DD-MM-YYYY format, convert to YYYY-MM-DD
      const [day, month, year] = dateParts;
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateString; // Return as-is if not DD-MM-YYYY format
};

/**
 * Format date for display purposes
 * @param {Date|string} date - Date object or string
 * @returns {string} - Formatted date string
 */
export const formatDisplayDate = (date) => {
  if (typeof date === 'string') {
    date = parseTransactionDate(date);
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};