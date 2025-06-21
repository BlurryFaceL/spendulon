import React, { useState, useEffect } from 'react';
import TransactionList from '../components/transactions/TransactionList';
import AddTransactionModal from '../components/transactions/AddTransactionModal';
import PdfImportFlow from '../components/transactions/PdfImportFlow';
import CsvImportFlow from '../components/transactions/CsvImportFlow';
import { useCategories } from '../context/CategoriesContext';
import { useWallets } from '../context/WalletContext';
import { Plus, X, Calendar, Tag, Filter, Upload, FileText, File } from 'lucide-react';

const TransactionsPage = () => {
  const { getCategoriesByType } = useCategories();
  const { selectedWalletId, getWalletTransactions } = useWallets();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState(null); // 'pdf' or 'csv'
  
  // Date range filtering
  const [dateRange, setDateRange] = useState('current-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Category and label filtering
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [availableLabels, setAvailableLabels] = useState([]);
  
  // Transaction type filtering
  const [transactionTypeFilters, setTransactionTypeFilters] = useState({
    income: true,
    expense: true,
    transfer: true
  });
  
  // Future transactions toggle
  const [showFutureTransactions, setShowFutureTransactions] = useState(false);
  
  // Get categories for filtering (sorted by usage frequency)
  const expenseCategories = getCategoriesByType('expense', true);
  const incomeCategories = getCategoriesByType('income', true);
  
  // Handle transaction type filter changes
  const handleTransactionTypeFilterChange = (type) => {
    setTransactionTypeFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };
  
  // Fetch available labels from transactions
  useEffect(() => {
    const fetchLabels = async () => {
      if (selectedWalletId) {
        try {
          const transactions = await getWalletTransactions(selectedWalletId);
          const labels = new Set();
          transactions.forEach(tx => {
            if (tx.labels && Array.isArray(tx.labels)) {
              tx.labels.forEach(label => labels.add(label));
            }
          });
          setAvailableLabels([...labels].sort());
        } catch (error) {
          console.error('Error fetching labels:', error);
        }
      }
    };
    
    fetchLabels();
  }, [selectedWalletId, getWalletTransactions]);


  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Transactions</h1>
            <p className="text-gray-400 mt-1">View and manage your transactions</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportModal(!showImportModal)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition-all duration-300 font-medium"
            >
              <Upload size={20} />
              <span>Import</span>
            </button>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all duration-300 font-medium"
            >
              <Plus size={20} />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          {/* Date Range Filter */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Date Range:</span>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'current-month', label: 'This Month' },
                { value: 'last-month', label: 'Last Month' },
                { value: 'last-3-months', label: 'Last 3 Months' },
                { value: 'current-year', label: 'This Year' },
                { value: 'all-time', label: 'All Time' },
                { value: 'custom', label: 'Custom Range' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 ml-4">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Category and Label Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Filters:</span>
            </div>
            
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <optgroup label="Income Categories">
                  {incomeCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Expense Categories">
                  {expenseCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Label Filter */}
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-gray-400" />
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Labels</option>
                {availableLabels.map(label => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type Filters */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Types:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transactionTypeFilters.income}
                    onChange={() => handleTransactionTypeFilterChange('income')}
                    className="w-4 h-4 text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                  />
                  <span className="text-sm text-green-400">Income</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transactionTypeFilters.expense}
                    onChange={() => handleTransactionTypeFilterChange('expense')}
                    className="w-4 h-4 text-red-500 bg-gray-800 border-gray-600 rounded focus:ring-red-500 focus:ring-2"
                  />
                  <span className="text-sm text-red-400">Expenses</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transactionTypeFilters.transfer}
                    onChange={() => handleTransactionTypeFilterChange('transfer')}
                    className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-blue-400">Transfers</span>
                </label>
              </div>
            </div>

            {/* Future Transactions Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Show:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFutureTransactions}
                  onChange={() => setShowFutureTransactions(!showFutureTransactions)}
                  className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                />
                <span className="text-sm text-purple-400">Future Transactions</span>
              </label>
            </div>

            {/* Clear Filters */}
            {(selectedCategory || selectedLabel || !transactionTypeFilters.income || !transactionTypeFilters.expense || !transactionTypeFilters.transfer) && (
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setSelectedLabel('');
                  setTransactionTypeFilters({ income: true, expense: true, transfer: true });
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Choose Import Type</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setImportType('pdf');
                  setShowImportModal(false);
                }}
                className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 hover:border-gray-600"
              >
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <FileText size={24} className="text-red-400" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-medium">PDF Bank Statement</h4>
                  <p className="text-gray-400 text-sm">Import from PDF bank statements with AI categorization</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setImportType('csv');
                  setShowImportModal(false);
                }}
                className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 hover:border-gray-600"
              >
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <File size={24} className="text-green-400" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-medium">CSV File</h4>
                  <p className="text-gray-400 text-sm">Import from CSV with flexible column mapping</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Flows */}
      {importType === 'pdf' && (
        <div className="mb-6">
          <PdfImportFlow onClose={() => setImportType(null)} />
        </div>
      )}
      
      {importType === 'csv' && (
        <div className="mb-6">
          <CsvImportFlow onClose={() => setImportType(null)} />
        </div>
      )}

      <TransactionList 
        dateRange={dateRange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        selectedCategory={selectedCategory}
        selectedLabel={selectedLabel}
        transactionTypeFilters={transactionTypeFilters}
        showFutureTransactions={showFutureTransactions}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onTransactionAdded={() => {
          getWalletTransactions(selectedWalletId);
        }}
      />
    </div>
  );
};

export default TransactionsPage;