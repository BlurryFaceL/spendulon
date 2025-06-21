import React, { useState } from 'react';
import { useWallets } from '../../context/WalletContext';
import { useCategories } from '../../context/CategoriesContext';
import { 
  Calendar,
  CreditCard,
  Tag,
  X,
  Check,
  ArrowRightLeft,
  ArrowDownUp,
  Receipt,
  BadgeDollarSign
} from 'lucide-react';

const EditTransactionForm = ({ transaction, onSave, onCancel }) => {
  const { wallets, selectedWalletId } = useWallets();
  const { getCategoriesByType, getCategoryByIdAnyType } = useCategories();
  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId);
  
  // Helper function to resolve category for editing
  const getInitialCategoryValue = () => {
    // Try categoryId first
    if (transaction.categoryId) {
      const category = getCategoryByIdAnyType(transaction.categoryId);
      return category ? category.id : transaction.categoryId;
    }
    
    // Try category field
    if (transaction.category) {
      // If it's a UUID, try to resolve it to get the ID
      if (typeof transaction.category === 'string' && transaction.category.length === 36 && transaction.category.includes('-')) {
        const category = getCategoryByIdAnyType(transaction.category);
        return category ? category.id : transaction.category;
      }
      
      // If it's a name, find the corresponding ID
      if (typeof transaction.category === 'string') {
        for (const type of ['expense', 'income', 'transfer_out', 'transfer_in']) {
          const typeCategories = getCategoriesByType(type);
          const found = typeCategories.find(cat => cat.name === transaction.category);
          if (found) return found.id;
        }
      }
    }
    
    return '';
  };
  
  // Form state initialized with transaction data
  const [formData, setFormData] = useState({
    date: transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0],
    type: transaction.type || 'expense',
    amount: Math.abs(transaction.amount).toString(),
    category: getInitialCategoryValue(),
    toWalletId: transaction.toWalletId || '',
    fromWalletId: transaction.fromWalletId || '',
    note: transaction.description || transaction.note || '',
    labels: transaction.labels || [],
    avoidable: transaction.avoidable || false
  });

  // New label input state
  const [newLabel, setNewLabel] = useState('');
  
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
        newData.toWalletId = '';
        newData.fromWalletId = '';
      }
      
      return newData;
    });
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Prepare updated transaction data
    let calculatedAmount = parseFloat(formData.amount);
    
    // Calculate amount based on transaction type
    if (formData.type === 'expense' || formData.type === 'transfer_out') {
      calculatedAmount = -Math.abs(calculatedAmount); // Negative for outgoing
    } else if (formData.type === 'income' || formData.type === 'transfer_in') {
      calculatedAmount = Math.abs(calculatedAmount); // Positive for incoming
    }
    
    // Prepare the update data, mapping form fields to API fields
    const updateData = {
      date: formData.date,
      type: formData.type,
      amount: calculatedAmount,
      description: formData.note,
      categoryId: formData.category,
      toWalletId: formData.toWalletId,
      fromWalletId: formData.fromWalletId,
      labels: formData.labels,
      avoidable: formData.avoidable
    };
    
    // Remove empty/null values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '' || updateData[key] === null || updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const updatedTransaction = {
      ...transaction,
      ...updateData
    };
    
    onSave(updatedTransaction);
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

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 mt-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'expense' } })}
            className={`flex items-center justify-center space-x-1 p-2 rounded-lg transition-colors text-sm ${
              formData.type === 'expense'
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <CreditCard size={16} />
            <span>Expense</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'income' } })}
            className={`flex items-center justify-center space-x-1 p-2 rounded-lg transition-colors text-sm ${
              formData.type === 'income'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <BadgeDollarSign size={16} />
            <span>Income</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'transfer_out' } })}
            className={`flex items-center justify-center space-x-1 p-2 rounded-lg transition-colors text-sm ${
              formData.type === 'transfer_out'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <ArrowRightLeft size={16} />
            <span>Transfer Out</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange({ target: { name: 'type', value: 'transfer_in' } })}
            className={`flex items-center justify-center space-x-1 p-2 rounded-lg transition-colors text-sm ${
              formData.type === 'transfer_in'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <ArrowDownUp size={16} />
            <span>Transfer In</span>
          </button>
        </div>

        {/* Amount and Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <span className="text-gray-400 text-sm">{selectedWallet?.currency || '₹'}</span>
              </div>
              <input
                type="number"
                step="0.01"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="block w-full pl-8 pr-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
                <Calendar size={14} />
              </div>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="block w-full pl-8 pr-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white text-sm"
                required
              />
            </div>
          </div>
        </div>

        {/* Category and Target/Source Wallet */}
        <div className="grid grid-cols-2 gap-3">
          {(formData.type === 'expense' || formData.type === 'income') && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="block w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white text-sm"
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

          {formData.type === 'transfer_out' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Transfer to Wallet</label>
              <select
                name="toWalletId"
                value={formData.toWalletId}
                onChange={handleChange}
                className="block w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white text-sm"
                required={formData.type === 'transfer_out'}
              >
                <option value="">Select Destination Wallet</option>
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

          {formData.type === 'transfer_in' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Transfer from Wallet</label>
              <select
                name="fromWalletId"
                value={formData.fromWalletId || ''}
                onChange={handleChange}
                className="block w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white text-sm"
                required={formData.type === 'transfer_in'}
              >
                <option value="">Select Source Wallet</option>
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
          <label className="block text-xs font-medium text-gray-400 mb-1">Note</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
              <Receipt size={14} />
            </div>
            <input
              type="text"
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="Add a note..."
              className="block w-full pl-8 pr-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white placeholder-gray-500 text-sm"
            />
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Labels</label>
          <div className="space-y-2">
            {/* Label input */}
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
                  <Tag size={14} />
                </div>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Add a label..."
                  className="block w-full pl-8 pr-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-white placeholder-gray-500 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleAddLabel}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            
            {/* Labels display */}
            <div className="flex flex-wrap gap-1">
              {formData.labels.map(label => (
                <span
                  key={label}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-700 rounded-full text-xs"
                >
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Avoidable Expense Checkbox - Only for expenses */}
        {formData.type === 'expense' && (
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="avoidable"
                checked={formData.avoidable}
                onChange={(e) => setFormData(prev => ({ ...prev, avoidable: e.target.checked }))}
                className="w-4 h-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
              />
              <span className="text-xs text-gray-300">
                This is avoidable
              </span>
            </label>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex space-x-2 pt-2">
          <button
            type="submit"
            className="flex items-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-sm"
          >
            <Check size={16} />
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center space-x-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm"
          >
            <X size={16} />
            <span>Cancel</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditTransactionForm;