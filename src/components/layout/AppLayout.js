import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useWallets } from '../../context/WalletContext';
import { 
  Wallet, LogOut, User, Menu, X, Home, 
  CreditCard, Tag, PieChart, Target,
  Settings, ChevronDown
} from 'lucide-react';
import { Auth } from 'aws-amplify';
import LoadingSpinner from '../ui/LoadingSpinner';

const AppLayout = ({ children }) => {
  const { user, loading, signOut } = useAuth();
  const { formatAmount } = useSettings();
  const { wallets, selectedWalletId, setSelectedWalletId } = useWallets();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);

  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId) || wallets[0];

  // Add this at the top of AppLayout component
  useEffect(() => {
    const checkAuthAfterRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Force a re-check of auth status
        try {
          await Auth.currentAuthenticatedUser();
          // Clear the URL
          window.history.replaceState({}, document.title, location.pathname);
        } catch (error) {
          // Auth check failed
        }
      }
    };
    
    checkAuthAfterRedirect();
  }, [location.pathname]);

  useEffect(() => {
    // Wait for auth to complete checking
    if (!loading && !user) {
      console.log('No user found, redirecting to login');
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
        console.log('OAuth code detected in layout, clearing URL');
        // Clear the URL params after OAuth
        window.history.replaceState({}, document.title, location.pathname);
      }
    };
    
    handleOAuthResponse();
  }, [location.pathname]);

  if (loading) {
    return <LoadingSpinner variant="creative" message="Setting up your dashboard" />;
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navigation = [
    { name: 'Overview', icon: Home, path: '/dashboard' },
    { name: 'Transactions', icon: CreditCard, path: '/transactions' },
    { name: 'Categories', icon: Tag, path: '/categories' },
    { name: 'Wallets', icon: Wallet, path: '/wallets' },
    { name: 'Budgets', icon: Target, path: '/budgets' },
    { name: 'Analytics', icon: PieChart, path: '/analytics' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const getPageTitle = () => {
    const currentNav = navigation.find(item => item.path === location.pathname);
    return currentNav?.name || 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <img 
                src="/spendulon-pie-logo.svg" 
                alt="Spendulon" 
                className="w-12 h-12"
              />
              <h1 className="text-xl font-bold">$pendulon</h1>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white p-2 -m-2 touch-manipulation rounded-lg active:bg-gray-800/50"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50 active:bg-gray-800/70'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
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
                  {user.attributes?.name || user.attributes?.given_name || user.username || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user.attributes?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-3 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-lg transition-colors touch-manipulation"
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
            className="lg:hidden text-gray-400 hover:text-white p-2 -m-2 touch-manipulation rounded-lg active:bg-gray-800/50"
          >
            <Menu size={24} />
          </button>

          {/* Wallet Selector */}
          <div className="relative">
            <button
              onClick={() => wallets.length > 0 && setIsWalletSelectorOpen(!isWalletSelectorOpen)}
              disabled={wallets.length === 0}
              className={`flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg transition-colors touch-manipulation ${
                wallets.length > 0 ? 'hover:bg-gray-700 active:bg-gray-600 cursor-pointer' : 'cursor-not-allowed opacity-50'
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
              <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg border border-gray-700 shadow-lg z-50 max-h-60 overflow-y-auto">
                {wallets.map(wallet => (
                  <button
                    key={wallet.walletId}
                    onClick={() => {
                      setSelectedWalletId(wallet.walletId);
                      setIsWalletSelectorOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-700 active:bg-gray-600 transition-colors text-left touch-manipulation ${
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

          <h2 className="text-xl sm:text-2xl font-semibold truncate">
            {getPageTitle()}
          </h2>
        </div>

        {/* Page content */}
        <main className="py-4 sm:py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Click outside to close wallet selector */}
      {isWalletSelectorOpen && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setIsWalletSelectorOpen(false)}
        />
      )}
    </div>
  );
};

export default AppLayout;