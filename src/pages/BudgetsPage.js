import React, { useState, useEffect } from 'react';
import { useCategories } from '../context/CategoriesContext';
import { useWallets } from '../context/WalletContext';
import { useSettings } from '../context/SettingsContext';
import { useBudgets } from '../context/BudgetsContext';
import { Target, Plus, Edit2, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';

const BudgetsPage = () => {
  const { getCategoriesByType } = useCategories();
  const { selectedWalletId, getAnalyticsData } = useWallets();
  const { formatAmount } = useSettings();
  const { budgets, loading, error, addBudget, updateBudget, deleteBudget } = useBudgets();
  const expenseCategories = getCategoriesByType('expense', true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    period: 'monthly'
  });
  
  // Toast notification state
  const [toast, setToast] = useState(null);
  
  // Get transactions from analytics data
  const [allTransactions, setAllTransactions] = useState([]);
  
  useEffect(() => {
    const loadTransactions = async () => {
      if (selectedWalletId) {
        try {
          const analyticsData = await getAnalyticsData(selectedWalletId);
          setAllTransactions(analyticsData.transactions || []);
        } catch (error) {
          console.error('Failed to load transactions for budgets:', error);
          setAllTransactions([]);
        }
      }
    };
    
    loadTransactions();
  }, [selectedWalletId, getAnalyticsData]);
  
  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Calculate spent amount for a category in the current period
  const calculateSpentAmount = (categoryId, period) => {
    if (!allTransactions.length) return 0;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return allTransactions
      .filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transaction.categoryId === categoryId && 
               transaction.type === 'expense' &&
               transactionDate >= startDate &&
               transactionDate <= now;
      })
      .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Check if category already has a budget (for new budgets)
      if (!editingBudget && budgets.some(b => b.categoryId === formData.categoryId)) {
        showToast('Budget already exists for this category', 'error');
        return;
      }
      
      if (editingBudget) {
        // Update budget
        await updateBudget(editingBudget.budgetId, {
          ...formData,
          amount: parseFloat(formData.amount)
        });
        showToast('Budget updated successfully!');
      } else {
        // Add new budget
        await addBudget({
          ...formData,
          amount: parseFloat(formData.amount)
        });
        showToast('Budget created successfully!');
      }
      
      setShowAddModal(false);
      setEditingBudget(null);
      setFormData({ categoryId: '', amount: '', period: 'monthly' });
    } catch (error) {
      showToast(error.toString(), 'error');
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      await deleteBudget(budgetId);
      showToast('Budget deleted successfully!');
    } catch (error) {
      showToast(error.toString(), 'error');
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Budgets</h1>
          <p className="text-gray-400 mt-1">Set and track spending limits for categories</p>
        </div>
        
        <button
          onClick={() => {
            setShowAddModal(true);
            setEditingBudget(null);
            setFormData({ categoryId: '', amount: '', period: 'monthly' });
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
        >
          <Plus size={20} />
          <span>Add Budget</span>
        </button>
      </div>

      {/* Budgets List */}
      <div className="grid gap-4">
        {loading && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
            <p className="text-gray-400">Loading budgets...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-gray-900 rounded-xl border border-red-800 p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        {!loading && budgets.map(budget => {
          const category = expenseCategories.find(c => c.id === budget.categoryId);
          const spent = calculateSpentAmount(budget.categoryId, budget.period);
          const percentage = (spent / budget.amount) * 100;
          const isOverBudget = percentage > 100;
          
          return (
            <div key={budget.budgetId} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                    <Target size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {category?.name || 'Unknown Category'}
                    </h3>
                    <p className="text-sm text-gray-400">{budget.period}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingBudget(budget);
                      setFormData({
                        categoryId: budget.categoryId,
                        amount: budget.amount,
                        period: budget.period
                      });
                      setShowAddModal(true);
                    }}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteBudget(budget.budgetId)}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    Spent: <span className="text-white font-medium">{formatAmount(spent)}</span>
                  </span>
                  <span className="text-gray-400">
                    Budget: <span className="text-white font-medium">{formatAmount(budget.amount)}</span>
                  </span>
                </div>

                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${
                    isOverBudget ? 'text-red-400' : percentage >= 80 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {percentage.toFixed(0)}% used
                  </span>
                  
                  {isOverBudget && (
                    <div className="flex items-center gap-1 text-red-400 text-sm">
                      <AlertCircle size={16} />
                      <span>Over budget by {formatAmount(spent - budget.amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {!loading && budgets.length === 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
            <Target size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No budgets set yet</p>
            <p className="text-gray-500 text-sm mt-1">Click "Add Budget" to get started</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          
          <div className="relative bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingBudget ? 'Edit Budget' : 'Add Budget'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Budget Amount</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Period</label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
                >
                  {editingBudget ? 'Update' : 'Add'} Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'error' 
              ? 'bg-red-900 border border-red-800 text-red-200' 
              : 'bg-green-900 border border-green-800 text-green-200'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle size={20} />
            ) : (
              <CheckCircle size={20} />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;