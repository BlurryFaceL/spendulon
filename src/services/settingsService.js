import { Auth } from 'aws-amplify';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export const settingsService = {
  async getUserSettings() {
    try {
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      const response = await fetch(`${API_BASE_URL}/users/settings`, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error.message || error;
    }
  },

  async updateUserSettings(settings) {
    try {
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      const response = await fetch(`${API_BASE_URL}/users/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error.message || error;
    }
  }
};