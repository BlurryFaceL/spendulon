import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_CATEGORIES } from '../config/categories';
import { DEFAULT_CATEGORY_MAPPINGS } from '../config/defaultCategoryMappings';
import { categoriesService } from '../services/categoriesService';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

// Color mapping to convert hex colors back to color names for consistency
const HEX_TO_COLOR_NAME = {
  '#10b981': 'emerald',
  '#14b8a6': 'teal', 
  '#22c55e': 'green',
  '#6366f1': 'indigo',
  '#84cc16': 'lime',
  '#06b6d4': 'cyan',
  '#0ea5e9': 'sky',
  '#3b82f6': 'blue',
  '#64748b': 'slate',
  '#f97316': 'orange',
  '#f59e0b': 'amber',
  '#ef4444': 'red',
  '#a855f7': 'purple',
  '#eab308': 'yellow',
  '#8b5cf6': 'violet',
  '#f43f5e': 'rose',
  '#ec4899': 'pink',
  '#d946ef': 'fuchsia'
};

const CategoriesContext = createContext();

export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
};

export const CategoriesProvider = ({ children }) => {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [migrated, setMigrated] = useState(false);
  const [categoryUsageCount, setCategoryUsageCount] = useState({});
  const { user } = useAuth();
  const { isDefaultCategoryHidden, settings } = useSettings();

  // Load categories from DynamoDB on mount (when user is available)
  useEffect(() => {
    if (user && !migrated) {
      loadCategoriesFromDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, migrated]);

  const loadCategoriesFromDB = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await categoriesService.getUserCategories();
      const userCategories = response.categories || [];
      
      if (userCategories.length === 0) {
        // No user categories found, check for localStorage migration
        await migrateFromLocalStorage();
      } else {
        // Convert DynamoDB categories to frontend format
        const categoriesMap = {
          expense: [],
          income: []
        };
        
        // Separate default and custom categories from database
        const defaultCategories = userCategories.filter(cat => cat.isDefault);
        const customCategories = userCategories.filter(cat => !cat.isDefault);
        
        // Use database defaults (with correct icons/colors), filtering out hidden ones
        defaultCategories.forEach(cat => {
          const shouldHide = isDefaultCategoryHidden && typeof isDefaultCategoryHidden === 'function' 
            ? isDefaultCategoryHidden(cat.categoryId) 
            : false;
          
          if (categoriesMap[cat.type] && !shouldHide) {
            // Convert hex color back to color name for consistency with frontend
            const colorName = HEX_TO_COLOR_NAME[cat.color] || cat.color;
            
            categoriesMap[cat.type].push({
              id: cat.categoryId,
              name: cat.name,
              icon: cat.icon,
              color: colorName,
              isDefault: true,
              isInvestment: cat.isInvestment || false
            });
          }
        });
        
        // If no defaults found in DB, fall back to frontend constants (also filtered)
        ['expense', 'income'].forEach(type => {
          if (categoriesMap[type].length === 0) {
            const defaultCats = DEFAULT_CATEGORIES[type]
              .filter(cat => {
                const mappedId = DEFAULT_CATEGORY_MAPPINGS[cat.name] || cat.id;
                const shouldHide = isDefaultCategoryHidden && typeof isDefaultCategoryHidden === 'function' 
                  ? isDefaultCategoryHidden(mappedId) 
                  : false;
                return !shouldHide;
              })
              .map(cat => ({
                ...cat,
                id: DEFAULT_CATEGORY_MAPPINGS[cat.name] || cat.id,
                isDefault: true,
                icon: cat.icon,
                color: cat.color
              }));
            categoriesMap[type] = defaultCats;
          }
        });
        
        // Add custom categories from DynamoDB
        customCategories.forEach(cat => {
          if (categoriesMap[cat.type]) {
            categoriesMap[cat.type].push({
              id: cat.categoryId,
              name: cat.name,
              icon: cat.icon,
              color: cat.color,
              isDefault: false,
              isInvestment: cat.isInvestment || false
            });
          }
        });
        
        setCategories(categoriesMap);
      }
      
      setMigrated(true);
    } catch (error) {
      setError('Failed to load categories');
      // Fall back to localStorage or defaults
      loadCategoriesFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesFromLocalStorage = () => {
    const savedCategories = localStorage.getItem('spendulon-categories');
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        setCategories(parsed);
      } catch (error) {
        setCategories(DEFAULT_CATEGORIES);
      }
    }
  };

  const migrateFromLocalStorage = async () => {
    const savedCategories = localStorage.getItem('spendulon-categories');
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        
        // Find custom categories (non-default ones)
        const customCategories = [];
        
        ['expense', 'income'].forEach(type => {
          const typeCategories = parsed[type] || [];
          const defaultIds = DEFAULT_CATEGORIES[type].map(cat => cat.id);
          
          typeCategories.forEach(cat => {
            if (!defaultIds.includes(cat.id)) {
              customCategories.push({
                ...cat,
                type,
                categoryId: cat.id
              });
            }
          });
        });
        
        if (customCategories.length > 0) {
          await categoriesService.bulkCreateUserCategories(customCategories);
        }
        
        // Clear localStorage after successful migration
        localStorage.removeItem('spendulon-categories');
        
        // Reload from DB to get the migrated data
        await loadCategoriesFromDB();
        
      } catch (error) {
        // Keep localStorage data if migration fails
        loadCategoriesFromLocalStorage();
      }
    }
  };

  // Add a new category
  const addCategory = async (type, category) => {
    try {
      setError(null);
      const categoryData = {
        name: category.name,
        type: type,
        icon: category.icon || 'Circle',
        color: category.color || '#6366f1',
        isDefault: false
      };
      
      const newCategory = await categoriesService.createUserCategory(categoryData);
      
      // Reload categories from database to ensure sync
      await loadCategoriesFromDB();
      
      return newCategory;
    } catch (error) {
      console.error('Error adding category:', error);
      setError('Failed to add category');
      throw error;
    }
  };

  // Update an existing category
  const updateCategory = async (type, categoryId, updatedCategory) => {
    try {
      setError(null);
      const updated = await categoriesService.updateUserCategory(categoryId, updatedCategory);
      
      setCategories(prev => ({
        ...prev,
        [type]: prev[type].map(cat => 
          cat.id === categoryId ? { 
            id: updated.categoryId,
            name: updated.name,
            icon: updated.icon,
            color: updated.color,
            isDefault: updated.isDefault,
            isInvestment: updated.isInvestment || false
          } : cat
        )
      }));
      
      return updated;
    } catch (error) {
      console.error('Error updating category:', error);
      setError('Failed to update category');
      throw error;
    }
  };

  // Delete a category
  const deleteCategory = async (type, categoryId) => {
    try {
      setError(null);
      await categoriesService.deleteUserCategory(categoryId);
      
      setCategories(prev => ({
        ...prev,
        [type]: prev[type].filter(cat => cat.id !== categoryId)
      }));
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category');
      throw error;
    }
  };

  // Update category usage count from transactions (count only)
  const updateCategoryUsageFromTransactions = useCallback((transactions) => {
    const usageCount = {};
    
    // Count category usage
    transactions.forEach(transaction => {
      if (transaction.categoryId) {
        usageCount[transaction.categoryId] = (usageCount[transaction.categoryId] || 0) + 1;
      }
    });
    
    setCategoryUsageCount(usageCount);
  }, []);

  // Get categories by type with sorting options
  const getCategoriesByType = useCallback((type, sortByUsage = false) => {
    // For transfers, use the appropriate base categories
    let categoriesList;
    if (type === 'transfer_out') {
      categoriesList = categories['expense'] || [];
    } else if (type === 'transfer_in') {
      categoriesList = categories['income'] || [];
    } else {
      categoriesList = categories[type] || [];
    }
    
    // Filter out hidden default categories
    if (isDefaultCategoryHidden) {
      categoriesList = categoriesList.filter(cat => {
        if (cat.isDefault && isDefaultCategoryHidden(cat.id)) {
          return false;
        }
        return true;
      });
    }
    
    // Sort by usage frequency if requested
    if (sortByUsage) {
      return [...categoriesList].sort((a, b) => {
        const countA = categoryUsageCount[a.id] || 0;
        const countB = categoryUsageCount[b.id] || 0;
        
        // Sort by transaction count (descending), then by name
        if (countB !== countA) {
          return countB - countA;
        }
        return a.name.localeCompare(b.name);
      });
    }
    
    return categoriesList;
  }, [categories, categoryUsageCount, isDefaultCategoryHidden, settings.hiddenDefaultCategories]);

  // Get category by ID and type
  const getCategoryById = (id, type) => {
    const typeCategories = categories[type] || [];
    return typeCategories.find(cat => cat.id === id);
  };

  // Get category by ID from any type (for when type is unknown)
  const getCategoryByIdAnyType = (id) => {
    if (!id) return null;
    
    // Try all types including transfer types
    for (const type of ['expense', 'income', 'transfer_out', 'transfer_in']) {
      const typeCategories = getCategoriesByType(type);
      const found = typeCategories.find(cat => cat.id === id);
      if (found) return found;
    }
    
    // If not found, check if it's an ID from the default categories
    // This handles cases where transactions were created before category changes
    for (const type of ['expense', 'income']) {
      const defaultCategories = DEFAULT_CATEGORIES[type] || [];
      const found = defaultCategories.find(cat => cat.id === id);
      if (found) return found;
    }
    
    // If still not found, return a fallback category instead of null
    // This prevents "Uncategorized" from appearing in the UI
    return {
      id: 'miscellaneous',
      name: 'Miscellaneous',
      icon: 'Wallet',
      color: 'pink',
      isDefault: true
    };
  };

  // Reset to default categories
  const resetToDefaults = async () => {
    try {
      setError(null);
      // Delete all user categories from DynamoDB
      const allCategories = [...categories.expense, ...categories.income];
      const userCategories = allCategories.filter(cat => !cat.isDefault);
      
      for (const cat of userCategories) {
        try {
          await categoriesService.deleteUserCategory(cat.id);
        } catch (error) {
          // 404 errors are expected for categories that don't exist in DynamoDB yet
          // Only log non-404 errors
          if (!error.includes && !error.message?.includes('404')) {
            console.error('Error deleting category:', cat.id, error);
          }
        }
      }
      
      setCategories(DEFAULT_CATEGORIES);
      localStorage.removeItem('spendulon-categories');
    } catch (error) {
      console.error('Error resetting categories:', error);
      setError('Failed to reset categories');
      throw error;
    }
  };

  const value = {
    categories,
    loading,
    error,
    getCategoriesByType,
    getCategoryById,
    getCategoryByIdAnyType,
    addCategory,
    updateCategory,
    deleteCategory,
    resetToDefaults,
    loadCategoriesFromDB,
    updateCategoryUsageFromTransactions,
    categoryUsageCount
  };

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
};