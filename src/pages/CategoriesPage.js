import React from 'react';
import CategoryManager from '../components/categories/CategoryManager';

const CategoriesPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Categories</h1>
        <p className="text-gray-400 mt-1">Organize your transactions with categories</p>
      </div>
      <CategoryManager />
    </div>
  );
};

export default CategoriesPage;