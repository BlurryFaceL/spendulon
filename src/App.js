import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { awsConfig } from './config/aws-config';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { WalletProvider } from './context/WalletContext';
import { CategoriesProvider } from './context/CategoriesContext';
import { BudgetsProvider } from './context/BudgetsContext';
import LoginPage from './pages/LoginPage';
import DashboardOverview from './pages/DashboardOverview';
import TransactionsPage from './pages/TransactionsPage';
import CategoriesPage from './pages/CategoriesPage';
import WalletsPage from './pages/WalletsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import FilteredTransactionsPage from './pages/FilteredTransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import SettingsPage from './pages/SettingsPage';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Configure Amplify v5
Amplify.configure(awsConfig);

function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <CategoriesProvider>
            <BudgetsProvider>
              <WalletProvider>
              <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <DashboardOverview />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/transactions" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <TransactionsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/categories" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <CategoriesPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/wallets" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <WalletsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/analytics" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <AnalyticsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/transactions/filtered" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <FilteredTransactionsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/budgets" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <BudgetsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/settings" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <SettingsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
              </Routes>
              </WalletProvider>
            </BudgetsProvider>
          </CategoriesProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;