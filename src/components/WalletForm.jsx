import React, { useState } from 'react';
import { useWallets } from '../context/WalletContext';

export const WalletForm = ({ onSuccess }) => {
  const { addWallet } = useWallets();
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank',
    currency: 'USD',
    isDefault: false,
    icon: 'building-2'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addWallet(formData);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create wallet:', error);
      // Handle error (show toast, error message, etc.)
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Wallet Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>
      {/* Add other form fields */}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
      >
        Create Wallet
      </button>
    </form>
  );
}; 