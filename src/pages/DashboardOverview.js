import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallets } from '../context/WalletContext';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { 
  PlusCircle, 
  Tag, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Coins,
  ArrowRight,
  CreditCard
} from 'lucide-react';

const DashboardOverview = () => {
  const { formatAmount } = useSettings();
  const { wallets, selectedWalletId, getAnalyticsData, getWalletTransactions, transactionUpdateTrigger } = useWallets();
  const { getCategoryByIdAnyType } = useCategories();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({ transactions: [], totalIncome: 0, totalExpenses: 0 });
  const [allTransactions, setAllTransactions] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentTxnsLoading, setRecentTxnsLoading] = useState(true);

  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId) || wallets[0];

  // Fetch current month analytics for dashboard
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (selectedWallet?.walletId) {
        try {
          setStatsLoading(true);
          setRecentTxnsLoading(true);
          
          // Get analytics data for stats
          const analyticsData = await getAnalyticsData(selectedWallet.walletId, '1month');
          setDashboardData(analyticsData);
          setStatsLoading(false);
          
          // Get ALL transactions for recent transactions list
          const allTxns = await getWalletTransactions(selectedWallet.walletId);
          setAllTransactions(allTxns || []);
          setRecentTxnsLoading(false);
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
          setDashboardData({ transactions: [], totalIncome: 0, totalExpenses: 0 });
          setAllTransactions([]);
          setStatsLoading(false);
          setRecentTxnsLoading(false);
        }
      } else {
        // No wallet selected, reset loading states
        setStatsLoading(false);
        setRecentTxnsLoading(false);
      }
    };

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallet?.walletId, transactionUpdateTrigger]);

  // Extract data from cached analytics
  const { 
    transactions: walletTransactions, 
    totalIncome: monthlyIncome, 
    totalExpenses: monthlyExpenses
  } = dashboardData;

  const recentTransactions = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) {
      return [];
    }
    
    // Sort by transaction date first (most recent transaction dates), then by creation time
    const sorted = allTransactions
      .sort((a, b) => {
        // Primary sort: by transaction date (when the transaction actually occurred)
        const aDate = a.date;
        const bDate = b.date;
        
        if (aDate && bDate) {
          const dateDiff = new Date(bDate).getTime() - new Date(aDate).getTime();
          if (dateDiff !== 0) return dateDiff;
        }
        
        // Secondary sort: if transaction dates are the same, sort by creation time (most recently created first)
        if (a.createdAt && b.createdAt) {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          const createdAtDiff = bTime - aTime;
          if (createdAtDiff !== 0) return createdAtDiff;
        }
        
        // If one has createdAt and other doesn't, prioritize the one with createdAt
        if (a.createdAt && !b.createdAt) return -1;
        if (!a.createdAt && b.createdAt) return 1;
        
        // Final fallback: sort by transaction ID
        return (b.transactionId || '').localeCompare(a.transactionId || '');
      })
      .slice(0, 5);
    
    return sorted;
  }, [allTransactions]);

  const stats = [
    { 
      name: 'Total Balance', 
      value: selectedWallet ? formatAmount(selectedWallet.balance, selectedWallet.currency) : '0', 
      icon: Coins, 
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    { 
      name: 'Monthly Income', 
      value: selectedWallet ? formatAmount(monthlyIncome, selectedWallet.currency) : '0', 
      icon: TrendingUp, 
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    { 
      name: 'Monthly Expenses', 
      value: selectedWallet ? formatAmount(monthlyExpenses, selectedWallet.currency) : '0', 
      icon: TrendingDown, 
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    { 
      name: 'Transactions', 
      value: walletTransactions.length.toString(), 
      icon: Calendar, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back!</h1>
        <p className="text-gray-400 mt-1">Here's your financial overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statsLoading ? (
          // Skeleton loaders for stats
          [...Array(4)].map((_, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-fadeInUp"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gray-800 rounded-lg animate-shimmer"></div>
              </div>
              <div className="h-4 bg-gray-800 rounded animate-shimmer mb-2"></div>
              <div className="h-8 bg-gray-800 rounded animate-shimmer"></div>
            </div>
          ))
        ) : (
          stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.name}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-900/80 transition-all duration-300 transform hover:scale-[1.02] group animate-fadeInUp"
                style={{
                  animationDelay: `${index * 0.1}s`
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon size={24} className={stat.color} />
                  </div>
                </div>
                <p className="text-sm text-gray-400">{stat.name}</p>
                <p className="text-2xl font-semibold mt-1 text-white">{stat.value}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
        <h3 className="text-lg font-semibold mb-4 text-white">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/transactions')}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all duration-300"
          >
            <PlusCircle size={20} />
            <span>Add Transaction</span>
          </button>
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Tag size={20} />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={() => navigate('/wallets')}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Wallet size={20} />
            <span>Manage Wallets</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeInUp" style={{ animationDelay: '0.5s' }}>
        {/* Recent Transactions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>
          
          {recentTxnsLoading ? (
            // Skeleton loaders for recent transactions
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg animate-shimmer"></div>
                    <div>
                      <div className="h-4 w-32 bg-gray-800 rounded animate-shimmer mb-2"></div>
                      <div className="h-3 w-24 bg-gray-800 rounded animate-shimmer"></div>
                    </div>
                  </div>
                  <div className="h-5 w-20 bg-gray-800 rounded animate-shimmer"></div>
                </div>
              ))}
            </div>
          ) : recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((transaction, index) => {
                // Ensure we have valid data for rendering
                const transactionType = transaction.type || 'expense';
                const categoryName = getCategoryByIdAnyType(transaction.categoryId || transaction.category)?.name;
                
                // Build display title with robust fallbacks
                let displayTitle = transaction.description;
                if (!displayTitle) {
                  if (transactionType === 'transfer_in') displayTitle = 'Transfer In';
                  else if (transactionType === 'transfer_out') displayTitle = 'Transfer Out';
                  else if (categoryName) displayTitle = categoryName;
                  else displayTitle = transactionType === 'income' ? 'Income' : 'Expense';
                }
                
                return (
                <div key={transaction.transactionId} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      transactionType === 'income' ? 'bg-emerald-500/10' : 
                      transactionType === 'transfer_in' ? 'bg-blue-500/10' :
                      transactionType === 'transfer_out' ? 'bg-orange-500/10' : 'bg-red-500/10'
                    }`}>
                      <CreditCard size={16} className={
                        transactionType === 'income' ? 'text-emerald-500' : 
                        transactionType === 'transfer_in' ? 'text-blue-500' :
                        transactionType === 'transfer_out' ? 'text-orange-500' : 'text-red-500'
                      } />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {displayTitle}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">
                          {new Date(transaction.date).toLocaleDateString()}
                        </span>
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-blue-400 text-base font-semibold">
                            {transactionType === 'transfer_in' ? 'Transfer In' :
                             transactionType === 'transfer_out' ? 'Transfer Out' :
                             categoryName || (transactionType === 'income' ? 'Income' : 'Expense')}
                          </span>
                        </>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      transactionType === 'income' || transactionType === 'transfer_in' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {(transactionType === 'income' || transactionType === 'transfer_in') ? '+' : '-'}
                      {selectedWallet ? formatAmount(Math.abs(transaction.amount), selectedWallet.currency) : '0'}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 mb-4">No transactions yet</p>
              <button
                onClick={() => navigate('/transactions')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Add your first transaction
              </button>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">This Month Summary</h3>
            <button
              onClick={() => navigate('/analytics')}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
            >
              View analytics
              <ArrowRight size={16} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <TrendingUp size={16} className="text-emerald-500" />
                </div>
                <span className="text-white">Income</span>
              </div>
              <span className="text-emerald-400 font-medium">
                {selectedWallet ? formatAmount(monthlyIncome, selectedWallet.currency) : '0'}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <span className="text-white">Expenses</span>
              </div>
              <span className="text-red-400 font-medium">
                {selectedWallet ? formatAmount(monthlyExpenses, selectedWallet.currency) : '0'}
              </span>
            </div>
            
            <div className="border-t border-gray-800 pt-3">
              <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                <span className="text-white font-medium">Net Flow</span>
                <span className={`font-semibold ${
                  monthlyIncome - monthlyExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {monthlyIncome - monthlyExpenses >= 0 ? '+' : ''}
                  {selectedWallet ? formatAmount(monthlyIncome - monthlyExpenses, selectedWallet.currency) : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;