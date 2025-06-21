import React from 'react';
import WalletManager from '../components/wallets/WalletManager';

const WalletsPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Wallets</h1>
        <p className="text-gray-400 mt-1">Manage your wallets and accounts</p>
      </div>
      <WalletManager />
    </div>
  );
};

export default WalletsPage;