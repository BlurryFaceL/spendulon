import React from 'react';
import { useSettings, SUPPORTED_CURRENCIES } from '../../context/SettingsContext';

const SettingsPage = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 divide-y divide-gray-800/50 backdrop-blur-sm">
        {/* Currency Settings */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-white mb-4">Currency Settings</h3>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Select Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white"
            >
              {Object.entries(SUPPORTED_CURRENCIES).map(([code, currency]) => (
                <option key={code} value={code}>
                  {currency.symbol} - {currency.name} ({code})
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              This will be used throughout the app for displaying amounts
            </p>
          </div>
        </div>

        {/* Date Format Settings */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-white mb-4">Date Settings</h3>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Date Format
            </label>
            <select
              value={settings.dateFormat}
              onChange={(e) => updateSettings({ dateFormat: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white"
            >
              <option value="MM/dd/yyyy">MM/DD/YYYY</option>
              <option value="dd/MM/yyyy">DD/MM/YYYY</option>
              <option value="yyyy-MM-dd">YYYY-MM-DD</option>
            </select>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Start of Week
            </label>
            <select
              value={settings.startOfWeek}
              onChange={(e) => updateSettings({ startOfWeek: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-white mb-4">Theme Settings</h3>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Theme
            </label>
            <select
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage; 