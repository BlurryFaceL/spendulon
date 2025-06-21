const getApiUrl = () => {
  // Use environment variable if available, otherwise use localhost
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  }
  
  // For local development
  return 'http://localhost:3000';
};
  
  export const API_CONFIG = {
    baseUrl: getApiUrl(),
    endpoints: {
      wallets: '/wallets',
      transactions: (walletId) => `/wallets/${walletId}/transactions`,
      pdfParse: '/pdf/parse',
      mlFeedback: '/ml/feedback',
    }
  };