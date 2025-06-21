import React, { useState } from 'react';
import { 
  Plus,
  Pencil,
  Trash2,
  X,
  CreditCard,
  Wallet as WalletIcon,
  Building2,
  PiggyBank,
  Coins
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useWallets } from '../../context/WalletContext';

const WalletManager = () => {
  const { formatAmount } = useSettings();
  const { wallets, addWallet, updateWallet, deleteWallet } = useWallets();
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  
  // Sample wallet types with their icons and descriptions
  const walletTypes = [
    { 
      id: 'cash',
      name: 'Cash',
      icon: Coins,
      description: 'Physical cash in your wallet'
    },
    {
      id: 'bank',
      name: 'Bank Account',
      icon: Building2,
      description: 'Regular bank account'
    },
    {
      id: 'credit',
      name: 'Credit Card',
      icon: CreditCard,
      description: 'Credit card account'
    },
    {
      id: 'savings',
      name: 'Savings',
      icon: PiggyBank,
      description: 'Savings or investment account'
    }
  ];

  // Form state for new/edit wallet
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    currency: 'USD',
    initialBalance: '',
    isDefault: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingWallet) {
      // Update existing wallet
      updateWallet(editingWallet.walletId, formData);
      setEditingWallet(null);
    } else {
      // Add new wallet
      addWallet({
        ...formData,
        balance: formData.initialBalance, // Map initialBalance to balance for backend compatibility
        icon: walletTypes.find(t => t.id === formData.type)?.icon || WalletIcon
      });
    }
    setIsAddingWallet(false);
    setFormData({
      name: '',
      type: '',
      currency: 'USD',
      initialBalance: '',
      isDefault: false
    });
  };

  const handleEdit = (wallet) => {
    setEditingWallet(wallet);
    setFormData({
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      initialBalance: wallet.initialBalance || 0, // Keep the original initial balance, default to 0 for legacy wallets
      isDefault: wallet.isDefault
    });
    setIsAddingWallet(true);
  };

  const handleDelete = async (walletId) => {
    const wallet = wallets.find(w => w.walletId === walletId);
    const isOnlyWallet = wallets.length === 1;
    
    if (isOnlyWallet) {
      alert('Cannot delete the last wallet. You must have at least one wallet.');
      return;
    }
    
    const confirmMessage = wallet.isDefault 
      ? `Are you sure you want to delete "${wallet.name}"? This is your default wallet and all its transactions will also be deleted. This action cannot be undone.`
      : `Are you sure you want to delete "${wallet.name}"? All its transactions will also be deleted. This action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await deleteWallet(walletId);
      } catch (error) {
        console.error('Failed to delete wallet:', error);
        alert('Failed to delete wallet. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {wallets.map(wallet => {
          const WalletTypeIcon = walletTypes.find(t => t.id === wallet.type)?.icon || WalletIcon;
          return (
            <div
              key={wallet.walletId}
              className="bg-gray-900/50 rounded-xl border border-gray-800/50 p-4 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg text-blue-400">
                    <WalletTypeIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">
                      {wallet.name}
                      {wallet.isDefault && (
                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {walletTypes.find(t => t.id === wallet.type)?.name || 'Wallet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(wallet)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  {wallets.length > 1 && (
                    <button
                      onClick={() => handleDelete(wallet.walletId)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-semibold text-white">
                  {formatAmount(wallet.balance, wallet.currency)}
                </p>
              </div>
            </div>
          );
        })}

        {/* Add Wallet Button */}
        <button
          onClick={() => setIsAddingWallet(true)}
          className="h-full min-h-[120px] flex items-center justify-center gap-2 border-2 border-dashed border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
        >
          <Plus size={20} />
          <span>Add Wallet</span>
        </button>
      </div>

      {/* Add/Edit Wallet Modal */}
      {isAddingWallet && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">
                {editingWallet ? 'Edit Wallet' : 'Add New Wallet'}
              </h2>
              <button
                onClick={() => {
                  setIsAddingWallet(false);
                  setEditingWallet(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Wallet Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Wallet Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white"
                  required
                />
              </div>

              {/* Wallet Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Wallet Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {walletTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.id })}
                        className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                          formData.type === type.id
                            ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        <Icon size={20} />
                        <span>{type.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initial Balance */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Initial Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.initialBalance}
                  onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) })}
                  className="block w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white"
                  required
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="block w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white"
                  required
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="INR">INR - Indian Rupee</option>
                </select>
              </div>

              {/* Set as Default */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                />
                <label htmlFor="isDefault" className="ml-2 text-sm text-gray-400">
                  Set as default wallet
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all duration-300 font-medium"
              >
                {editingWallet ? 'Update Wallet' : 'Add Wallet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletManager; 