import { useApi } from '../hooks/useApi';

export const useUserService = () => {
  const { get, post } = useApi();

  const createOrUpdateUser = async (userData) => {
    try {
      const response = await post('/users', userData);
      return response;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  };

  return {
    createOrUpdateUser
  };
};