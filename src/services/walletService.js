import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export const walletService = {
  async createWallet(walletData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/wallets`, walletData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  async getWallets() {
    try {
      const response = await axios.get(`${API_BASE_URL}/wallets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  async updateWallet(walletId, walletData) {
    try {
      const response = await axios.put(`${API_BASE_URL}/wallets/${walletId}`, walletData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  async deleteWallet(walletId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/wallets/${walletId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}; 