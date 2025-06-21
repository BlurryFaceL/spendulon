import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useWallets } from '../context/WalletContext';
import { parseTransactionDate } from '../utils/dateUtils';
import { 
  Wallet, LogOut, User, Menu, X, Home, 
  PlusCircle, CreditCard, Tag, PieChart, 
  Settings, TrendingUp, TrendingDown, Calendar, Coins,
  ChevronDown, Loader2, BarChart3, Activity
} from 'lucide-react';
import AddTransactionForm from '../components/transactions/AddTransactionForm';
import CategoryManager from '../components/categories/CategoryManager';
import TransactionList from '../components/transactions/TransactionList';
import SettingsPage from '../components/settings/SettingsPage';
import WalletManager from '../components/wallets/WalletManager';
import AnalyticsPage from './AnalyticsPage';
import { StatCardSkeleton, TransactionCardSkeleton } from '../components/ui/SkeletonLoader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Auth } from 'aws-amplify';

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { formatAmount } = useSettings();
  const { wallets, selectedWalletId, setSelectedWalletId, getWalletTransactions, getWalletStats } = useWallets();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);

  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId) || wallets[0];
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [walletStats, setWalletStats] = useState({ monthlyIncome: 0, monthlyExpenses: 0, transactionCount: 0, recentTransactions: [] });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch transactions when selectedWallet changes
  useEffect(() => {
    const fetchTransactions = async () => {
      if (selectedWallet) {
        try {
          // Only show loading if this is the first load
          if (!hasLoadedOnce) {
            setTransactionsLoading(true);
          }
          const transactions = await getWalletTransactions(selectedWallet.walletId);
          setWalletTransactions(transactions);
          setHasLoadedOnce(true);
        } catch (error) {
          setWalletTransactions([]);
        } finally {
          setTransactionsLoading(false);
        }
      } else {
        setWalletTransactions([]);
        setTransactionsLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedWallet, getWalletTransactions, hasLoadedOnce]);

  // Fetch wallet stats separately for better caching
  useEffect(() => {
    const fetchStats = async () => {
      if (selectedWallet && selectedWallet.walletId) {
        try {
          setStatsLoading(true);
          const stats = await getWalletStats(selectedWallet.walletId);
          setWalletStats(stats);
        } catch (error) {
          setWalletStats({ monthlyIncome: 0, monthlyExpenses: 0, transactionCount: 0, recentTransactions: [] });
        } finally {
          setStatsLoading(false);
        }
      } else {
        setWalletStats({ monthlyIncome: 0, monthlyExpenses: 0, transactionCount: 0, recentTransactions: [] });
        setStatsLoading(false);
      }
    };

    // Only fetch if we don't have cached stats or wallet changed
    if (!walletStats.recentTransactions?.length || selectedWallet?.walletId) {
      fetchStats();
    }
  }, [selectedWallet?.walletId]);

  // Use cached stats instead of recalculating for better performance
  const { monthlyIncome, monthlyExpenses, transactionCount, recentTransactions } = walletStats;

  const stats = [
    { 
      name: 'Total Balance', 
      value: selectedWallet ? formatAmount(selectedWallet.balance, selectedWallet.currency) : '0', 
      icon: Coins, 
      color: 'text-purple-500' 
    },
    { 
      name: 'Monthly Income', 
      value: selectedWallet ? formatAmount(monthlyIncome, selectedWallet.currency) : '0', 
      icon: TrendingUp, 
      color: 'text-green-500' 
    },
    { 
      name: 'Monthly Expenses', 
      value: selectedWallet ? formatAmount(monthlyExpenses, selectedWallet.currency) : '0', 
      icon: TrendingDown, 
      color: 'text-red-500' 
    },
    { 
      name: 'Transactions', 
      value: transactionCount.toString(), 
      icon: Calendar, 
      color: 'text-blue-500' 
    }
  ];

  // Add this at the top of Dashboard component
  useEffect(() => {
    const checkAuthAfterRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Force a re-check of auth status
        try {
          const userData = await Auth.currentAuthenticatedUser();
          // Clear the URL
          window.history.replaceState({}, document.title, '/dashboard');
        } catch (error) {
          // Auth check failed
        }
      }
    };
    
    checkAuthAfterRedirect();
  }, []);

  useEffect(() => {
    // Wait for auth to complete checking
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Add this new useEffect after the existing one
useEffect(() => {
  // Handle OAuth callback
  const handleOAuthResponse = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Clear the URL params after OAuth
      window.history.replaceState({}, document.title, '/dashboard');
    }
  };
  
  handleOAuthResponse();
}, []);

  if (loading) {
    return <LoadingSpinner message="Loading Dashboard..." variant="creative" />;
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navigation = [
    { name: 'Overview', icon: Home, id: 'overview' },
    { name: 'Add Transaction', icon: PlusCircle, id: 'add-transaction' },
    { name: 'Transactions', icon: CreditCard, id: 'transactions' },
    { name: 'Categories', icon: Tag, id: 'categories' },
    { name: 'Wallets', icon: Wallet, id: 'wallets' },
    { name: 'Analytics', icon: PieChart, id: 'analytics' },
    { name: 'Settings', icon: Settings, id: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
                <Wallet size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold">$pendulon</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.attributes?.name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user.attributes?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu size={24} />
          </button>

          {/* Wallet Selector */}
          <div className="relative">
            <button
              onClick={() => wallets.length > 0 && setIsWalletSelectorOpen(!isWalletSelectorOpen)}
              disabled={wallets.length === 0}
              className={`flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg transition-colors ${
                wallets.length > 0 ? 'hover:bg-gray-700 cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <div className="p-1 bg-gray-700 rounded">
                <Wallet size={16} />
              </div>
              <span>{selectedWallet?.name || (wallets.length === 0 ? 'Loading...' : 'Select Wallet')}</span>
              {wallets.length > 0 && <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {/* Wallet Dropdown */}
            {isWalletSelectorOpen && wallets.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg border border-gray-700 shadow-lg z-50">
                {wallets.map(wallet => (
                  <button
                    key={wallet.walletId}
                    onClick={() => {
                      setSelectedWalletId(wallet.walletId);
                      setIsWalletSelectorOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-700 transition-colors text-left ${
                      selectedWalletId === wallet.walletId ? 'bg-gray-700' : ''
                    }`}
                  >
                    <div className="p-1 bg-gray-700 rounded">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <div className="font-medium">{wallet.name}</div>
                      <div className="text-sm text-gray-400">
                        {formatAmount(wallet.balance, wallet.currency)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <h2 className="text-2xl font-semibold">
            {navigation.find(item => item.id === activeTab)?.name}
          </h2>
        </div>

        {/* Page content */}
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {activeTab === 'overview' && (
              <div>
                {/* Stats */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                  {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    const isBalanceStat = stat.name === 'Total Balance';
                    const isTransactionStat = stat.name !== 'Total Balance';
                    const showLoading = (isTransactionStat && statsLoading) || (isBalanceStat && !selectedWallet);
                    
                    // Show skeleton for transaction-dependent stats while loading
                    if (showLoading) {
                      return <StatCardSkeleton key={stat.name} />;
                    }
                    
                    return (
                      <div
                        key={stat.name}
                        className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-900/80 transition-all duration-300 transform hover:scale-[1.02] group"
                        style={{
                          animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                        }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-2 bg-gray-800 rounded-lg ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
                            <Icon size={24} />
                          </div>
                        </div>
                        <p className="text-sm text-gray-400">{stat.name}</p>
                        <p className="text-2xl font-semibold mt-1 transition-all duration-300">
                          {stat.value}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Actions */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => setActiveTab('add-transaction')}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all duration-300"
                    >
                      <PlusCircle size={20} />
                      <span>Add Transaction</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('categories')}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Tag size={20} />
                      <span>Manage Categories</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('wallets')}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Wallet size={20} />
                      <span>Manage Wallets</span>
                    </button>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-fadeInUp" style={{ animationDelay: '0.5s' }}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Recent Transactions</h3>
                    {transactionCount > 5 && (
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View all →
                      </button>
                    )}
                  </div>
                  
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <TransactionCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {recentTransactions.map((tx, index) => (
                        <div
                          key={tx.transactionId}
                          className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-all duration-200"
                          style={{
                            animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              tx.type === 'income' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {tx.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {tx.description || tx.note || 'Transaction'}
                              </p>
                              <p className="text-xs text-gray-400">{tx.date}</p>
                            </div>
                          </div>
                          <p className={`font-medium ${
                            tx.type === 'income' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}
                            {formatAmount(Math.abs(tx.amount), selectedWallet?.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">
                      No transactions yet. Add your first transaction to get started!
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'add-transaction' && (
              <div>
                <AddTransactionForm />
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <TransactionList />
              </div>
            )}

            {activeTab === 'categories' && (
              <div>
                <CategoryManager />
              </div>
            )}

            {activeTab === 'wallets' && (
              <div>
                <WalletManager />
              </div>
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPage />
            )}

            {activeTab === 'settings' && (
              <div>
                <SettingsPage />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;