import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useApi, useApiMutation } from '../hooks/useApi';
import { API_CONFIG } from '../config/api-config';
import { useAuth } from './AuthContext';
import { useCategories } from './CategoriesContext';
import { parseTransactionDate } from '../utils/dateUtils';

const WalletContext = createContext();

export const useWallets = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallets must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const { user } = useAuth(); // Get user authentication state
  const { updateCategoryUsageFromTransactions, getCategoryByIdAnyType } = useCategories();
  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const [isCreatingDefaultWallet, setIsCreatingDefaultWallet] = useState(false);
  const [transactionCache, setTransactionCache] = useState(new Map());
  const [analyticsCache, setAnalyticsCache] = useState(new Map());
  const [walletStatsCache, setWalletStatsCache] = useState(new Map());
  const [transactionUpdateTrigger, setTransactionUpdateTrigger] = useState(0);
  const [batchMode, setBatchMode] = useState(false);

  
  // Fetch wallets from API
  const { data, loading, error, refetch: refetchWallets } = useApi(API_CONFIG.endpoints.wallets);
  const wallets = useMemo(() => Array.isArray(data) ? data : [], [data]);
  const { mutate } = useApiMutation();

  // Create default wallet for new users
  useEffect(() => {
    const createDefaultWallet = async () => {
      // Only create default wallet if user is authenticated
      if (user && !loading && !error && wallets.length === 0 && !isCreatingDefaultWallet) {
        setIsCreatingDefaultWallet(true);
        try {
          const defaultWallet = {
            name: 'My Wallet',
            currency: 'INR',
            balance: 0,
            description: 'Your main wallet'
          };
          
          await mutate(API_CONFIG.endpoints.wallets, {
            method: 'POST',
            body: JSON.stringify(defaultWallet)
          });
          
          // Refetch wallets to get the newly created default wallet
          refetchWallets();
        } catch (error) {
          console.error('Error creating default wallet:', error);
        } finally {
          setIsCreatingDefaultWallet(false);
        }
      }
    };

    createDefaultWallet();
  }, [user, loading, error, wallets.length, isCreatingDefaultWallet, mutate, refetchWallets]);

  // Set default wallet when wallets load
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(wallets[0].walletId);
    }
  }, [wallets, selectedWalletId]);


  // Add new wallet
  const addWallet = useCallback(async (walletData) => {
    try {
      await mutate(API_CONFIG.endpoints.wallets, {
        method: 'POST',
        body: JSON.stringify(walletData)
      });
      refetchWallets();
    } catch (error) {
      console.error('Error adding wallet:', error);
      throw error;
    }
  }, [mutate, refetchWallets]);

  // Helper functions for caching (moved up for dependency order)
  const getCacheKey = useCallback((walletId, month = null) => {
    const date = month || new Date();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `${walletId}-${monthKey}`;
  }, []);

  const isCacheValid = useCallback((cacheEntry, maxAge = 30000) => {
    if (!cacheEntry) return false;
    const now = Date.now();
    const cacheAge = now - cacheEntry.timestamp;
    return cacheAge < maxAge; // configurable freshness
  }, []);

  const cleanOldCache = useCallback(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    setTransactionCache(prev => {
      const newCache = new Map(prev);
      for (const [key] of newCache) {
        const [, dateStr] = key.split('-');
        const [year, month] = dateStr.split('-').map(Number);
        const entryDate = new Date(year, month - 1);
        
        if (entryDate < sixMonthsAgo) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
  }, []);

  // Optimistic cache updates
  const updateTransactionCache = useCallback((walletId, updateFn) => {
    const cacheKey = getCacheKey(walletId);
    setTransactionCache(prev => {
      const newCache = new Map(prev);
      const cached = newCache.get(cacheKey);
      if (cached) {
        newCache.set(cacheKey, {
          ...cached,
          data: updateFn(cached.data),
          timestamp: Date.now()
        });
      }
      return newCache;
    });
    
    // Invalidate analytics and stats cache when transactions change
    setAnalyticsCache(prev => {
      const newCache = new Map(prev);
      for (const key of newCache.keys()) {
        if (key.startsWith(`${walletId}-`)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    setWalletStatsCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(`stats-${walletId}`);
      return newCache;
    });
    
    // Trigger re-render for components listening to transaction updates (only if not in batch mode)
    if (!batchMode) {
      setTransactionUpdateTrigger(prev => prev + 1);
    }
  }, [getCacheKey, batchMode]);

  const invalidateTransactionCache = useCallback((walletId) => {
    const cacheKey = getCacheKey(walletId);
    setTransactionCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(cacheKey);
      return newCache;
    });
    // Analytics and stats depend on transaction data, invalidate those too
    setAnalyticsCache(prev => {
      const newCache = new Map(prev);
      // Clear all analytics for this wallet
      for (const key of newCache.keys()) {
        if (key.startsWith(`${walletId}-`)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    setWalletStatsCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(`stats-${walletId}`);
      return newCache;
    });
  }, [getCacheKey]);

  // Analytics caching helpers
  const getAnalyticsCacheKey = useCallback((walletId, timeRange, customStart, customEnd) => {
    if (customStart && customEnd) {
      return `${walletId}-custom-${customStart}-${customEnd}`;
    }
    return `${walletId}-${timeRange}`;
  }, []);

  const isAnalyticsCacheValid = useCallback((cacheEntry) => {
    if (!cacheEntry) return false;
    const now = Date.now();
    const cacheAge = now - cacheEntry.timestamp;
    return cacheAge < 120000; // 2 minutes for analytics
  }, []);


  // Add transaction with optimistic updates
  const addTransaction = useCallback(async (walletId, transactionData) => {
    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const timestamp = new Date().toISOString();
    
    // Calculate balance change
    const amount = parseFloat(transactionData.amount);
    let balanceChange = 0;
    
    if (transactionData.type === 'income') {
      balanceChange = amount;
    } else if (transactionData.type === 'expense') {
      balanceChange = -amount;
    } else if (transactionData.type === 'transfer_out') {
      balanceChange = -amount;
    } else if (transactionData.type === 'transfer_in') {
      balanceChange = amount;
    }

    // Create optimistic transaction
    const optimisticTransaction = {
      transactionId: tempId,
      walletId,
      ...transactionData,
      amount: balanceChange,
      createdAt: timestamp,
      updatedAt: timestamp,
      isOptimistic: true
    };

    try {
      // 1. Optimistic updates
      updateTransactionCache(walletId, (transactions) => [optimisticTransaction, ...transactions]);
      
      // 2. API call
      const result = await mutate(API_CONFIG.endpoints.transactions(walletId), {
        method: 'POST',
        body: JSON.stringify(transactionData)
      });
      
      // 3. Replace optimistic transaction with real one
      updateTransactionCache(walletId, (transactions) => 
        transactions.map(tx => 
          tx.transactionId === tempId 
            ? { ...result.transaction, isOptimistic: false }
            : tx
        )
      );
      
      // 4. Refetch wallets for balance update (transfers might affect multiple wallets)
      refetchWallets();
      
    } catch (error) {
      console.error('Error adding transaction:', error);
      
      // Rollback optimistic updates
      updateTransactionCache(walletId, (transactions) => 
        transactions.filter(tx => tx.transactionId !== tempId)
      );
      
      throw error;
    }
  }, [mutate, refetchWallets, updateTransactionCache]);

  // Batch import transactions
  const startBatchMode = useCallback(() => {
    setBatchMode(true);
  }, []);

  const endBatchMode = useCallback(() => {
    setBatchMode(false);
    setTransactionUpdateTrigger(prev => prev + 1); // Trigger single update at the end
  }, []);

  const addTransactionsBatch = useCallback(async (walletId, transactions) => {
    try {
      // For small batches (< 10), use individual calls for better user feedback
      if (transactions.length < 10) {
        startBatchMode();
        
        for (const transactionData of transactions) {
          await addTransaction(walletId, transactionData);
        }
        
        endBatchMode();
        return;
      }
      
      // For larger batches, use the batch endpoint
      const { Auth } = await import('aws-amplify');
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      // Split into chunks of 100 (API limit)
      const MAX_BATCH_SIZE = 100;
      const chunks = [];
      for (let i = 0; i < transactions.length; i += MAX_BATCH_SIZE) {
        chunks.push(transactions.slice(i, i + MAX_BATCH_SIZE));
      }
      
      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };
      
      // Process each chunk
      for (const chunk of chunks) {
        const response = await fetch(`${API_CONFIG.baseURL}/wallets/${walletId}/transactions/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ transactions: chunk })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create transactions batch: ${response.statusText}`);
        }
        
        const result = await response.json();
        results.successful += result.successful || 0;
        results.failed += result.failed || 0;
        if (result.results?.failed) {
          results.errors.push(...result.results.failed);
        }
      }
      
      // Clear transaction cache for this wallet
      const cacheKey = getCacheKey(walletId);
      setTransactionCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(cacheKey);
        return newCache;
      });
      
      // Trigger update
      setTransactionUpdateTrigger(prev => prev + 1);
      
      // Refetch wallet to get updated balance
      await refetchWallets();
      
      // Log results
      console.log(`Batch import completed: ${results.successful} successful, ${results.failed} failed`);
      if (results.errors.length > 0) {
        console.error('Failed transactions:', results.errors);
      }
      
      return results;
    } catch (error) {
      console.error('Batch import error:', error);
      throw error;
    }
  }, [getCacheKey, refetchWallets]);

  // Get transactions for a wallet (with caching)
  const getWalletTransactions = useCallback(async (walletId, forceRefresh = false) => {
    const cacheKey = getCacheKey(walletId);
    const cached = transactionCache.get(cacheKey);
    
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && isCacheValid(cached)) {
      // Update category usage even for cached data
      updateCategoryUsageFromTransactions(cached.data);
      return cached.data;
    }
    
    try {
      const { Auth } = await import('aws-amplify');
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.transactions(walletId)}`, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const responseData = await response.json();
      const transactions = Array.isArray(responseData) ? responseData : [];
      
      // Update cache
      setTransactionCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, {
          data: transactions,
          timestamp: Date.now()
        });
        return newCache;
      });
      
      // Update category usage count for sorting
      updateCategoryUsageFromTransactions(transactions);
      
      // Clean old cache periodically
      if (Math.random() < 0.1) cleanOldCache();
      
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      // Return cached data if available, even if stale
      const fallbackData = cached?.data || [];
      if (fallbackData.length > 0) {
        updateCategoryUsageFromTransactions(fallbackData);
      }
      return fallbackData;
    }
  }, [transactionCache, getCacheKey, isCacheValid, cleanOldCache, updateCategoryUsageFromTransactions]);

  const getAnalyticsData = useCallback(async (walletId, timeRange = '6months', customStart = null, customEnd = null) => {
    const cacheKey = getAnalyticsCacheKey(walletId, timeRange, customStart, customEnd);
    const cached = analyticsCache.get(cacheKey);
    
    // Return cached if valid
    if (cached && isAnalyticsCacheValid(cached)) {
      return cached.data;
    }
    
    // Get fresh transaction data
    const transactions = await getWalletTransactions(walletId);
    
    // Filter transactions based on time range
    let filteredTransactions = transactions;
    
    if (customStart && customEnd) {
      const startDate = new Date(customStart);
      const endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      
      filteredTransactions = transactions.filter(tx => {
        const txDate = parseTransactionDate(tx.date);
        return txDate >= startDate && txDate <= endDate;
      });
    } else if (timeRange !== 'all-time') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (timeRange) {
        case '1month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case '6months':
          cutoffDate.setMonth(now.getMonth() - 6);
          break;
        case '1year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          // Default to 6 months for any other value
          cutoffDate.setMonth(now.getMonth() - 6);
          break;
      }
      
      filteredTransactions = transactions.filter(tx => parseTransactionDate(tx.date) >= cutoffDate);
    }
    
    // Calculate analytics
    const totalIncome = filteredTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalExpenses = filteredTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    const totalTransferIn = filteredTransactions
      .filter(tx => tx.type === 'transfer_in')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalTransferOut = filteredTransactions
      .filter(tx => tx.type === 'transfer_out')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    const totalAvoidableExpenses = filteredTransactions
      .filter(tx => tx.type === 'expense' && tx.avoidable === true)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    // Calculate investment amounts by checking category investment flag
    const totalInvestments = filteredTransactions
      .filter(tx => {
        if (tx.type !== 'expense') return false;
        const category = getCategoryByIdAnyType(tx.categoryId);
        const isInvestment = category?.isInvestment === true;
        
        
        return isInvestment;
      })
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    // Calculate spending excluding investments
    const totalSpending = totalExpenses - totalInvestments;
    const savingsRateExcludingInvestments = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome * 100) : 0;
    
    const analyticsData = {
      transactions: filteredTransactions,
      totalIncome,
      totalExpenses,
      totalTransferIn,
      totalTransferOut,
      totalAvoidableExpenses,
      totalInvestments,
      totalSpending,
      savingsRateExcludingInvestments,
      netFlow: totalIncome - totalExpenses + totalTransferIn - totalTransferOut,
      transactionCount: filteredTransactions.length
    };
    
    // Cache the result
    setAnalyticsCache(prev => {
      const newCache = new Map(prev);
      newCache.set(cacheKey, {
        data: analyticsData,
        timestamp: Date.now()
      });
      return newCache;
    });
    
    return analyticsData;
  }, [analyticsCache, getAnalyticsCacheKey, isAnalyticsCacheValid, getWalletTransactions, getCategoryByIdAnyType]);

  // Get wallet dashboard stats with caching for better performance
  const getWalletStats = useCallback(async (walletId, forceRefresh = false) => {
    if (!walletId) return { monthlyIncome: 0, monthlyExpenses: 0, transactionCount: 0, recentTransactions: [] };
    
    const cacheKey = `stats-${walletId}`;
    const cached = walletStatsCache.get(cacheKey);
    
    // Return cached data if valid and not forcing refresh (5 minute cache for stats)
    if (!forceRefresh && cached && isCacheValid(cached, 300000)) {
      return cached.data;
    }
    
    try {
      // Get transactions for current month stats
      const transactions = await getWalletTransactions(walletId);
      
      const now = new Date();
      const currentMonth = transactions.filter(tx => {
        const txDate = parseTransactionDate(tx.date);
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      });
      
      const monthlyIncome = currentMonth
        .filter(tx => tx.type === 'income' || tx.type === 'transfer_in')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      const monthlyExpenses = currentMonth
        .filter(tx => tx.type === 'expense' || tx.type === 'transfer_out')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      // Get recent transactions (top 5, sorted by date)
      const recentTransactions = transactions
        .sort((a, b) => parseTransactionDate(b.date) - parseTransactionDate(a.date))
        .slice(0, 5);
      
      const stats = {
        monthlyIncome,
        monthlyExpenses,
        transactionCount: transactions.length,
        currentMonthTransactions: currentMonth,
        recentTransactions
      };
      
      // Cache the stats
      setWalletStatsCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, {
          data: stats,
          timestamp: Date.now()
        });
        return newCache;
      });
      
      return stats;
    } catch (error) {
      console.error('Error fetching wallet stats:', error);
      // Return cached data if available, even if stale
      return cached?.data || { monthlyIncome: 0, monthlyExpenses: 0, transactionCount: 0, recentTransactions: [] };
    }
  }, [walletStatsCache, isCacheValid, getWalletTransactions]);

  // Update wallet
  const updateWallet = useCallback(async (walletId, walletData) => {
    try {
      await mutate(`${API_CONFIG.endpoints.wallets}/${walletId}`, {
        method: 'PUT',
        body: JSON.stringify(walletData)
      });
      refetchWallets();
    } catch (error) {
      console.error('Error updating wallet:', error);
      throw error;
    }
  }, [mutate, refetchWallets]);

  // Delete wallet
  const deleteWallet = useCallback(async (walletId) => {
    try {
      await mutate(`${API_CONFIG.endpoints.wallets}/${walletId}`, {
        method: 'DELETE'
      });
      
      // If this was the last wallet, the refetch will trigger default wallet creation
      // If there are remaining wallets, select one of them
      if (selectedWalletId === walletId && wallets.length > 1) {
        const remainingWallets = wallets.filter(w => w.walletId !== walletId);
        setSelectedWalletId(remainingWallets[0]?.walletId || null);
      } else if (wallets.length === 1) {
        // This is the last wallet being deleted, clear selection
        // Default wallet creation will be triggered by the refetch
        setSelectedWalletId(null);
      }
      
      refetchWallets();
    } catch (error) {
      console.error('Error deleting wallet:', error);
      throw error;
    }
  }, [mutate, refetchWallets, selectedWalletId, wallets]);

  // Update transaction with optimistic updates
  const updateTransaction = useCallback(async (walletId, transactionId, transactionData) => {
    let originalTransaction = null;
    
    try {
      // 1. Optimistic update
      updateTransactionCache(walletId, (transactions) => 
        transactions.map(tx => {
          if (tx.transactionId === transactionId) {
            originalTransaction = tx; // Store for rollback
            return { ...tx, ...transactionData, isOptimistic: true };
          }
          return tx;
        })
      );
      
      // 2. API call
      await mutate(`${API_CONFIG.endpoints.transactions(walletId)}/${transactionId}`, {
        method: 'PUT',
        body: JSON.stringify(transactionData)
      });
      
      // 3. Mark as synced
      updateTransactionCache(walletId, (transactions) => 
        transactions.map(tx => 
          tx.transactionId === transactionId 
            ? { ...tx, isOptimistic: false }
            : tx
        )
      );
      
      // 4. Refresh wallets for balance accuracy
      refetchWallets();
      
    } catch (error) {
      console.error('Error updating transaction:', error);
      
      // Rollback optimistic update
      if (originalTransaction) {
        updateTransactionCache(walletId, (transactions) => 
          transactions.map(tx => 
            tx.transactionId === transactionId ? originalTransaction : tx
          )
        );
      }
      
      throw error;
    }
  }, [mutate, refetchWallets, updateTransactionCache]);

  // Delete transaction with optimistic updates
  const deleteTransaction = useCallback(async (walletId, transactionId) => {
    let deletedTransaction = null;
    
    try {
      // 1. Optimistic delete
      updateTransactionCache(walletId, (transactions) => {
        const filtered = transactions.filter(tx => {
          if (tx.transactionId === transactionId) {
            deletedTransaction = tx; // Store for rollback
            return false;
          }
          return true;
        });
        return filtered;
      });
      
      // 2. API call
      await mutate(`${API_CONFIG.endpoints.transactions(walletId)}/${transactionId}`, {
        method: 'DELETE'
      });
      
      // 3. Refresh wallets for balance accuracy
      refetchWallets();
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      
      // Rollback optimistic delete
      if (deletedTransaction) {
        updateTransactionCache(walletId, (transactions) => [deletedTransaction, ...transactions]);
      }
      
      // If it's a 404, the transaction might already be deleted
      if (error.message.includes('404')) {
        refetchWallets();
        return; // Don't throw error for 404 - transaction is gone
      }
      
      throw error;
    }
  }, [mutate, refetchWallets, updateTransactionCache]);

  // Load transactions for category usage when wallet is selected
  useEffect(() => {
    if (selectedWalletId && user) {
      // Use async function to load transactions and update category usage
      const loadTransactions = async () => {
        try {
          await getWalletTransactions(selectedWalletId);
        } catch (error) {
          console.error('Error loading transactions for category usage:', error);
        }
      };
      loadTransactions();
    }
  }, [selectedWalletId, user, getWalletTransactions]);

  const value = {
    wallets,
    loading: loading || isCreatingDefaultWallet,
    error,
    selectedWalletId,
    setSelectedWalletId,
    addWallet,
    updateWallet,
    deleteWallet,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,
    getWalletTransactions,
    refetchWallets,
    // Cache management
    invalidateTransactionCache,
    getAnalyticsData,
    getWalletStats,
    transactionUpdateTrigger
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};