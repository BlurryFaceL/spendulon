import React, { useState, useRef } from 'react';
import { useWallets } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import pdfImportService from '../../services/pdfImportService';
import { convertToHtmlDateFormat } from '../../utils/dateUtils';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Download,
  Edit3,
  Check,
  Trash2
} from 'lucide-react';

const PdfImportFlow = ({ onClose }) => {
  const { selectedWalletId, addTransaction, addTransactionsBatch } = useWallets();
  const { user } = useAuth();
  const { getCategoriesByType, getCategoryByIdAnyType, addCategory } = useCategories();
  
  // Helper function to get category ID from category name
  const getCategoryIdByName = (categoryName, transactionType) => {
    if (!categoryName) return null;
    
    // Get categories for the transaction type
    const categories = getCategoriesByType(transactionType, true);
    const category = categories.find(cat => cat.name === categoryName);
    return category ? category.id : null;
  };
  const fileInputRef = useRef(null);
  
  const [importState, setImportState] = useState('upload'); // upload, processing, review, complete
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [error, setError] = useState(null);
  const [currentWaitingMessage, setCurrentWaitingMessage] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  
  // Inline category creation states
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  
  // Loading states to prevent multiple rapid clicks
  const [acceptingTransactions, setAcceptingTransactions] = useState(new Set());
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Fun waiting messages
  const waitingMessages = [
    "🔍 Reading your PDF like a detective...",
    "🤖 Teaching AI what 'coffee at 3 AM' means...",
    "💰 Counting pennies and sorting receipts...",
    "🧠 Our ML model is having deep thoughts about your spending...",
    "📊 Crunching numbers faster than you crunch snacks...",
    "🎯 Categorizing transactions with laser precision...",
    "🔮 Predicting if that purchase was really 'essential'...",
    "📋 Making sense of bank statement hieroglyphics...",
    "🎨 Painting a picture of your financial habits...",
    "⚡ Processing at the speed of really fast processing...",
    "🕵️ Investigating mysterious bank fees...",
    "🎪 Juggling debits, credits, and the occasional typo...",
    "🚀 Launching transactions into the correct categories...",
    "🎭 Performing financial theater for an audience of one...",
    "🍕 Distinguishing between 'food' and 'definitely food'...",
    "🎲 Rolling the AI dice of categorization...",
    "📚 Reading between the lines of your statement...",
    "🎪 Teaching elephants to never forget your expenses..."
  ];

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
      setNeedsPassword(false);
      setPdfPassword('');
      setIsPasswordProtected(false);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please select a valid PDF file');
      }
    }
  };

  const uploadToS3 = async (file) => {
    setImportState('processing');
    setUploadProgress(0);
    setError(null);
    
    // Start rotating waiting messages
    let messageIndex = 0;
    setCurrentWaitingMessage(waitingMessages[0]);
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % waitingMessages.length;
      setCurrentWaitingMessage(waitingMessages[messageIndex]);
    }, 3000); // Change message every 3 seconds
    
    // Declare progress interval at function scope
    let progressInterval = null;
    
    try {
      // Get auth token
      const { Auth } = await import('aws-amplify');
      const session = await Auth.currentSession();
      const authToken = session.getIdToken().getJwtToken();
      
      // Create a smooth progress simulation
      const simulateProgress = () => {
        let currentProgress = 0;
        progressInterval = setInterval(() => {
          currentProgress += Math.random() * 3 + 1; // Increment by 1-4% randomly
          if (currentProgress >= 95) {
            currentProgress = 95; // Stop at 95% until we get actual results
            clearInterval(progressInterval);
          }
          setUploadProgress(currentProgress);
        }, 200); // Update every 200ms for smooth animation
        return progressInterval;
      };
      
      simulateProgress();
      
      // Upload and process PDF with progress tracking
      const result = await pdfImportService.uploadAndProcessPdf(
        file, 
        user.sub || user.userId, 
        selectedWalletId, 
        authToken,
        isPasswordProtected ? pdfPassword : null, // Only send password if checkbox is checked
        (progress) => {
          // Real S3 upload progress (if we get it) - but we're using simulation instead
          // This callback is now mainly for error handling or completion
        }
      );
      
      // Clear the progress simulation
      clearInterval(progressInterval);
      
      // Handle response from updated PDF Lambda (includes categories)
      if (result.transactions) {
        const transactions = result.transactions.map((tx, index) => ({
          id: `imported-${index}`,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type || (tx.amount > 0 ? 'income' : 'expense'),
          category: tx.category || 'Other',
          confidence: tx.category_confidence || 0.5,
          ml_prediction: tx.ml_prediction || {},
          isImported: true,
          original: tx // Store original for feedback
        }));
        
        setProcessedTransactions(transactions);
        setUploadProgress(100);
        setImportState('review');
      } else if (result.s3Key) {
        // If we need to poll for results
        await pollForResults(result.s3Key, authToken, messageInterval);
      } else {
        throw new Error('Unexpected response format');
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      // Clear the progress simulation on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Check if error is related to password protection
      if (error.message && (error.message.includes('password') || error.message.includes('encrypted'))) {
        if (!isPasswordProtected) {
          setIsPasswordProtected(true);
          setError('This PDF is password protected. Please check the password protection option and enter the password.');
        } else {
          setNeedsPassword(true);
          setError('Incorrect password. Please check your password and try again.');
        }
      } else {
        setError(error.message || 'Failed to process the PDF file. Please try again.');
      }
      
      setImportState('upload');
      setUploadProgress(0);
    } finally {
      // Clear message rotation
      clearInterval(messageInterval);
    }
  };

  const pollForResults = async (s3Key, authToken, messageInterval) => {
    const maxPolls = 30; // 30 * 2 seconds = 1 minute max
    let polls = 0;
    
    // Continue smooth progress from 95% to 100%
    const finishProgress = () => {
      const finishInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 1;
          if (newProgress >= 100) {
            clearInterval(finishInterval);
            return 100;
          }
          return newProgress;
        });
      }, 100);
    };
    
    const poll = async () => {
      try {
        polls++;
        // Don't manually set progress here, let the smooth simulation handle it
        
        const results = await pdfImportService.getCategorizedTransactions(s3Key, authToken);
        
        if (results.categorized_transactions && results.categorized_transactions.length > 0) {
          const transactions = results.categorized_transactions.map((tx, index) => ({
            id: `imported-${index}`,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type || (tx.amount > 0 ? 'income' : 'expense'),
            category: tx.category,
            confidence: tx.confidence || 0.5,
            isImported: true,
            original: tx
          }));
          
          setProcessedTransactions(transactions);
          finishProgress(); // Smooth finish from current progress to 100%
          setImportState('review');
          clearInterval(messageInterval); // Stop message rotation
          return;
        }
        
        if (polls < maxPolls) {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          clearInterval(messageInterval);
          throw new Error('Processing timeout - please try again');
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(messageInterval);
        setError('Failed to get processing results. Please try again.');
        setImportState('upload');
      }
    };
    
    // Start polling after a short delay
    setTimeout(poll, 2000);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await uploadToS3(selectedFile);
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
        source: 'imported'
      });

      // Store ML feedback when user accepts (confirms their choice)
      try {
        const { Auth } = await import('aws-amplify');
        const session = await Auth.currentSession();
        const authToken = session.getIdToken().getJwtToken();
        
        await pdfImportService.storeMlFeedback(
          transaction.original,
          transaction, // User accepted/confirmed this categorization
          authToken,
          selectedWalletId
        );
      } catch (error) {
        console.error('Failed to store ML feedback:', error);
      }

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

      // Update transaction in the pending list (no ML feedback storage during edit)
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

  const handleAcceptAll = async () => {
    // Prevent multiple rapid clicks
    if (acceptingAll) return;
    
    try {
      setAcceptingAll(true);
      console.log('🚀 Accept All: Processing', processedTransactions.length, 'transactions');
      
      // Prepare all transactions for batch import
      const validTransactions = [];
      const mlFeedbackData = [];
      
      for (const [index, transaction] of processedTransactions.entries()) {
        console.log(`📝 Processing transaction ${index + 1}/${processedTransactions.length}:`, {
          date: transaction.date,
          amount: transaction.amount,
          category: transaction.category,
          type: transaction.type,
          description: transaction.description
        });
        
        // Validate transaction has required fields
        if (!transaction.amount || transaction.amount === undefined || transaction.amount === null) {
          console.error('Skipping transaction with missing amount:', transaction);
          continue;
        }
        
        if (!transaction.date) {
          console.error('Skipping transaction with missing date:', transaction);
          continue;
        }

        const categoryId = getCategoryIdByName(transaction.category, transaction.type);
        const transactionData = {
          date: transaction.date,
          amount: transaction.amount,
          note: transaction.description || '',
          category: categoryId || '', // Use category ID, fallback to empty string
          type: transaction.type || (transaction.amount > 0 ? 'income' : 'expense'),
          source: 'imported'
        };
        
        validTransactions.push(transactionData);
        mlFeedbackData.push({
          original: transaction.original,
          processed: transaction
        });
      }
      
      // Import all transactions in batch
      console.log(`✅ Batch importing ${validTransactions.length} transactions`);
      const results = await addTransactionsBatch(selectedWalletId, validTransactions);
      
      if (results?.failed > 0) {
        console.error(`⚠️ Import completed with errors: ${results.successful} successful, ${results.failed} failed`);
        setError(`Imported ${results.successful} transactions successfully. ${results.failed} failed.`);
      } else {
        console.log(`✓ All transactions imported successfully`);
      }

      // Store ML feedback for all transactions
      try {
        const { Auth } = await import('aws-amplify');
        const session = await Auth.currentSession();
        const authToken = session.getIdToken().getJwtToken();
        
        for (const feedback of mlFeedbackData) {
          try {
            await pdfImportService.storeMlFeedback(
              feedback.original,
              feedback.processed,
              authToken,
              selectedWalletId
            );
          } catch (error) {
            console.error('Failed to store ML feedback for one transaction:', error);
          }
        }
      } catch (error) {
        console.error('Failed to store ML feedback:', error);
      }

      console.log('✅ Accept All completed successfully!');
      setProcessedTransactions([]);
      setImportState('complete');
    } catch (error) {
      console.error('Failed to accept all transactions:', error);
      setError('Failed to add some transactions. Please try again.');
    } finally {
      setAcceptingAll(false);
    }
  };

  const renderUploadSection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Import Bank Statement</h3>
        <p className="text-gray-400">Upload a PDF bank statement to automatically import transactions</p>
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
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="space-y-3">
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <div>
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-gray-400 text-sm">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={48} className="mx-auto text-gray-400" />
            <div>
              <p className="text-white font-medium">Click to select file or drag and drop</p>
              <p className="text-gray-400 text-sm">PDF bank statements only</p>
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

      {/* Password protection checkbox and field */}
      {selectedFile && (
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPasswordProtected}
              onChange={(e) => {
                setIsPasswordProtected(e.target.checked);
                if (!e.target.checked) {
                  setPdfPassword('');
                  setNeedsPassword(false);
                }
              }}
              className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm text-gray-300">
              This PDF is password protected
            </span>
          </label>

          {isPasswordProtected && (
            <div className="space-y-2 ml-7">
              <label className="block text-sm font-medium text-gray-400">
                PDF Password
              </label>
              <input
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="Enter PDF password"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {needsPassword && (
                <p className="text-sm text-yellow-400">
                  ⚠️ Incorrect password. Please try again.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <AlertCircle size={20} className="text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        
        <button
          onClick={handleUpload}
          disabled={!selectedFile}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            selectedFile
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          Process PDF
        </button>
      </div>
    </div>
  );

  const renderProcessingSection = () => (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Processing PDF</h3>
        <p className="text-gray-400">Our AI is working its magic...</p>
      </div>

      <div className="space-y-4">
        <Loader2 size={48} className="mx-auto text-blue-500 animate-spin" />
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-white">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(uploadProgress)}%` }}
            />
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4 min-h-[60px] flex items-center justify-center">
          <p className="text-blue-300 text-sm font-medium animate-pulse">
            {currentWaitingMessage || "🚀 Getting ready to process..."}
          </p>
        </div>
        
        <div className="text-xs text-gray-500">
          Upload and processing typically takes 30-60 seconds
        </div>
      </div>
    </div>
  );

  const renderReviewSection = () => {
    // If no transactions remain, show completion state instead of empty review
    if (processedTransactions.length === 0) {
      return renderCompleteSection();
    }
    
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Review Transactions</h3>
            <p className="text-gray-400 text-sm">
              {processedTransactions.length} transactions found. Review and accept or edit as needed.
            </p>
          </div>
          
          {processedTransactions.length > 0 && (
            <button
              onClick={handleAcceptAll}
              disabled={acceptingAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {acceptingAll ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Accept All
            </button>
          )}
        </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {processedTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            {editingTransactionId === transaction.id ? (
              // Edit Form
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-blue-400 font-medium">Editing Transaction</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    transaction.confidence > 0.8 
                      ? 'bg-green-500/20 text-green-400'
                      : transaction.confidence > 0.6
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {Math.round(transaction.confidence * 100)}% confidence
                  </span>
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
                    onClick={() => handleDeleteTransaction(transaction.id)}
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
                      onClick={() => handleSaveEdit(transaction.id)}
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
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      transaction.confidence > 0.8 
                        ? 'bg-blue-500/20 text-blue-400'
                        : transaction.confidence > 0.6
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {Math.round(transaction.confidence * 100)}% confidence
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
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEditTransaction(transaction.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                  
                  <button
                    onClick={() => handleAcceptTransaction(transaction.id)}
                    disabled={acceptingTransactions.has(transaction.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    {acceptingTransactions.has(transaction.id) ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Accept
                  </button>
                  
                  <button
                    onClick={() => handleDeleteTransaction(transaction.id)}
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
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setImportState('upload')}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back to Upload
        </button>
        
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
    );
  };

  const renderCompleteSection = () => (
    <div className="space-y-6 text-center">
      <div>
        <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Import Complete</h3>
        <p className="text-gray-400">All transactions have been successfully imported to your wallet</p>
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
        <h2 className="text-xl font-bold text-white">Import Transactions</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {importState === 'upload' && renderUploadSection()}
      {importState === 'processing' && renderProcessingSection()}
      {importState === 'review' && renderReviewSection()}
      {importState === 'complete' && renderCompleteSection()}
    </div>
  );
};

export default PdfImportFlow;