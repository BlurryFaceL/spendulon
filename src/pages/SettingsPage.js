import React from 'react';
import SettingsPageComponent from '../components/settings/SettingsPage';

const SettingsPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Customize your application preferences</p>
      </div>
      <SettingsPageComponent />
    </div>
  );
};

export default SettingsPage;