import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

// List of supported currencies with symbols and formatting options
export const SUPPORTED_CURRENCIES = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US'
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN'
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'en-EU'
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB'
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    locale: 'ja-JP'
  }
};

const DEFAULT_SETTINGS = {
  currency: 'INR',
  theme: 'dark',
  dateFormat: 'MM/dd/yyyy',
  startOfWeek: 'monday',
  hiddenDefaultCategories: []
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [migrated, setMigrated] = useState(false);
  const { user } = useAuth();

  // Apply theme to document
  useEffect(() => {
    const applyTheme = () => {
      const { theme } = settings;
      const root = document.documentElement;
      
      if (theme === 'system') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
        // Apply appropriate background
        document.body.style.backgroundColor = prefersDark ? '#030712' : '#f9fafb';
      } else if (theme === 'light') {
        root.classList.remove('dark');
        document.body.style.backgroundColor = '#f9fafb';
      } else {
        root.classList.add('dark');
        document.body.style.backgroundColor = '#030712';
      }
    };

    applyTheme();

    // Listen for system theme changes if using system theme
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme]);

  // Load settings from DynamoDB on mount (when user is available)
  useEffect(() => {
    if (user && !migrated) {
      loadSettingsFromDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, migrated]);

  const loadSettingsFromDB = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await settingsService.getUserSettings();
      const userSettings = response.settings;
      
      // Check if settings match defaults (indicating no custom settings yet)
      const isDefaultSettings = 
        userSettings.currency === DEFAULT_SETTINGS.currency &&
        userSettings.theme === DEFAULT_SETTINGS.theme &&
        userSettings.dateFormat === DEFAULT_SETTINGS.dateFormat &&
        userSettings.startOfWeek === DEFAULT_SETTINGS.startOfWeek &&
        (!userSettings.hiddenDefaultCategories || userSettings.hiddenDefaultCategories.length === 0);
      
      if (isDefaultSettings) {
        // Check for localStorage migration
        await migrateFromLocalStorage();
      } else {
        setSettings(userSettings);
      }
      
      setMigrated(true);
    } catch (error) {
      setError('Failed to load settings');
      // Fall back to localStorage or defaults
      loadSettingsFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadSettingsFromLocalStorage = () => {
    const savedSettings = localStorage.getItem('spendulon_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch (error) {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  };

  const migrateFromLocalStorage = async () => {
    const savedSettings = localStorage.getItem('spendulon_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        
        // Check if settings are different from defaults
        const hasCustomSettings = 
          parsed.currency !== DEFAULT_SETTINGS.currency ||
          parsed.theme !== DEFAULT_SETTINGS.theme ||
          parsed.dateFormat !== DEFAULT_SETTINGS.dateFormat ||
          parsed.startOfWeek !== DEFAULT_SETTINGS.startOfWeek;
        
        if (hasCustomSettings) {
          await settingsService.updateUserSettings(parsed);
          setSettings(parsed);
        }
        
        // Clear localStorage after successful migration
        localStorage.removeItem('spendulon_settings');
        
      } catch (error) {
        // Keep localStorage data if migration fails
        loadSettingsFromLocalStorage();
      }
    }
  };

  // Format amount according to currency settings
  const formatAmount = (amount, currencyCode = null) => {
    const currency = SUPPORTED_CURRENCIES[currencyCode || settings.currency];
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code
    }).format(amount);
  };

  const updateSettings = async (newSettings) => {
    try {
      setError(null);
      const updatedSettings = { ...settings, ...newSettings };
      
      // Update in DynamoDB
      const response = await settingsService.updateUserSettings(updatedSettings);
      
      // Ensure hiddenDefaultCategories is preserved
      const finalSettings = {
        ...response.settings,
        hiddenDefaultCategories: response.settings.hiddenDefaultCategories || updatedSettings.hiddenDefaultCategories || []
      };
      
      setSettings(finalSettings);
      
      return finalSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      setError('Failed to update settings');
      // Still update locally for immediate feedback
      setSettings(prev => ({ ...prev, ...newSettings }));
      throw error;
    }
  };

  // Hide a default category for this user
  const hideDefaultCategory = async (categoryId) => {
    const currentHidden = settings.hiddenDefaultCategories || [];
    if (!currentHidden.includes(categoryId)) {
      const newHidden = [...currentHidden, categoryId];
      await updateSettings({ hiddenDefaultCategories: newHidden });
    }
  };

  // Show a previously hidden default category
  const showDefaultCategory = async (categoryId) => {
    const currentHidden = settings.hiddenDefaultCategories || [];
    const newHidden = currentHidden.filter(id => id !== categoryId);
    await updateSettings({ hiddenDefaultCategories: newHidden });
  };

  // Check if a default category is hidden
  const isDefaultCategoryHidden = (categoryId) => {
    const hiddenCategories = settings.hiddenDefaultCategories || [];
    return hiddenCategories.includes(categoryId);
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      error,
      updateSettings,
      formatAmount,
      loadSettingsFromDB,
      hideDefaultCategory,
      showDefaultCategory,
      isDefaultCategoryHidden,
      SUPPORTED_CURRENCIES
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};