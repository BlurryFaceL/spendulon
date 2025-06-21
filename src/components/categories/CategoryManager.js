import React, { useState } from 'react';
import { 
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search
} from 'lucide-react';
import { useCategories } from '../../context/CategoriesContext';
import { useSettings } from '../../context/SettingsContext';
import { renderIcon } from '../../utils/iconMapping';
import IconSelect from '../common/IconSelect';
import ColorSelect from '../common/ColorSelect';

const CategoryManager = () => {
  const { 
    getCategoriesByType, 
    addCategory, 
    updateCategory, 
    deleteCategory,
    resetToDefaults,
    categoryUsageCount
  } = useCategories();
  
  const { hideDefaultCategory } = useSettings();

  // State for active category type (income/expense)
  const [activeType, setActiveType] = useState('expense');

  // State for the category being edited
  const [editingCategory, setEditingCategory] = useState(null);
  
  // State for the new category being added
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: 'Wallet',
    color: 'emerald',
    isInvestment: false
  });
  
  // State for search filter
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for delete confirmation dialog
  const [deletingCategory, setDeletingCategory] = useState(null);

  // Modern Tailwind colors with opacity support (handle both color names and hex values)
  const colors = {
    slate: 'bg-slate-500/90',
    gray: 'bg-gray-500/90',
    zinc: 'bg-zinc-500/90',
    neutral: 'bg-neutral-500/90',
    stone: 'bg-stone-500/90',
    red: 'bg-red-500/90',
    orange: 'bg-orange-500/90',
    amber: 'bg-amber-500/90',
    yellow: 'bg-yellow-500/90',
    lime: 'bg-lime-500/90',
    green: 'bg-green-500/90',
    emerald: 'bg-emerald-500/90',
    teal: 'bg-teal-500/90',
    cyan: 'bg-cyan-500/90',
    sky: 'bg-sky-500/90',
    blue: 'bg-blue-500/90',
    indigo: 'bg-indigo-500/90',
    violet: 'bg-violet-500/90',
    purple: 'bg-purple-500/90',
    fuchsia: 'bg-fuchsia-500/90',
    pink: 'bg-pink-500/90',
    rose: 'bg-rose-500/90',
    // Hex color mappings (from database)
    '#10b981': 'bg-emerald-500/90', // emerald
    '#3b82f6': 'bg-blue-500/90',    // blue
    '#a855f7': 'bg-purple-500/90',  // purple
    '#f43f5e': 'bg-rose-500/90',    // rose
    '#f59e0b': 'bg-amber-500/90',   // amber
    '#06b6d4': 'bg-cyan-500/90',    // cyan
    '#6366f1': 'bg-indigo-500/90',  // indigo
    '#eab308': 'bg-yellow-500/90',  // yellow
    '#0ea5e9': 'bg-sky-500/90',     // sky
    '#f97316': 'bg-orange-500/90',  // orange
    '#d946ef': 'bg-fuchsia-500/90', // fuchsia
    '#64748b': 'bg-slate-500/90',   // slate
    '#84cc16': 'bg-lime-500/90',    // lime
    '#ec4899': 'bg-pink-500/90',    // pink
    '#14b8a6': 'bg-teal-500/90',    // teal
    '#6b7280': 'bg-gray-500/90',    // gray
    '#ef4444': 'bg-red-500/90',     // red
    '#22c55e': 'bg-green-500/90'    // green
  };

  // Note: getAvailableIconNames() is used in IconSelect component

  // Handle adding a new category
  const handleAddCategory = () => {
    if (newCategory.name.trim()) {
      addCategory(activeType, {
        id: newCategory.name.toLowerCase().replace(/\s+/g, '-'),
        ...newCategory
      });
      setNewCategory({ name: '', icon: 'Wallet', color: 'emerald', isInvestment: false });
    }
  };

  // Handle updating a category
  const handleUpdateCategory = (id) => {
    updateCategory(activeType, id, editingCategory);
    setEditingCategory(null);
  };

  // Handle deleting a category
  const handleDeleteCategory = (id) => {
    const category = currentCategories.find(cat => cat.id === id);
    setDeletingCategory(category);
  };

  // Confirm deletion
  const confirmDeleteCategory = async () => {
    if (deletingCategory) {
      try {
        if (deletingCategory.isDefault) {
          // Hide default category instead of deleting
          await hideDefaultCategory(deletingCategory.id);
        } else {
          // Delete custom category
          await deleteCategory(activeType, deletingCategory.id);
        }
        setDeletingCategory(null);
      } catch (error) {
        console.error('Error removing category:', error);
      }
    }
  };

  // Get current categories sorted by usage frequency and filter based on search query
  const currentCategories = getCategoriesByType(activeType, true);
  const filteredCategories = currentCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Category Type Tabs */}
      <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveType('expense')}
          className={`flex-1 px-4 py-2 rounded-md transition-all duration-200 ${
            activeType === 'expense'
              ? 'bg-gradient-to-r from-purple-500/90 to-blue-500/90 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          Expense Categories
        </button>
        <button
          onClick={() => setActiveType('income')}
          className={`flex-1 px-4 py-2 rounded-md transition-all duration-200 ${
            activeType === 'income'
              ? 'bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          Income Categories
        </button>
      </div>

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm('This will reset all categories to defaults and remove your custom categories. Are you sure?')) {
              resetToDefaults();
            }
          }}
          className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded-lg transition-colors text-sm"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Add New Category Section */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 backdrop-blur-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Add New Category</h3>
        <div className="space-y-4">
          {/* First row: Name input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Category Name</label>
            <input
              type="text"
              placeholder="Enter category name"
              value={newCategory.name}
              onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white placeholder-gray-500"
            />
          </div>
          
          {/* Second row: Icon, Color, and Investment checkbox */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Icon</label>
              <IconSelect
                value={newCategory.icon}
                onChange={(iconName) => setNewCategory(prev => ({
                  ...prev,
                  icon: iconName
                }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Color</label>
              <ColorSelect
                value={newCategory.color}
                onChange={(colorName) => setNewCategory(prev => ({
                  ...prev,
                  color: colorName
                }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
              <div className="flex items-center h-[42px]">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCategory.isInvestment}
                    onChange={(e) => setNewCategory(prev => ({
                      ...prev,
                      isInvestment: e.target.checked
                    }))}
                    className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Investment</span>
                </label>
              </div>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAddCategory}
                disabled={!newCategory.name.trim()}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600/90 hover:to-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="h-5 w-5" />
                <span>Add Category</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white placeholder-gray-500"
        />
      </div>

      {/* Categories List */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 backdrop-blur-sm">
        <div className="divide-y divide-gray-800/50">
          {filteredCategories.map((category) => (
            <div key={category.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
              {editingCategory?.id === category.id ? (
                // Edit Mode
                <div className="flex items-center gap-4 flex-1">
                  <IconSelect
                    value={editingCategory.icon}
                    onChange={(iconName) => setEditingCategory(prev => ({
                      ...prev,
                      icon: iconName
                    }))}
                    className="min-w-[150px]"
                  />
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white"
                  />
                  <ColorSelect
                    value={editingCategory.color}
                    onChange={(colorName) => setEditingCategory(prev => ({
                      ...prev,
                      color: colorName
                    }))}
                    className="min-w-[150px]"
                  />
                  <div className="flex items-center">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingCategory.isInvestment || false}
                        onChange={(e) => setEditingCategory(prev => ({
                          ...prev,
                          isInvestment: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="text-sm text-gray-300">Investment</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateCategory(category.id)}
                      className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setEditingCategory(null)}
                      className="p-2 text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-full ${colors[category.color] || 'bg-gray-500/90'} flex items-center justify-center text-white shadow-lg backdrop-blur-sm`}>
                      {renderIcon(category.icon || 'Wallet', { size: 20 })}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{category.name}</span>
                        {category.isInvestment && (
                          <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs rounded-full">
                            Investment
                          </span>
                        )}
                      </div>
                      <span className="text-gray-400 text-sm">
                        {categoryUsageCount[category.id] || 0} transactions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="p-2 text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Category</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-3">
                Are you sure you want to {deletingCategory.isDefault ? 'hide' : 'delete'} the category <span className="font-medium text-white">"{deletingCategory.name}"</span>?
              </p>
              {deletingCategory.isDefault ? (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-200 text-sm">
                    <strong>Note:</strong> This will hide the category from your lists. You can restore it later from settings.
                    Existing transactions will keep their category but may show as "Uncategorized" in some views.
                  </p>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-200 text-sm">
                    <strong>Warning:</strong> All transactions using this category will be permanently deleted. 
                    This action cannot be undone.
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCategory}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  deletingCategory.isDefault 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {deletingCategory.isDefault ? 'Hide Category' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManager; 