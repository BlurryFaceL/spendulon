import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWallets } from '../context/WalletContext';
import { useCategories } from '../context/CategoriesContext';
import { useSettings } from '../context/SettingsContext';
import { ArrowLeft, Filter } from 'lucide-react';
import TransactionList from '../components/transactions/TransactionList';

const FilteredTransactionsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wallets, selectedWalletId, getWalletTransactions } = useWallets();
  const { getCategoryByIdAnyType } = useCategories();
  const { formatAmount } = useSettings();
  
  const categoryId = searchParams.get('categoryId');
  const categoryName = searchParams.get('categoryName');
  const dateRange = searchParams.get('dateRange') || 'all-time';
  const customStartDate = searchParams.get('startDate');
  const customEndDate = searchParams.get('endDate');
  
  
  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId);
  const category = getCategoryByIdAnyType(categoryId);
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch transactions when wallet changes
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!selectedWallet) {
        setTransactions([]);
        return;
      }
      
      setLoading(true);
      try {
        const walletTransactions = await getWalletTransactions(selectedWallet.walletId);
        setTransactions(walletTransactions);
      } catch (error) {
        console.error('Error fetching filtered transactions:', error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedWallet, getWalletTransactions]);
  
  // Calculate totals for this category (need to apply same filtering as TransactionList)
  const filteredTransactions = transactions.filter(tx => {
    // Apply category filter
    if (categoryId && tx.categoryId !== categoryId) {
      return false;
    }
    
    // Apply date filter (simplified version of TransactionList logic)
    if (dateRange !== 'all-time') {
      const txDate = new Date(tx.date);
      
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        return txDate >= start && txDate <= end;
      }
      
      // Add other date range logic if needed
    }
    
    return true;
  });
  
  const totalAmount = filteredTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const transactionCount = filteredTransactions.length;
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/analytics')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Analytics</span>
            </button>
            
            <div>
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-blue-500" />
                <h1 className="text-2xl font-bold text-white">
                  {categoryName || category?.name || 'Filtered Transactions'}
                </h1>
              </div>
              <p className="text-gray-400 mt-1">
                {transactionCount} transactions • Total: {selectedWallet ? formatAmount(totalAmount, selectedWallet.currency) : '0'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Filter Summary */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Category:</span>
              <span className="text-white font-medium">{categoryName || category?.name || 'All'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Date Range:</span>
              <span className="text-white font-medium">
                {dateRange === 'all-time' ? 'All Time' : 
                 dateRange === 'custom' && customStartDate && customEndDate ? 
                   `${customStartDate} to ${customEndDate}` : 
                   dateRange}
              </span>
            </div>
            {selectedWallet && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Wallet:</span>
                <span className="text-white font-medium">{selectedWallet.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <TransactionList 
        dateRange={dateRange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        categoryFilter={categoryId}
      />
    </div>
  );
};

export default FilteredTransactionsPage;