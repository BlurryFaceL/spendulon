import React, { useState } from 'react';
import { useWallets } from '../../context/WalletContext';
import { useCategories } from '../../context/CategoriesContext';
import { 
  Calendar,
  CreditCard,
  Tag,
  PlusCircle,
  ArrowDownUp,
  Receipt,
  BadgeDollarSign,
  X,
  ArrowRightLeft
} from 'lucide-react';

const AddTransactionForm = ({ onTransactionAdded }) => {
  const { wallets, selectedWalletId, addTransaction } = useWallets();
  const { getCategoriesByType } = useCategories();
  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId);
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    amount: '',
    category: '',
    fromWalletId: '', // For transfer_in from another wallet
    note: '',
    labels: [],
    avoidable: false // For tracking avoidable expenses
  });

  // New label input state
  const [newLabel, setNewLabel] = useState('');
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get categories based on transaction type (sorted by usage frequency)
  const getCurrentCategories = () => {
    return getCategoriesByType(formData.type, true);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Clear category when transaction type changes
      if (name === 'type' && value !== prev.type) {
        newData.category = '';
        newData.fromWalletId = '';
      }
      
      return newData;
    });
  };

  // Handle form submission with optimistic updates
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWallet || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await addTransaction(selectedWallet.walletId, formData);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        amount: '',
        category: '',
        fromWalletId: '',
        note: '',
        labels: [],
        avoidable: false
      });
      setNewLabel('');

      // Call the callback if provided (but avoid triggering full reloads)
      if (onTransactionAdded) {
        onTransactionAdded();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle label addition
  const handleAddLabel = (e) => {
    e.preventDefault();
    if (newLabel.trim() && !formData.labels.includes(newLabel.trim())) {
      setFormData(prev => ({
        ...prev,
        labels: [...prev.labels, newLabel.trim()]
      }));
      setNewLabel('');
    }
  };

  // Handle label removal
  const handleRemoveLabel = (labelToRemove) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter(label => label !== labelToRemove)
    }));
  };

  if (!selectedWallet) {
    return (
      <div className="max-w-2xl mx-auto bg-gray-900 rounded-xl border border-gray-800 p-6">
        <p className="text-gray-400">Please select a wallet first</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 rounded-xl border border-gray-800 p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Transaction Type */}
        <div className="grid grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'expense' } })}
            className={`flex items-center justify-center space-x-2 p-3 rounded-lg transition-colors ${
              formData.type === 'expense'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <CreditCard size={20} />
            <span>Expense</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'income' } })}
            className={`flex items-center justify-center space-x-2 p-3 rounded-lg transition-colors ${
              formData.type === 'income'
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <BadgeDollarSign size={20} />
            <span>Income</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'transfer_out' } })}
            className={`flex items-center justify-center space-x-2 p-3 rounded-lg transition-colors ${
              formData.type === 'transfer_out'
                ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="Transfer money out to another wallet"
          >
            <ArrowRightLeft size={20} />
            <span>Transfer Out</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'transfer_in' } })}
            className={`flex items-center justify-center space-x-2 p-3 rounded-lg transition-colors ${
              formData.type === 'transfer_in'
                ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="Transfer money in from another wallet"
          >
            <ArrowDownUp size={20} />
            <span>Transfer In</span>
          </button>
        </div>

        {/* Amount and Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">{selectedWallet.currency}</span>
              </div>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="block w-full pl-12 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white placeholder-gray-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Calendar size={16} />
              </div>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="block w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Category and Target/Source Wallet (for transfers) */}
        <div className="grid grid-cols-2 gap-4">
          {(formData.type === 'expense' || formData.type === 'income') && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="block w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white"
                required
              >
                <option value="">Select Category</option>
                {getCurrentCategories().map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.type === 'transfer_in' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Transfer from</label>
              <select
                name="fromWalletId"
                value={formData.fromWalletId || ''}
                onChange={handleChange}
                className="block w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white"
                required={formData.type === 'transfer_in'}
              >
                <option value="">Select Source</option>
                <option value="external">External Account</option>
                {wallets
                  .filter(w => w.walletId !== selectedWalletId)
                  .map(wallet => (
                    <option key={wallet.walletId} value={wallet.walletId}>
                      {wallet.name} ({wallet.currency})
                      {wallet.currency !== selectedWallet?.currency ? ' - Different Currency' : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>


        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Note</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Receipt size={16} />
            </div>
            <input
              type="text"
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="Add a note..."
              className="block w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Labels</label>
          <div className="space-y-2">
            {/* Label input */}
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Tag size={16} />
                </div>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Add a label..."
                  className="block w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white placeholder-gray-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddLabel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <PlusCircle size={20} />
              </button>
            </div>
            
            {/* Labels display */}
            <div className="flex flex-wrap gap-2">
              {formData.labels.map(label => (
                <span
                  key={label}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-gray-800 rounded-full text-sm"
                >
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Avoidable Expense Checkbox - Only for expenses */}
        {formData.type === 'expense' && (
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="avoidable"
                checked={formData.avoidable}
                onChange={(e) => setFormData(prev => ({ ...prev, avoidable: e.target.checked }))}
                className="w-4 h-4 text-yellow-500 bg-gray-800 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
              />
              <span className="text-sm text-gray-300">
                This is avoidable
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              Mark expenses that could have been avoided (e.g., impulse purchases, dining out, entertainment)
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-300 font-medium"
        >
          {isSubmitting ? 'Adding...' : 'Add Transaction'}
        </button>
      </form>
    </div>
  );
};

export default AddTransactionForm; 