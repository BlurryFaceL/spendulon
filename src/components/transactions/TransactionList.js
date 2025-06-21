import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useWallets } from '../../context/WalletContext';
import { useCategories } from '../../context/CategoriesContext';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isWithinInterval } from 'date-fns';
import { parseTransactionDate } from '../../utils/dateUtils';
import AddTransactionModal from './AddTransactionModal';
import { 
  ArrowDownRight, 
  ArrowUpRight,
  ArrowRightLeft,
  Tag,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Square,
  CheckSquare,
  Repeat,
  Calendar
} from 'lucide-react';
import { renderIcon } from '../../utils/iconMapping';
import LoadingSpinner from '../ui/LoadingSpinner';

const TransactionList = ({ dateRange = 'current-month', customStartDate, customEndDate, selectedCategory, selectedLabel, transactionTypeFilters = { income: true, expense: true, transfer: true }, showFutureTransactions = false }) => {
  const { formatAmount } = useSettings();
  const { wallets, selectedWalletId, getWalletTransactions, updateTransaction, deleteTransaction, transactionUpdateTrigger } = useWallets();
  const { getCategoryByIdAnyType, getCategoriesByType } = useCategories();
  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  // Bulk selection state
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Helper function to get date range boundaries
  const getDateRange = useCallback(() => {
    const now = new Date();
    
    switch (dateRange) {
      case 'current-month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        };
      case 'last-3-months':
        const threeMonthsAgo = subMonths(now, 3);
        return {
          start: startOfMonth(threeMonthsAgo),
          end: endOfMonth(now)
        };
      case 'current-year':
        return {
          start: startOfYear(now),
          end: endOfYear(now)
        };
      case 'all-time':
        return null; // No filtering
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate)
          };
        }
        return null;
      // Handle analytics date ranges
      case '1month':
        const oneMonthAgo = subMonths(now, 1);
        return {
          start: oneMonthAgo,
          end: now
        };
      case '3months':
        const threeMonthsAgoAnalytics = subMonths(now, 3);
        return {
          start: threeMonthsAgoAnalytics,
          end: now
        };
      case '6months':
        const sixMonthsAgo = subMonths(now, 6);
        return {
          start: sixMonthsAgo,
          end: now
        };
      case '1year':
        const oneYearAgo = subMonths(now, 12);
        return {
          start: oneYearAgo,
          end: now
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  }, [dateRange, customStartDate, customEndDate]);

  // Filter transactions based on date range and category
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Apply category filter
    if (selectedCategory) {
      if (selectedCategory === 'other') {
        // For 'other' category, match transactions with no categoryId or null categoryId
        filtered = filtered.filter(transaction => !transaction.categoryId || transaction.categoryId === 'other');
      } else {
        filtered = filtered.filter(transaction => transaction.categoryId === selectedCategory);
      }
    }
    
    // Apply label filter
    if (selectedLabel) {
      filtered = filtered.filter(transaction => 
        transaction.labels && Array.isArray(transaction.labels) && transaction.labels.includes(selectedLabel)
      );
    }
    
    // Apply transaction type filter
    filtered = filtered.filter(transaction => {
      if (transaction.type === 'income') return transactionTypeFilters.income;
      if (transaction.type === 'expense') return transactionTypeFilters.expense;
      if (transaction.type === 'transfer_in' || transaction.type === 'transfer_out') return transactionTypeFilters.transfer;
      return true; // Show unknown types by default
    });
    
    // Apply date range filter
    const dateRangeFilter = getDateRange();
    if (dateRangeFilter) {
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return isWithinInterval(transactionDate, {
          start: dateRangeFilter.start,
          end: dateRangeFilter.end
        });
      });
    }
    
    // Filter out future transactions if toggle is off
    if (!showFutureTransactions) {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Include all of today
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate <= today;
      });
    }
    
    return filtered;
  }, [transactions, selectedCategory, selectedLabel, transactionTypeFilters, getDateRange, showFutureTransactions]);

  // Fetch transactions when wallet changes
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!selectedWallet) {
        setTransactions([]);
        return;
      }
      
      setLoading(true);
      try {
        // Use cached data from WalletContext which includes optimistic updates
        const walletTransactions = await getWalletTransactions(selectedWallet.walletId);
        setTransactions(walletTransactions || []);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallet?.walletId, transactionUpdateTrigger]);

  // Handle edit transaction
  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
  };

  // Handle delete transaction
  const handleDelete = async (transactionId) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        // Optimistic delete from local state first for immediate UI update
        setTransactions(prev => prev.filter(tx => tx.transactionId !== transactionId));
        
        // Call the delete function (which also does optimistic caching)
        await deleteTransaction(selectedWallet.walletId, transactionId);
        
        // No need to manually refresh - the optimistic update in WalletContext handles this
        // If delete fails, the rollback in WalletContext will restore the transaction
      } catch (error) {
        console.error('Failed to delete transaction:', error);
        // The rollback in WalletContext will automatically restore the transaction
      }
    }
  };


  // Bulk selection handlers
  const handleSelectTransaction = (transactionId) => {
    setSelectedTransactions(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(transactionId)) {
        newSelected.delete(transactionId);
      } else {
        newSelected.add(transactionId);
      }
      
      // Show/hide bulk actions based on selection
      setShowBulkActions(newSelected.size > 0);
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    const allTransactionIds = filteredTransactions.map(tx => tx.transactionId);
    setSelectedTransactions(new Set(allTransactionIds));
    setShowBulkActions(true);
  };

  const handleSelectNone = () => {
    setSelectedTransactions(new Set());
    setShowBulkActions(false);
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0 || bulkDeleting) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedTransactions.size} selected transaction${selectedTransactions.size > 1 ? 's' : ''}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      setBulkDeleting(true);
      
      // Delete transactions one by one
      for (const transactionId of selectedTransactions) {
        await deleteTransaction(selectedWallet.walletId, transactionId);
      }
      
      // Clear selection - no manual refresh needed
      setSelectedTransactions(new Set());
      setShowBulkActions(false);
      // WalletContext handles optimistic updates for deletes
      
    } catch (error) {
      console.error('Failed to delete transactions:', error);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedTransactions(new Set());
    setShowBulkActions(false);
  }, [dateRange, customStartDate, customEndDate, selectedCategory, selectedLabel, transactionTypeFilters]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(transaction => {
      const date = format(parseTransactionDate(transaction.date), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });

    // Sort transactions within each group by priority and creation time
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => {
        // Prioritize imported transactions (those without createdAt timestamp)
        const aIsImported = !a.createdAt || a.source === 'imported';
        const bIsImported = !b.createdAt || b.source === 'imported';
        
        if (aIsImported && !bIsImported) return -1; // a (imported) comes first
        if (!aIsImported && bIsImported) return 1;  // b (imported) comes first
        
        // If both are same type, sort by creation time (newest first)
        return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
      });
    });

    return groups;
  }, [filteredTransactions]);

  // Sort dates (newest first)
  const sortedDates = useMemo(() => {
    return Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));
  }, [groupedTransactions]);

  // Calculate daily totals
  const getDailyTotal = (transactions) => {
    return transactions.reduce((total, tx) => total + tx.amount, 0);
  };

  if (!selectedWallet) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <p className="text-gray-400">Please select a wallet to view transactions</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading transactions..." showLogo={false} />;
  }

  return (
    <div className="space-y-6">
      {/* Bulk Actions Toolbar */}
      {showBulkActions && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 animate-fadeInUp">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare size={20} className="text-blue-400" />
                <span className="text-blue-400 font-medium">
                  {selectedTransactions.size} transaction{selectedTransactions.size > 1 ? 's' : ''} selected
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  Select All ({filteredTransactions.length})
                </button>
                <button
                  onClick={handleSelectNone}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Select None
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {bulkDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Selected
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  setSelectedTransactions(new Set());
                  setShowBulkActions(false);
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Cancel selection"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Selection Controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={selectedTransactions.size === filteredTransactions.length ? handleSelectNone : handleSelectAll}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              {selectedTransactions.size === filteredTransactions.length ? (
                <>
                  <CheckSquare size={16} className="text-blue-400" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square size={16} />
                  Select All
                </>
              )}
            </button>
            
            {selectedTransactions.size > 0 && (
              <span className="text-sm text-gray-400">
                {selectedTransactions.size} of {filteredTransactions.length} selected
              </span>
            )}
          </div>
        </div>
      )}
      {sortedDates.map((date, index) => (
        <div 
          key={date}
          className="bg-gray-900 rounded-xl border border-gray-800 animate-fadeInUp"
          style={{
            animationDelay: `${Math.min(index * 0.05, 0.5)}s`
          }}
        >
          {/* Date header with daily total */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <div>
              <h3 className="font-medium text-white">
                {format(new Date(date), 'MMMM d, yyyy')}
              </h3>
              <p className="text-sm text-gray-400">
                {groupedTransactions[date].length} transactions
              </p>
            </div>
            <div className={`text-lg font-medium ${
              getDailyTotal(groupedTransactions[date]) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatAmount(getDailyTotal(groupedTransactions[date]), selectedWallet.currency)}
            </div>
          </div>

          {/* Transactions */}
          <div className="divide-y divide-gray-800">
            {groupedTransactions[date].map((transaction, txIndex) => {
              // Get category for this transaction - handle legacy data formats
              const getCategoryForTransaction = (tx) => {
                // Try categoryId first (preferred field)
                if (tx.categoryId) {
                  const category = getCategoryByIdAnyType(tx.categoryId);
                  if (category) return category;
                }
                
                // If categoryId doesn't resolve, try category field
                if (tx.category) {
                  // Check if category is a UUID (legacy data)
                  if (typeof tx.category === 'string' && tx.category.length === 36 && tx.category.includes('-')) {
                    const category = getCategoryByIdAnyType(tx.category);
                    if (category) return category;
                  }
                  
                  // If category is already a name, try to find it by name
                  if (typeof tx.category === 'string') {
                    // Search through all categories to find by name
                    for (const type of ['expense', 'income', 'transfer_out', 'transfer_in']) {
                      const typeCategories = getCategoriesByType(type);
                      const found = typeCategories.find(cat => cat.name === tx.category);
                      if (found) return found;
                    }
                  }
                }
                
                return null;
              };
              
              const category = getCategoryForTransaction(transaction);
              
              // Determine icon and color based on transaction type and category
              let Icon = ArrowDownRight;
              let iconColorClass = 'text-red-400';
              let amountColorClass = 'text-red-400';
              let title = '';
              let useCategoryIcon = false;
              

              // Map category colors to Tailwind classes (handle both color names and hex values)
              const colorToClassMap = {
                emerald: 'text-emerald-400 bg-emerald-400/10',
                blue: 'text-blue-400 bg-blue-400/10',
                purple: 'text-purple-400 bg-purple-400/10',
                rose: 'text-rose-400 bg-rose-400/10',
                amber: 'text-amber-400 bg-amber-400/10',
                cyan: 'text-cyan-400 bg-cyan-400/10',
                indigo: 'text-indigo-400 bg-indigo-400/10',
                yellow: 'text-yellow-400 bg-yellow-400/10',
                sky: 'text-sky-400 bg-sky-400/10',
                orange: 'text-orange-400 bg-orange-400/10',
                violet: 'text-violet-400 bg-violet-400/10',
                fuchsia: 'text-fuchsia-400 bg-fuchsia-400/10',
                slate: 'text-slate-400 bg-slate-400/10',
                lime: 'text-lime-400 bg-lime-400/10',
                pink: 'text-pink-400 bg-pink-400/10',
                teal: 'text-teal-400 bg-teal-400/10',
                gray: 'text-gray-400 bg-gray-400/10',
                red: 'text-red-400 bg-red-400/10',
                green: 'text-green-400 bg-green-400/10',
                // Hex color mappings (from database)
                '#10b981': 'text-emerald-400 bg-emerald-400/10', // emerald
                '#3b82f6': 'text-blue-400 bg-blue-400/10',       // blue
                '#8b5cf6': 'text-purple-400 bg-purple-400/10',   // purple
                '#f43f5e': 'text-rose-400 bg-rose-400/10',       // rose
                '#f59e0b': 'text-amber-400 bg-amber-400/10',     // amber
                '#06b6d4': 'text-cyan-400 bg-cyan-400/10',       // cyan
                '#6366f1': 'text-indigo-400 bg-indigo-400/10',   // indigo
                '#eab308': 'text-yellow-400 bg-yellow-400/10',   // yellow
                '#0ea5e9': 'text-sky-400 bg-sky-400/10',         // sky
                '#f97316': 'text-orange-400 bg-orange-400/10',   // orange
                '#7c3aed': 'text-violet-400 bg-violet-400/10',   // violet
                '#d946ef': 'text-fuchsia-400 bg-fuchsia-400/10', // fuchsia
                '#64748b': 'text-slate-400 bg-slate-400/10',     // slate
                '#84cc16': 'text-lime-400 bg-lime-400/10',       // lime
                '#ec4899': 'text-pink-400 bg-pink-400/10',       // pink
                '#14b8a6': 'text-teal-400 bg-teal-400/10',       // teal
                '#6b7280': 'text-gray-400 bg-gray-400/10',       // gray
                '#ef4444': 'text-red-400 bg-red-400/10',         // red
                '#22c55e': 'text-green-400 bg-green-400/10'      // green
              };

              let bgColorClass = 'bg-gray-800';
              
              switch (transaction.type) {
                case 'income':
                  if (category && category.icon) {
                    useCategoryIcon = true;
                    const colorClasses = colorToClassMap[category.color] || 'text-green-400 bg-green-400/10';
                    const [textColor, bgColor] = colorClasses.split(' ');
                    iconColorClass = textColor;
                    bgColorClass = bgColor;
                  } else {
                    Icon = ArrowUpRight;
                    iconColorClass = 'text-green-400';
                    bgColorClass = 'bg-green-400/10';
                  }
                  amountColorClass = 'text-green-400';
                  title = category?.name || 'Income';
                  break;
                case 'transfer_out':
                  Icon = ArrowRightLeft;
                  iconColorClass = 'text-blue-400';
                  bgColorClass = 'bg-blue-400/10';
                  amountColorClass = 'text-blue-400';
                  if (transaction.toWalletId) {
                    const toWallet = wallets.find(w => w.walletId === transaction.toWalletId);
                    title = `Transfer to ${toWallet?.name || 'another wallet'}`;
                  } else {
                    title = `Transfer to ${transaction.externalAccount || 'external account'}`;
                  }
                  break;
                case 'transfer_in':
                  Icon = ArrowRightLeft;
                  iconColorClass = 'text-green-400';
                  bgColorClass = 'bg-green-400/10';
                  amountColorClass = 'text-green-400';
                  if (transaction.fromWalletId) {
                    const fromWallet = wallets.find(w => w.walletId === transaction.fromWalletId);
                    title = `Transfer from ${fromWallet?.name || 'another wallet'}`;
                  } else {
                    title = `Transfer from ${transaction.externalAccount || 'external account'}`;
                  }
                  break;
                case 'external_transfer':
                  Icon = ArrowRightLeft;
                  iconColorClass = 'text-purple-400';
                  bgColorClass = 'bg-purple-400/10';
                  amountColorClass = transaction.amount >= 0 ? 'text-green-400' : 'text-red-400';
                  title = 'External Transfer';
                  break;
                case 'expense':
                default:
                  if (category && category.icon) {
                    useCategoryIcon = true;
                    const colorClasses = colorToClassMap[category.color] || 'text-red-400 bg-red-400/10';
                    const [textColor, bgColor] = colorClasses.split(' ');
                    iconColorClass = textColor;
                    bgColorClass = bgColor;
                  } else {
                    Icon = ArrowDownRight;
                    iconColorClass = 'text-red-400';
                    bgColorClass = 'bg-red-400/10';
                  }
                  // For expenses, ALWAYS show the category name, not "Expense"
                  title = category?.name || 'Uncategorized Expense';
              }

              // Check if transaction is in the future
              const isFutureTransaction = new Date(transaction.date) > new Date();
              
              return (
                <div 
                  key={transaction.transactionId}
                  className={isFutureTransaction ? 'opacity-60' : ''}
                >
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Checkbox for bulk selection */}
                      <button
                        onClick={() => handleSelectTransaction(transaction.transactionId)}
                        className={`p-1 rounded transition-colors ${
                          selectedTransactions.has(transaction.transactionId)
                            ? 'text-blue-400 hover:text-blue-300'
                            : 'text-gray-500 hover:text-gray-400'
                        }`}
                        title={selectedTransactions.has(transaction.transactionId) ? 'Deselect transaction' : 'Select transaction'}
                      >
                        {selectedTransactions.has(transaction.transactionId) ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                      <div className={`p-2 rounded-lg ${bgColorClass} ${iconColorClass}`}>
                        {useCategoryIcon && category?.icon ? 
                          renderIcon(category.icon || 'Wallet', { size: 20 }) : 
                          <Icon size={20} />
                        }
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{title}</h4>
                        <p className="text-sm text-gray-400">{transaction.description}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(transaction.createdAt || transaction.date), 'HH:mm:ss')}
                        </p>
                        {transaction.labels && transaction.labels.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <Tag size={14} className="text-gray-400" />
                            <div className="flex gap-1">
                              {transaction.labels.map(label => (
                                <span
                                  key={label}
                                  className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {transaction.type === 'expense' && transaction.avoidable && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle size={12} className="text-yellow-500" />
                            <span className="text-xs text-yellow-500">Avoidable</span>
                          </div>
                        )}
                        {transaction.recurrence && transaction.recurrence !== 'never' && (
                          <div className="flex items-center gap-1 mt-1">
                            <Repeat size={12} className="text-blue-400" />
                            <span className="text-xs text-blue-400">
                              {transaction.recurrence.charAt(0).toUpperCase() + transaction.recurrence.slice(1)}
                              {transaction.isRecurring && ' (Auto)'}
                            </span>
                          </div>
                        )}
                        {isFutureTransaction && (
                          <div className="flex items-center gap-1 mt-1">
                            <Calendar size={12} className="text-purple-400" />
                            <span className="text-xs text-purple-400">Scheduled</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`font-medium ${amountColorClass}`}>
                        {formatAmount(Math.abs(transaction.amount), selectedWallet.currency)}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                          title="Edit transaction"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.transactionId)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sortedDates.length === 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
          <p className="text-gray-400">No transactions yet</p>
        </div>
      )}
      
      {/* Edit Transaction Modal */}
      <AddTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        editingTransaction={editingTransaction}
        onTransactionUpdated={() => {
          setEditingTransaction(null);
          // The transaction will be updated via optimistic updates in WalletContext
        }}
      />
    </div>
  );
};

export default TransactionList; 