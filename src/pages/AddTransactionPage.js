import React from 'react';
import AddTransactionForm from '../components/transactions/AddTransactionForm';

const AddTransactionPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Add Transaction</h1>
        <p className="text-gray-400 mt-1">Record a new income or expense</p>
      </div>
      <AddTransactionForm />
    </div>
  );
};

export default AddTransactionPage;