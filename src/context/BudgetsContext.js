import React, { createContext, useContext, useState, useEffect } from 'react';
import { budgetsService } from '../services/budgetsService';
import { useAuth } from './AuthContext';

const BudgetsContext = createContext();

export const useBudgets = () => {
  const context = useContext(BudgetsContext);
  if (!context) {
    throw new Error('useBudgets must be used within a BudgetsProvider');
  }
  return context;
};

export const BudgetsProvider = ({ children }) => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Load budgets from DynamoDB on mount (when user is available)
  useEffect(() => {
    if (user) {
      loadBudgetsFromDB();
    }
  }, [user]);

  const loadBudgetsFromDB = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await budgetsService.getUserBudgets();
      setBudgets(response.budgets || []);
    } catch (error) {
      console.error('Failed to load budgets:', error);
      setError('Failed to load budgets');
      // Fall back to localStorage for offline functionality
      loadBudgetsFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadBudgetsFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('spendulon-budgets');
      if (saved) {
        setBudgets(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load budgets from localStorage:', error);
    }
  };

  const addBudget = async (budgetData) => {
    try {
      setError(null);
      
      const response = await budgetsService.createUserBudget(budgetData);
      const newBudget = response.budget;
      
      setBudgets(prev => [...prev, newBudget]);
      
      // Also save to localStorage as backup
      localStorage.setItem('spendulon-budgets', JSON.stringify([...budgets, newBudget]));
      
      return newBudget;
    } catch (error) {
      console.error('Error adding budget:', error);
      setError('Failed to add budget');
      throw error;
    }
  };

  const updateBudget = async (budgetId, budgetData) => {
    try {
      setError(null);
      
      const response = await budgetsService.updateUserBudget(budgetId, budgetData);
      const updatedBudget = response.budget;
      
      setBudgets(prev => prev.map(budget => 
        budget.budgetId === budgetId ? updatedBudget : budget
      ));
      
      // Also save to localStorage as backup
      const updatedBudgets = budgets.map(budget => 
        budget.budgetId === budgetId ? updatedBudget : budget
      );
      localStorage.setItem('spendulon-budgets', JSON.stringify(updatedBudgets));
      
      return updatedBudget;
    } catch (error) {
      console.error('Error updating budget:', error);
      setError('Failed to update budget');
      throw error;
    }
  };

  const deleteBudget = async (budgetId) => {
    try {
      setError(null);
      
      await budgetsService.deleteUserBudget(budgetId);
      
      setBudgets(prev => prev.filter(budget => budget.budgetId !== budgetId));
      
      // Also save to localStorage as backup
      const filteredBudgets = budgets.filter(budget => budget.budgetId !== budgetId);
      localStorage.setItem('spendulon-budgets', JSON.stringify(filteredBudgets));
    } catch (error) {
      console.error('Error deleting budget:', error);
      setError('Failed to delete budget');
      throw error;
    }
  };

  const getBudgetByCategory = (categoryId) => {
    return budgets.find(budget => budget.categoryId === categoryId);
  };

  const value = {
    budgets,
    loading,
    error,
    addBudget,
    updateBudget,
    deleteBudget,
    getBudgetByCategory,
    loadBudgetsFromDB
  };

  return (
    <BudgetsContext.Provider value={value}>
      {children}
    </BudgetsContext.Provider>
  );
};