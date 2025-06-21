import React, { useState, useRef } from 'react';
import { useWallets } from '../../context/WalletContext';
import { useCategories } from '../../context/CategoriesContext';
import csvImportService from '../../services/csvImportService';
import { convertToHtmlDateFormat } from '../../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Table,
  Loader2,
  Edit3,
  Check,
  Trash2
} from 'lucide-react';

const CsvImportFlow = ({ onClose }) => {
  const { selectedWalletId, addTransaction, addTransactionsBatch } = useWallets();
  const { getCategoriesByType, addCategory } = useCategories();
  
  // Helper function to get category ID from category name
  const getCategoryIdByName = (categoryName, transactionType) => {
    if (!categoryName) return null;
    
    // Get categories for the transaction type
    const categories = getCategoriesByType(transactionType, true);
    const category = categories.find(cat => cat.name === categoryName);
    return category ? category.id : null;
  };
  
  const fileInputRef = useRef(null);
  
  const [importState, setImportState] = useState('upload'); // upload, mapping, review, complete
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvData, setCsvData] = useState({ headers: [], data: [] });
  const [analysis, setAnalysis] = useState(null);
  const [columnMappings, setColumnMappings] = useState({});
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [importingAll, setImportingAll] = useState(false);
  const [acceptingTransactions, setAcceptingTransactions] = useState(new Set());
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  // Inline category creation states
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Available fields for mapping
  const transactionFields = [
    { value: 'date', label: 'Date', required: true },
    { value: 'amount', label: 'Amount', required: true },
    { value: 'description', label: 'Description', required: false },
    { value: 'category', label: 'Category', required: false },
    { value: 'type', label: 'Transaction Type', required: false },
    { value: 'skip', label: 'Skip this column', required: false }
  ];

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setError(null);
      await processCSVFile(file);
    } else {
      setError('Please select a valid CSV file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError(null);
        await processCSVFile(file);
      } else {
        setError('Please select a valid CSV file');
      }
    }
  };

  const processCSVFile = async (file) => {
    try {
      const text = await file.text();
      const { headers, data } = csvImportService.parseCSV(text);
      
      if (data.length === 0) {
        setError('CSV file contains no data rows');
        return;
      }
      
      setCsvData({ headers, data });
      
      // Analyze data and get suggestions
      const analysisResult = csvImportService.analyzeCsvData(headers, data);
      setAnalysis(analysisResult);
      
      // Set initial mappings based on suggestions
      const initialMappings = {};
      Object.entries(analysisResult.suggestedMappings).forEach(([column, suggestion]) => {
        initialMappings[suggestion] = column;
      });
      setColumnMappings(initialMappings);
      
      setImportState('mapping');
    } catch (error) {
      console.error('Failed to process CSV:', error);
      setError('Failed to process CSV file. Please check the file format.');
    }
  };

  const handleMappingChange = (field, column) => {
    const newMappings = { ...columnMappings };
    
    // Remove any existing mapping for this field
    Object.keys(newMappings).forEach(key => {
      if (newMappings[key] === column && key !== field) {
        delete newMappings[key];
      }
    });
    
    if (column === '') {
      delete newMappings[field];
    } else {
      newMappings[field] = column;
    }
    
    setColumnMappings(newMappings);
  };

  const handleProcessTransactions = () => {
    // Validate required mappings
    if (!columnMappings.date || !columnMappings.amount) {
      setError('Please map at least Date and Amount columns');
      return;
    }
    
    try {
      const transactions = csvImportService.convertToTransactions(csvData.data, columnMappings);
      
      if (transactions.length === 0) {
        setError('No valid transactions could be extracted from the CSV');
        return;
      }
      
      // Add unique IDs to transactions for edit functionality
      const transactionsWithIds = transactions.map((transaction) => ({
        ...transaction,
        id: uuidv4()
      }));
      
      setProcessedTransactions(transactionsWithIds);
      setImportState('review');
    } catch (error) {
      console.error('Failed to process transactions:', error);
      setError('Failed to process transactions. Please check your mappings.');
    }
  };

  const handleImportAll = async () => {
    if (importingAll) return;
    
    try {
      setImportingAll(true);
      setError(null);
      
      // Helper to get category ID
      const getCategoryIdByName = (categoryName, transactionType) => {
        if (!categoryName) return null;
        const categories = getCategoriesByType(transactionType, true);
        const category = categories.find(cat => cat.name === categoryName);
        return category ? category.id : null;
      };
      
      // Prepare all transactions for batch import
      const transactionsForImport = processedTransactions.map(transaction => {
        const categoryId = getCategoryIdByName(transaction.category, transaction.type);
        
        return {
          date: transaction.date,
          amount: transaction.amount,
          note: transaction.description || '',
          categoryId: categoryId || '',
          type: transaction.type,
          source: 'csv_import'
        };
      });
      
      // Import all transactions in batch
      const results = await addTransactionsBatch(selectedWalletId, transactionsForImport);
      
      // Check if any failed
      if (results?.failed > 0) {
        setError(`Imported ${results.successful} transactions successfully. ${results.failed} failed.`);
        // Keep failed transactions in the list for review
        const failedIds = new Set(results.errors?.map(e => e.transaction?.id) || []);
        setProcessedTransactions(prev => prev.filter(t => failedIds.has(t.id)));
      } else {
        setProcessedTransactions([]);
        setImportState('complete');
      }
    } catch (error) {
      console.error('Failed to import transactions:', error);
      setError('Failed to import transactions. Please try again or import in smaller batches.');
    } finally {
      setImportingAll(false);
    }
  };

  const handleAcceptTransaction = async (transactionId) => {
    // Prevent multiple rapid clicks
    if (acceptingTransactions.has(transactionId)) return;
    
    try {
      setAcceptingTransactions(prev => new Set([...prev, transactionId]));
      
      const transaction = processedTransactions.find(t => t.id === transactionId);
      if (!transaction) return;

      // Add transaction to wallet
      const categoryId = getCategoryIdByName(transaction.category, transaction.type);
      await addTransaction(selectedWalletId, {
        date: transaction.date,
        amount: transaction.amount,
        note: transaction.description,
        category: categoryId || '', // Use category ID, fallback to empty string
        type: transaction.type,
        source: 'csv_import'
      });

      // Remove from pending transactions
      setProcessedTransactions(prev => 
        prev.filter(t => t.id !== transactionId)
      );
    } catch (error) {
      console.error('Failed to accept transaction:', error);
      setError('Failed to add transaction. Please try again.');
    } finally {
      setAcceptingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const handleEditTransaction = (transactionId) => {
    const transaction = processedTransactions.find(t => t.id === transactionId);
    if (transaction) {
      // Convert DD-MM-YYYY to YYYY-MM-DD for HTML date input
      const formattedDate = convertToHtmlDateFormat(transaction.date);
      
      setEditFormData({
        date: formattedDate,
        description: transaction.description,
        amount: Math.abs(transaction.amount),
        type: transaction.type,
        category: transaction.category
      });
      setEditingTransactionId(transactionId);
    }
  };

  const handleSaveEdit = async (transactionId) => {
    // Prevent multiple rapid clicks
    if (savingEdit) return;
    
    try {
      setSavingEdit(true);
      
      // Handle amount calculation for all transaction types
      let updatedAmount;
      if (editFormData.type === 'expense' || editFormData.type === 'transfer_out') {
        updatedAmount = -Math.abs(editFormData.amount); // Negative for outgoing money
      } else {
        updatedAmount = Math.abs(editFormData.amount); // Positive for incoming money
      }
      
      const updatedData = {
        date: editFormData.date,
        description: editFormData.description,
        amount: updatedAmount,
        type: editFormData.type,
        category: editFormData.category
      };

      // Update transaction in the pending list
      setProcessedTransactions(prev =>
        prev.map(t => t.id === transactionId ? { ...t, ...updatedData } : t)
      );

      setEditingTransactionId(null);
      setEditFormData({});
    } catch (error) {
      console.error('Failed to save edit:', error);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingTransactionId(null);
    setEditFormData({});
    setShowAddCategory(false);
    setNewCategoryName('');
  };

  // Handle inline category creation
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || creatingCategory) return;
    
    try {
      setCreatingCategory(true);
      
      const newCategory = {
        name: newCategoryName.trim(),
        icon: 'Wallet', // Default icon
        color: 'blue', // Default color
        type: editFormData.type
      };
      
      const createdCategory = await addCategory(editFormData.type, newCategory);
      
      // Update the form data to select the newly created category
      setEditFormData(prev => ({ ...prev, category: createdCategory.name }));
      
      // Reset the add category state
      setShowAddCategory(false);
      setNewCategoryName('');
      
    } catch (error) {
      console.error('Failed to create category:', error);
      setError('Failed to create category. Please try again.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteTransaction = (transactionId) => {
    // Remove transaction from pending list
    setProcessedTransactions(prev => 
      prev.filter(t => t.id !== transactionId)
    );
    
    // Also close edit form if this transaction was being edited
    if (editingTransactionId === transactionId) {
      setEditingTransactionId(null);
      setEditFormData({});
    }
  };

  const renderUploadSection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Import CSV Transactions</h3>
        <p className="text-gray-400">Upload a CSV file containing your transaction data</p>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          selectedFile
            ? 'border-green-500 bg-green-500/10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="space-y-3">
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <div>
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-gray-400 text-sm">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={48} className="mx-auto text-gray-400" />
            <div>
              <p className="text-white font-medium">Click to select file or drag and drop</p>
              <p className="text-gray-400 text-sm">CSV files only</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Choose File
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <AlertCircle size={20} className="text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}
    </div>
  );

  const renderMappingSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Map CSV Columns</h3>
        <p className="text-gray-400 text-sm">
          Match your CSV columns to transaction fields. We've suggested some mappings based on your data.
        </p>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Table size={16} />
          <span>Found {csvData.headers.length} columns and {csvData.data.length} rows</span>
        </div>

        <div className="space-y-3">
          {transactionFields.filter(field => field.value !== 'skip').map(field => (
            <div key={field.value} className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-gray-300">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              
              <select
                value={columnMappings[field.value] || ''}
                onChange={(e) => handleMappingChange(field.value, e.target.value)}
                className="col-span-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select column...</option>
                {csvData.headers.map(header => (
                  <option key={header} value={header}>
                    {header}
                    {analysis?.columnStats[header] && (
                      <span className="text-gray-400">
                        {' '}({analysis.columnStats[header].dataType})
                      </span>
                    )}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Sample data preview */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Sample Data Preview</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {Object.entries(columnMappings).map(([field, column]) => (
                  <th key={field} className="px-3 py-2 text-left text-gray-400">
                    {transactionFields.find(f => f.value === field)?.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvData.data.slice(0, 3).map((row, index) => (
                <tr key={index} className="border-b border-gray-700/50">
                  {Object.entries(columnMappings).map(([field, column]) => (
                    <td key={field} className="px-3 py-2 text-gray-300">
                      {row[column] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <AlertCircle size={20} className="text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => {
            setImportState('upload');
            setError(null);
          }}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={handleProcessTransactions}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Process Transactions
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  const renderReviewSection = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Review Transactions</h3>
          <p className="text-gray-400 text-sm">
            {processedTransactions.length} transactions ready to import
          </p>
        </div>
        
        <button
          onClick={handleImportAll}
          disabled={importingAll || processedTransactions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
        >
          {importingAll ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Importing {processedTransactions.length} transactions...
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              Import All ({processedTransactions.length})
            </>
          )}
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {processedTransactions.slice(0, 10).map((transaction, index) => {
          // Use the ID that was assigned when processing transactions
          const transactionId = transaction.id;
          
          return (
            <div
              key={transactionId}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            >
              {editingTransactionId === transactionId ? (
                // Edit Form
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-blue-400 font-medium">Editing Transaction</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={editFormData.date}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.amount}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                      <select
                        value={editFormData.type}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="income">💰 Income</option>
                        <option value="expense">💸 Expense</option>
                        <option value="transfer_out">↗️ Transfer Out</option>
                        <option value="transfer_in">↙️ Transfer In</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                      {showAddCategory ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Enter new category name"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateCategory();
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleCreateCategory}
                              disabled={!newCategoryName.trim() || creatingCategory}
                              className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                            >
                              {creatingCategory ? 'Creating...' : 'Create'}
                            </button>
                            <button
                              onClick={() => {
                                setShowAddCategory(false);
                                setNewCategoryName('');
                              }}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <select
                            value={editFormData.category}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select Category</option>
                            {getCategoriesByType(editFormData.type, true).map(category => (
                              <option key={category.id} value={category.name}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowAddCategory(true)}
                            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                          >
                            + Add new category
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => handleDeleteTransaction(transactionId)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
                      title="Delete transaction (remove from import)"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(transactionId)}
                        disabled={savingEdit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {savingEdit && <Loader2 size={14} className="animate-spin" />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Display View
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white font-medium">{transaction.date}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.type === 'income' || transaction.type === 'transfer_in'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : transaction.type === 'transfer_out'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {transaction.type === 'income' ? '💰 Income' 
                          : transaction.type === 'expense' ? '💸 Expense'
                          : transaction.type === 'transfer_out' ? '↗️ Transfer Out'
                          : transaction.type === 'transfer_in' ? '↙️ Transfer In'
                          : '💸 Expense'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-medium ${
                        transaction.type === 'income' || transaction.type === 'transfer_in' 
                          ? 'text-green-400' 
                          : transaction.type === 'transfer_out'
                          ? 'text-purple-400'
                          : 'text-red-400'
                      }`}>
                        {transaction.type === 'income' || transaction.type === 'transfer_in' ? '+' : '-'}
                        ₹{Math.abs(transaction.amount).toLocaleString()}
                      </span>
                      <span className="text-gray-400">Category: {transaction.category}</span>
                    </div>
                    
                    {transaction.description && (
                      <p className="text-gray-300 text-sm mt-1">{transaction.description}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditTransaction(transactionId)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleAcceptTransaction(transactionId)}
                      disabled={acceptingTransactions.has(transactionId)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      {acceptingTransactions.has(transactionId) ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Accept
                    </button>
                    
                    <button
                      onClick={() => handleDeleteTransaction(transactionId)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                      title="Delete transaction (remove from import)"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {processedTransactions.length > 10 && (
          <div className="text-center text-gray-400 text-sm py-2">
            ... and {processedTransactions.length - 10} more transactions
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <AlertCircle size={20} className="text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => {
            setImportState('mapping');
            setError(null);
          }}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back to Mapping
        </button>
        
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderCompleteSection = () => (
    <div className="space-y-6 text-center">
      <div>
        <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Import Complete</h3>
        <p className="text-gray-400">
          Successfully imported transactions
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Using our new bulk import system for faster processing!
        </p>
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">CSV Import</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {importState === 'upload' && renderUploadSection()}
      {importState === 'mapping' && renderMappingSection()}
      {importState === 'review' && renderReviewSection()}
      {importState === 'complete' && renderCompleteSection()}
    </div>
  );
};

export default CsvImportFlow;