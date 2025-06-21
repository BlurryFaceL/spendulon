// Generic default categories for all users - using icon names instead of React elements
export const DEFAULT_CATEGORIES = {
  income: [
    // Most frequent to least frequent
    { id: 'salary', name: 'Salary', icon: 'Banknote', color: 'emerald' },
    { id: 'freelance', name: 'Freelance', icon: 'Briefcase', color: 'teal' },
    { id: 'business', name: 'Business', icon: 'Building2', color: 'green' },
    { id: 'bonus', name: 'Bonus', icon: 'DollarSign', color: 'indigo' },
    { id: 'investments', name: 'Investments', icon: 'TrendingUp', color: 'lime' },
    { id: 'dividends', name: 'Dividends', icon: 'DollarSign', color: 'cyan' },
    { id: 'cashback', name: 'Cashback', icon: 'CreditCard', color: 'sky' },
    { id: 'gifts', name: 'Gifts', icon: 'Gift', color: 'blue' },
    { id: 'other-income', name: 'Other Income', icon: 'Wallet', color: 'slate' }
  ],
  expense: [
    // Daily/Weekly (Most frequent)
    { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: 'emerald' },
    { id: 'dining', name: 'Food & Drink', icon: 'Utensils', color: 'orange' },
    { id: 'transport', name: 'Transport', icon: 'Bus', color: 'amber' },
    { id: 'fuel', name: 'Fuel', icon: 'Droplet', color: 'red' },
    
    // Monthly Bills (Regular)
    { id: 'rent', name: 'Rent', icon: 'Building', color: 'purple' },
    { id: 'utilities', name: 'Utilities', icon: 'Zap', color: 'yellow' },
    { id: 'phone', name: 'Phone', icon: 'Smartphone', color: 'indigo' },
    { id: 'internet', name: 'Internet', icon: 'Wifi', color: 'sky' },
    { id: 'subscriptions', name: 'Subscriptions', icon: 'CreditCard', color: 'teal' },
    
    // Regular Purchases
    { id: 'shopping', name: 'Shopping', icon: 'ShoppingBag', color: 'violet' },
    { id: 'healthcare', name: 'Healthcare', icon: 'Heart', color: 'rose' },
    { id: 'medicines', name: 'Medicines', icon: 'Pill', color: 'pink' },
    { id: 'clothing', name: 'Clothing', icon: 'ShoppingBag', color: 'cyan' },
    { id: 'entertainment', name: 'Entertainment', icon: 'Film', color: 'lime' },
    { id: 'fitness', name: 'Fitness', icon: 'Dumbbell', color: 'green' },
    
    // Periodic Expenses
    { id: 'car-maintenance', name: 'Car Maintenance', icon: 'Car', color: 'orange' },
    { id: 'beauty', name: 'Beauty & Personal Care', icon: 'Heart', color: 'fuchsia' },
    { id: 'education', name: 'Education', icon: 'GraduationCap', color: 'blue' },
    { id: 'books', name: 'Books', icon: 'GraduationCap', color: 'violet' },
    { id: 'insurance', name: 'Insurance', icon: 'Heart', color: 'emerald' },
    { id: 'travel', name: 'Travel', icon: 'Plane', color: 'orange' },
    
    // Less Frequent
    { id: 'taxes', name: 'Taxes', icon: 'Building2', color: 'indigo' },
    { id: 'gifts', name: 'Gifts & Donations', icon: 'Gift', color: 'red' },
    { id: 'maintenance', name: 'Maintenance', icon: 'Wrench', color: 'amber' },
    { id: 'home-improvement', name: 'Home Improvement', icon: 'Home', color: 'yellow' },
    { id: 'loans', name: 'Loan Payments', icon: 'Landmark', color: 'red' },
    { id: 'investments', name: 'Investments', icon: 'TrendingUp', color: 'emerald' },
    
    // Catchall
    { id: 'miscellaneous', name: 'Miscellaneous', icon: 'Wallet', color: 'pink' }
  ]
};

// Get categories by type (for transaction forms)
export const getCategoriesByType = (type) => {
  return DEFAULT_CATEGORIES[type] || [];
};

// Get category by ID
export const getCategoryById = (id, type) => {
  const categories = DEFAULT_CATEGORIES[type] || [];
  return categories.find(cat => cat.id === id);
};

// Get all categories
export const getAllCategories = () => {
  return {
    ...DEFAULT_CATEGORIES
  };
};