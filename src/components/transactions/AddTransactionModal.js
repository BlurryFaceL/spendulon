import React, { useState, useEffect } from 'react';
import { useWallets } from '../../context/WalletContext';
import { useCategories } from '../../context/CategoriesContext';
import { X, Tag, Plus } from 'lucide-react';

const AddTransactionModal = ({ isOpen, onClose, onTransactionAdded, editingTransaction = null, onTransactionUpdated }) => {
  const { wallets, selectedWalletId, addTransaction, updateTransaction } = useWallets();
  const { getCategoriesByType, addCategory } = useCategories();
  const selectedWallet = editingTransaction ? 
    wallets.find(w => w.walletId === editingTransaction.walletId) : 
    wallets.find(w => w.walletId === selectedWalletId);
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    amount: '',
    category: '',
    fromWalletId: '', // For transfer_in
    toWalletId: '', // For transfer_out
    externalAccount: '', // For external transfers
    note: '',
    labels: [],
    avoidable: false,
    recurrence: 'never' // never, daily, weekly, biweekly, monthly, yearly
  });

  const [keepOpen, setKeepOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        // Populate form with existing transaction data
        setFormData({
          date: editingTransaction.date,
          type: editingTransaction.type,
          amount: Math.abs(editingTransaction.amount).toString(),
          category: editingTransaction.categoryId || editingTransaction.category || '',
          fromWalletId: editingTransaction.fromWalletId || '',
          toWalletId: editingTransaction.toWalletId || '',
          externalAccount: editingTransaction.externalAccount || '',
          note: editingTransaction.description || '',
          labels: editingTransaction.labels || [],
          avoidable: editingTransaction.avoidable || false,
          recurrence: editingTransaction.recurrence || 'never'
        });
      } else {
        // Reset for new transaction
        setFormData({
          date: new Date().toISOString().split('T')[0],
          type: 'expense',
          amount: '',
          category: '',
          fromWalletId: '',
          toWalletId: '',
          externalAccount: '',
          note: '',
          labels: [],
          avoidable: false,
          recurrence: 'never'
        });
      }
      setNewLabel('');
      setShowAddCategory(false);
      setNewCategoryName('');
    }
  }, [isOpen, editingTransaction]);

  // Get categories based on transaction type
  const getCurrentCategories = () => {
    return getCategoriesByType(formData.type, true);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Clear category and fromWalletId when transaction type changes
      if (name === 'type' && value !== prev.type) {
        newData.category = '';
        newData.fromWalletId = '';
        // Also reset add category state
        setShowAddCategory(false);
        setNewCategoryName('');
      }
      
      return newData;
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWallet || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      if (editingTransaction) {
        // Update existing transaction
        const updateData = {
          date: formData.date,
          type: formData.type,
          amount: parseFloat(formData.amount) * (formData.type === 'expense' || formData.type === 'transfer_out' ? -1 : 1),
          description: formData.note,
          categoryId: formData.category,
          toWalletId: formData.toWalletId || null,
          fromWalletId: formData.fromWalletId || null,
          externalAccount: formData.externalAccount || null,
          labels: formData.labels,
          avoidable: formData.avoidable,
          recurrence: formData.recurrence
        };
        
        await updateTransaction(selectedWallet.walletId, editingTransaction.transactionId, updateData);
        
        if (onTransactionUpdated) {
          onTransactionUpdated();
        }
        onClose();
      } else {
        // Add new transaction
        await addTransaction(selectedWallet.walletId, formData);
        
        if (onTransactionAdded) {
          onTransactionAdded();
        }
        
        // Reset form if keeping open, otherwise close
        if (keepOpen) {
          setFormData({
            date: new Date().toISOString().split('T')[0],
            type: 'expense',
            amount: '',
            category: '',
            fromWalletId: '',
            toWalletId: '',
            externalAccount: '',
            note: '',
            labels: [],
            avoidable: false,
            recurrence: 'never'
          });
          setNewLabel('');
        } else {
          onClose();
        }
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

  // Handle creating new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || creatingCategory) return;
    
    try {
      setCreatingCategory(true);
      
      const newCategory = {
        name: newCategoryName.trim(),
        icon: 'Wallet', // Default icon
        color: 'blue', // Default color
        type: formData.type
      };
      
      const createdCategory = await addCategory(formData.type, newCategory);
      
      // Update the form data to select the newly created category
      setFormData(prev => ({ ...prev, category: createdCategory.id }));
      
      // Reset the add category state
      setShowAddCategory(false);
      setNewCategoryName('');
      
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setCreatingCategory(false);
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !selectedWallet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-5xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main fields row */}
          <div className="flex items-end gap-3 mb-6">
            {/* Transaction Type */}
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
              >
                <option value="expense">💸 Expense</option>
                <option value="income">💰 Income</option>
                <option value="transfer_out">📤 Transfer Out</option>
                <option value="transfer_in">📥 Transfer In</option>
              </select>
            </div>

            {/* Category (for expense/income) or Transfer Wallet (for transfers) */}
            <div className="flex-1">
              {(formData.type === 'expense' || formData.type === 'income') ? (
                <>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                  {showAddCategory ? (
                    <div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Enter new category name"
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreateCategory();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          disabled={!newCategoryName.trim() || creatingCategory}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                        >
                          {creatingCategory ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategory(false);
                            setNewCategoryName('');
                          }}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
                        required
                      >
                        <option value="">Select</option>
                        {getCurrentCategories().map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddCategory(true)}
                        className="px-2 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                        title="Add new category"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </>
              ) : formData.type === 'transfer_in' ? (
                <>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Transfer From</label>
                  <select
                    name="fromWalletId"
                    value={formData.fromWalletId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
                    required={formData.type === 'transfer_in'}
                  >
                    <option value="">Select Source</option>
                    <option value="external">External Account</option>
                    {wallets
                      .filter(w => w.walletId !== selectedWalletId)
                      .map(wallet => (
                        <option key={wallet.walletId} value={wallet.walletId}>
                          {wallet.name} ({wallet.currency})
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Transfer To</label>
                  <select
                    name="fromWalletId"
                    value={formData.fromWalletId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
                    required={formData.type === 'transfer_out'}
                  >
                    <option value="">Select Target</option>
                    <option value="external">External Account</option>
                    {wallets
                      .filter(w => w.walletId !== selectedWalletId)
                      .map(wallet => (
                        <option key={wallet.walletId} value={wallet.walletId}>
                          {wallet.name} ({wallet.currency})
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>

            {/* Date */}
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
                required
              />
            </div>

            {/* Note */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Note</label>
              <input
                type="text"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Add a note..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 text-sm"
              />
            </div>


            {/* Amount */}
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-400 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 text-sm">
                  {selectedWallet.currency === 'INR' ? '₹' : selectedWallet.currency}
                </span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 text-sm"
                  required
                  step="0.01"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors text-sm"
            >
              {isSubmitting ? 'Adding...' : 'Add'}
            </button>
          </div>

          {/* Second row - Labels, Recurrence and Options */}
          <div className="flex items-start gap-3">
            {/* Labels */}
            <div className="w-80">
              <label className="block text-xs font-medium text-gray-400 mb-1">Labels</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Add label..."
                  className="flex-1 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabel(e);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddLabel}
                  className="px-2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              {/* Labels display */}
              {formData.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.labels.map(label => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 px-1 py-0.5 bg-gray-800 rounded text-xs"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(label)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X size={8} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recurrence */}
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-400 mb-1">Recurrence</label>
              <select
                name="recurrence"
                value={formData.recurrence}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Avoidable checkbox (only for expenses) */}
            {formData.type === 'expense' && (
              <div className="w-32">
                <label className="block text-xs font-medium text-gray-400 mb-1">Options</label>
                <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-300 py-2">
                  <input
                    type="checkbox"
                    name="avoidable"
                    checked={formData.avoidable}
                    onChange={(e) => setFormData(prev => ({ ...prev, avoidable: e.target.checked }))}
                    className="w-3 h-3 text-yellow-500 bg-gray-800 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                  />
                  <span className="text-xs">Avoidable</span>
                </label>
              </div>
            )}
          </div>

          {/* Footer with submit button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <div className="flex items-center gap-4">
              {!editingTransaction && (
                <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={keepOpen}
                    onChange={(e) => setKeepOpen(e.target.checked)}
                    className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span>Keep open to add more transactions</span>
                </label>
              )}
              <div className="text-xs text-gray-500">
                Press ESC to close
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !formData.amount || !formData.date}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-300"
            >
              {isSubmitting ? 'Saving...' : (editingTransaction ? 'Update Transaction' : 'Add Transaction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;