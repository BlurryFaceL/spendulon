import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallets } from '../context/WalletContext';
import { useCategories } from '../context/CategoriesContext';
import { useSettings } from '../context/SettingsContext';
import { parseTransactionDate } from '../utils/dateUtils';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  PieChart,
  BarChart3,
  Target,
  CalendarDays,
  ArrowRightLeft,
  Tag,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { renderIcon } from '../utils/iconMapping';
import { StatCardSkeleton, AnalyticsChartSkeleton } from '../components/ui/SkeletonLoader';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { wallets, selectedWalletId, getAnalyticsData } = useWallets();
  const { getCategoryByIdAnyType } = useCategories();
  const { formatAmount } = useSettings();

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-emerald-400">
            {selectedWallet ? formatAmount(data.value, selectedWallet.currency) : '0'}
          </p>
          <p className="text-gray-400 text-sm">{data.percentage}% of expenses</p>
          <p className="text-gray-400 text-sm">{data.count} transactions</p>
        </div>
      );
    }
    return null;
  };
  const [analyticsData, setAnalyticsData] = useState({ transactions: [], totalIncome: 0, totalExpenses: 0 });
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('6months');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [useCustomRange, setUseCustomRange] = useState(false);
  
  const selectedWallet = wallets.find(w => w.walletId === selectedWalletId) || wallets[0];

  // Memoized function to handle category click
  const handleCategoryClick = useCallback((categoryData) => {
    // Build query parameters for filtered transactions
    const params = new URLSearchParams();
    params.set('categoryId', categoryData.id || 'other');
    params.set('categoryName', categoryData.name);
    
    // Add current date range
    if (useCustomRange && customDateRange.startDate && customDateRange.endDate) {
      params.set('dateRange', 'custom');
      params.set('startDate', customDateRange.startDate);
      params.set('endDate', customDateRange.endDate);
    } else {
      params.set('dateRange', timeRange);
    }
    
    navigate(`/transactions/filtered?${params.toString()}`);
  }, [navigate, useCustomRange, customDateRange.startDate, customDateRange.endDate, timeRange]);

  // Fetch analytics data with caching
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (selectedWallet) {
        setLoading(true);
        try {
          const customStart = useCustomRange ? customDateRange.startDate : null;
          const customEnd = useCustomRange ? customDateRange.endDate : null;
          
          const data = await getAnalyticsData(
            selectedWallet.walletId, 
            timeRange, 
            customStart, 
            customEnd
          );
          setAnalyticsData(data);
        } catch (error) {
          console.error('Error fetching analytics:', error);
          setAnalyticsData({ transactions: [], totalIncome: 0, totalExpenses: 0 });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();
  }, [selectedWallet, getAnalyticsData, timeRange, useCustomRange, customDateRange.startDate, customDateRange.endDate]);

  // Extract data from cached analytics
  const { 
    transactions: filteredTransactions, 
    totalIncome, 
    totalExpenses, 
    totalTransferIn = 0, 
    totalTransferOut = 0, 
    totalAvoidableExpenses = 0,
    totalInvestments = 0,
    totalSpending = 0,
    savingsRateExcludingInvestments = 0,
    netFlow 
  } = analyticsData;




  // Memoized category breakdowns
  const categoryBreakdowns = useMemo(() => {
    // Expense Category breakdown
    const expenseBreakdown = filteredTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((acc, tx) => {
        const category = getCategoryByIdAnyType(tx.categoryId);
        const categoryId = tx.categoryId || 'other';
        const categoryName = category?.name || 'Uncategorized';
        
        if (!acc[categoryId]) {
          acc[categoryId] = {
            name: categoryName,
            amount: 0,
            count: 0,
            color: category?.color || 'slate',
            id: categoryId
          };
        }
        
        acc[categoryId].amount += Math.abs(tx.amount);
        acc[categoryId].count += 1;
        return acc;
      }, {});
      
    return { expenseBreakdown };
  }, [filteredTransactions, getCategoryByIdAnyType]);

  const { expenseBreakdown } = categoryBreakdowns;

  // Income Category breakdown
  const incomeBreakdown = filteredTransactions
    .filter(tx => tx.type === 'income')
    .reduce((acc, tx) => {
      const category = getCategoryByIdAnyType(tx.categoryId);
      const categoryId = tx.categoryId || 'other';
      const categoryName = category?.name || 'Uncategorized';
      
      if (!acc[categoryId]) {
        acc[categoryId] = {
          name: categoryName,
          amount: 0,
          count: 0,
          color: category?.color || 'emerald',
          id: categoryId
        };
      }
      
      acc[categoryId].amount += Math.abs(tx.amount);
      acc[categoryId].count += 1;
      return acc;
    }, {});

  // Label breakdown by transaction type - memoized for performance
  const labelBreakdown = useMemo(() => {
    const breakdown = {};
    
    filteredTransactions.forEach(tx => {
      if (tx.labels && Array.isArray(tx.labels)) {
        tx.labels.forEach(label => {
          if (!breakdown[label]) {
            breakdown[label] = {
              name: label,
              totalAmount: 0,
              totalCount: 0,
              income: { amount: 0, count: 0 },
              expense: { amount: 0, count: 0 },
              transfer: { amount: 0, count: 0 },
              transactions: []
            };
          }
          
          const amount = Math.abs(tx.amount);
          const type = tx.toWalletId ? 'transfer' : (tx.amount >= 0 ? 'income' : 'expense');
          
          breakdown[label].totalAmount += amount;
          breakdown[label].totalCount += 1;
          breakdown[label][type].amount += amount;
          breakdown[label][type].count += 1;
          breakdown[label].transactions.push(tx);
        });
      }
    });
    
    return breakdown;
  }, [filteredTransactions]);

  // Transfer breakdown (both in and out)
  const transferBreakdown = filteredTransactions
    .filter(tx => tx.type === 'transfer_in' || tx.type === 'transfer_out')
    .reduce((acc, tx) => {
      let transferType;
      if (tx.type === 'transfer_in') {
        transferType = tx.fromWalletId ? 'From Internal Wallet' : 'From External Account';
      } else {
        transferType = tx.toWalletId ? 'To Internal Wallet' : 'To External Account';
      }
      
      if (!acc[transferType]) {
        acc[transferType] = {
          amount: 0,
          count: 0,
          color: tx.type === 'transfer_in' ? 'blue' : 'purple',
          id: transferType.toLowerCase().replace(/\s+/g, '-')
        };
      }
      
      acc[transferType].amount += Math.abs(tx.amount);
      acc[transferType].count += 1;
      return acc;
    }, {});

  // Sort and prepare data for all pie charts
  const sortedExpenseCategories = Object.values(expenseBreakdown)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const sortedIncomeCategories = Object.values(incomeBreakdown)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const sortedTransferCategories = Object.entries(transferBreakdown)
    .sort(([,a], [,b]) => b.amount - a.amount);

  // Calculate total transfers
  const totalTransfers = Object.values(transferBreakdown).reduce((sum, data) => sum + data.amount, 0);

  // Prepare pie chart data for expenses
  const expensePieData = sortedExpenseCategories.map((data) => {
    const fullCategory = getCategoryByIdAnyType(data.id);
    return {
      name: data.name,
      value: data.amount,
      count: data.count,
      color: data.color,
      icon: fullCategory?.icon || 'Wallet',
      id: data.id,
      percentage: totalExpenses > 0 ? ((data.amount / totalExpenses) * 100).toFixed(1) : 0
    };
  });

  // Prepare pie chart data for income
  const incomePieData = sortedIncomeCategories.map((data) => {
    const fullCategory = getCategoryByIdAnyType(data.id);
    return {
      name: data.name,
      value: data.amount,
      count: data.count,
      color: data.color,
      icon: fullCategory?.icon || 'DollarSign',
      id: data.id,
      percentage: totalIncome > 0 ? ((data.amount / totalIncome) * 100).toFixed(1) : 0
    };
  });

  // Prepare pie chart data for transfers
  const transferPieData = sortedTransferCategories.map(([categoryName, data]) => ({
    name: categoryName,
    value: data.amount,
    count: data.count,
    color: data.color,
    icon: 'ArrowRightLeft', // Transfer icon
    id: data.id,
    percentage: totalTransfers > 0 ? ((data.amount / totalTransfers) * 100).toFixed(1) : 0
  }));

  // Enhanced color mapping with Tailwind CSS colors for consistency
  const CHART_COLORS = {
    emerald: '#10b981',  // emerald-500
    blue: '#3b82f6',     // blue-500
    purple: '#a855f7',   // purple-500
    rose: '#f43f5e',     // rose-500
    amber: '#f59e0b',    // amber-500
    cyan: '#06b6d4',     // cyan-500
    indigo: '#6366f1',   // indigo-500
    yellow: '#eab308',   // yellow-500
    sky: '#0ea5e9',      // sky-500
    orange: '#f97316',   // orange-500
    violet: '#8b5cf6',   // violet-500
    fuchsia: '#d946ef',  // fuchsia-500
    slate: '#64748b',    // slate-500
    lime: '#84cc16',     // lime-500
    pink: '#ec4899',     // pink-500
    teal: '#14b8a6',     // teal-500
    gray: '#6b7280',     // gray-500
    red: '#ef4444',      // red-500
    green: '#22c55e'     // green-500
  };

  // Balance over time (for line chart)
  const balanceOverTime = (() => {
    if (!selectedWallet) return [];
    
    // Sort transactions by date
    const sortedTransactions = [...filteredTransactions].sort((a, b) => parseTransactionDate(a.date) - parseTransactionDate(b.date));
    
    // Start with wallet's current balance and work backwards
    let runningBalance = selectedWallet.balance;
    
    // First, calculate what the balance was at the start of the period
    // by subtracting all transactions from current balance
    for (let i = sortedTransactions.length - 1; i >= 0; i--) {
      runningBalance -= sortedTransactions[i].amount;
    }
    
    // Now build the balance history
    const balanceHistory = [{
      date: sortedTransactions[0]?.date || new Date().toISOString().split('T')[0],
      balance: runningBalance,
      formattedDate: parseTransactionDate(sortedTransactions[0]?.date || new Date().toISOString().split('T')[0]).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }];
    
    // Add balance after each transaction
    sortedTransactions.forEach(tx => {
      runningBalance += tx.amount;
      balanceHistory.push({
        date: tx.date,
        balance: runningBalance,
        formattedDate: parseTransactionDate(tx.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      });
    });
    
    return balanceHistory;
  })();

  // Monthly trends
  const monthlyData = filteredTransactions.reduce((acc, tx) => {
    const monthKey = parseTransactionDate(tx.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
    
    if (!acc[monthKey]) {
      acc[monthKey] = { income: 0, expenses: 0, transferIn: 0, transferOut: 0 };
    }
    
    if (tx.type === 'income') {
      acc[monthKey].income += tx.amount;
    } else if (tx.type === 'expense') {
      acc[monthKey].expenses += Math.abs(tx.amount);
    } else if (tx.type === 'transfer_in') {
      acc[monthKey].transferIn += tx.amount;
    } else if (tx.type === 'transfer_out') {
      acc[monthKey].transferOut += Math.abs(tx.amount);
    }
    
    return acc;
  }, {});

  const monthlyTrends = Object.entries(monthlyData)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .slice(-6);

  // Key metrics
  const averageMonthlyIncome = monthlyTrends.length > 0 
    ? monthlyTrends.reduce((sum, [, data]) => sum + data.income, 0) / monthlyTrends.length 
    : 0;
    
  const averageMonthlyExpenses = monthlyTrends.length > 0 
    ? monthlyTrends.reduce((sum, [, data]) => sum + data.expenses, 0) / monthlyTrends.length 
    : 0;

  // Calculate savings rate excluding investments (investments are savings, not expenses)
  const totalSpendingOnly = totalExpenses - totalInvestments;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpendingOnly) / totalIncome * 100) : 0;

  const stats = [
    {
      name: 'Total Income',
      value: selectedWallet ? formatAmount(totalIncome, selectedWallet.currency) : '0',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      name: 'Total Expenses', 
      value: selectedWallet ? formatAmount(totalSpendingOnly, selectedWallet.currency) : '0',
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      name: 'Transfers In',
      value: selectedWallet ? formatAmount(totalTransferIn, selectedWallet.currency) : '0',
      icon: ArrowRightLeft,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      name: 'Transfers Out', 
      value: selectedWallet ? formatAmount(totalTransferOut, selectedWallet.currency) : '0',
      icon: ArrowRightLeft,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    {
      name: 'Net Flow',
      value: selectedWallet ? formatAmount(netFlow, selectedWallet.currency) : '0',
      icon: DollarSign,
      color: netFlow >= 0 ? 'text-emerald-500' : 'text-red-500',
      bgColor: netFlow >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
    },
    {
      name: 'Savings Rate',
      value: `${savingsRate.toFixed(1)}%`,
      icon: Target,
      color: savingsRate >= 20 ? 'text-emerald-500' : savingsRate >= 10 ? 'text-yellow-500' : 'text-red-500',
      bgColor: savingsRate >= 20 ? 'bg-emerald-500/10' : savingsRate >= 10 ? 'bg-yellow-500/10' : 'bg-red-500/10'
    },
    {
      name: 'Investments',
      value: selectedWallet ? formatAmount(totalInvestments, selectedWallet.currency) : '0',
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      name: 'Avoidable Expenses',
      value: selectedWallet ? formatAmount(totalAvoidableExpenses, selectedWallet.currency) : '0',
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10'
    }
  ];

  // Reusable Pie Chart Component
  const PieChartComponent = ({ data, title, icon: Icon, emptyMessage, total, onCategoryClick }) => {
    const [localHoveredCategory, setLocalHoveredCategory] = useState(null);
    
    return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon size={20} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      
      {data.length > 0 ? (
        <div className="space-y-4">
          {/* Pie Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(data, index) => setLocalHoveredCategory(data.name)}
                  onMouseLeave={() => setLocalHoveredCategory(null)}
                  onClick={(data) => onCategoryClick && onCategoryClick({ id: data.id, name: data.name })}
                  style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[entry.color] || CHART_COLORS.gray}
                      stroke={localHoveredCategory === entry.name ? '#ffffff' : 'none'}
                      strokeWidth={localHoveredCategory === entry.name ? 2 : 0}
                      style={{
                        filter: localHoveredCategory === entry.name ? 'brightness(1.1)' : 'none',
                        transform: localHoveredCategory === entry.name ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: 'center',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Category Legend */}
          <div className="space-y-2">
            {data.map((category) => (
              <div 
                key={category.name} 
                className={`flex justify-between items-center p-2 rounded transition-colors cursor-pointer ${
                  localHoveredCategory === category.name ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                }`}
                onMouseEnter={() => setLocalHoveredCategory(category.name)}
                onMouseLeave={() => setLocalHoveredCategory(null)}
                onClick={() => onCategoryClick && onCategoryClick({ id: category.id, name: category.name })}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CHART_COLORS[category.color] || CHART_COLORS.gray }}
                    ></div>
                    {category.icon && renderIcon(category.icon, { 
                      size: 16, 
                      className: `text-${category.color}-400`,
                      style: { color: CHART_COLORS[category.color] || CHART_COLORS.gray }
                    })}
                  </div>
                  <span className="text-white text-sm">{category.name}</span>
                  <span className="text-blue-400 text-sm font-medium ml-2">{category.percentage}%</span>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm font-medium">
                    {selectedWallet ? formatAmount(category.value, selectedWallet.currency) : '0'}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {category.count} transactions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <Icon size={48} className="text-gray-600 mb-4" />
          <p className="text-gray-400 text-center">{emptyMessage}</p>
        </div>
      )}
    </div>
    );
  };


  if (loading && !analyticsData.transactions.length) {
    return (
      <div>
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-gray-400 mt-1">Insights into your spending patterns</p>
            </div>
          </div>
        </div>

        {/* Skeleton Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsChartSkeleton />
          <AnalyticsChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-gray-400 mt-1">Insights into your spending patterns</p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
              {[
                { key: '1month', label: '1M' },
                { key: '3months', label: '3M' },
                { key: '6months', label: '6M' },
                { key: '1year', label: '1Y' },
                { key: 'all-time', label: 'All' }
              ].map(range => (
                <button
                  key={range.key}
                  onClick={() => {
                    setTimeRange(range.key);
                    setUseCustomRange(false);
                  }}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    timeRange === range.key && !useCustomRange
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {range.label}
                </button>
              ))}
              <button
                onClick={() => setUseCustomRange(!useCustomRange)}
                className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                  useCustomRange
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CalendarDays size={14} />
                Custom
              </button>
            </div>
            
            {/* Custom Date Range */}
            {useCustomRange && (
              <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg">
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6 hover:bg-gray-900/80 transition-all duration-300 transform hover:scale-[1.02] group animate-fadeInUp"
              style={{
                animationDelay: `${index * 0.05}s`
              }}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon size={20} className={`${stat.color} sm:w-6 sm:h-6`} />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 line-clamp-2">{stat.name}</p>
              <p className="text-lg sm:text-2xl font-semibold mt-1 text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Balance Over Time Chart */}
      <div className="mb-8 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={20} className="text-green-500" />
            <h3 className="text-lg font-semibold text-white">Account Balance</h3>
          </div>
          
          {balanceOverTime.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={balanceOverTime}
                  margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    fontSize={12}
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => selectedWallet ? formatAmount(value, selectedWallet.currency) : value}
                  />
                  <Tooltip 
                    labelStyle={{ color: '#fff' }}
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [
                      selectedWallet ? formatAmount(value, selectedWallet.currency) : value, 
                      'Balance'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke={balanceOverTime.length > 0 && balanceOverTime[balanceOverTime.length - 1].balance >= 0 ? '#10b981' : '#ef4444'}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const isNegative = payload && payload.balance < 0;
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={4} 
                          fill={isNegative ? '#ef4444' : '#10b981'} 
                          stroke={isNegative ? '#ef4444' : '#10b981'} 
                          strokeWidth={2} 
                        />
                      );
                    }}
                    activeDot={(props) => {
                      const { cx, cy, payload } = props;
                      const isNegative = payload && payload.balance < 0;
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={6} 
                          fill="#fff" 
                          stroke={isNegative ? '#ef4444' : '#10b981'} 
                          strokeWidth={2} 
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-400 text-center">No transaction data available for selected period</p>
            </div>
          )}
        </div>
      </div>

      {/* Pie Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
        <PieChartComponent 
          data={expensePieData}
          title="Expense Categories"
          icon={PieChart}
          emptyMessage="No expense data available for selected period"
          total={totalExpenses}
          onCategoryClick={handleCategoryClick}
        />
        
        <PieChartComponent 
          data={incomePieData}
          title="Income Sources"
          icon={TrendingUp}
          emptyMessage="No income data available for selected period"
          total={totalIncome}
          onCategoryClick={handleCategoryClick}
        />
        
        <PieChartComponent 
          data={transferPieData}
          title="Transfer Types"
          icon={ArrowRightLeft}
          emptyMessage="No transfer data available for selected period"
          total={totalTransfers}
          onCategoryClick={handleCategoryClick}
        />
      </div>

      {/* Tag Insights Section */}
      {Object.keys(labelBreakdown).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Tag size={20} className="text-amber-500" />
            <h3 className="text-lg font-semibold text-white">Tag Insights</h3>
          </div>
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(labelBreakdown)
                .sort(([,a], [,b]) => b.totalAmount - a.totalAmount)
                .slice(0, 6) // Show top 6 labels
                .map(([label, data]) => (
                  <div key={label} className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-white font-medium text-sm">{data.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{data.totalCount} txn</span>
                    </div>
                    
                    <div className="text-right mb-3">
                      <div className="text-white font-semibold">
                        {selectedWallet ? formatAmount(data.totalAmount, selectedWallet.currency) : '0'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {totalIncome + totalExpenses > 0 ? 
                          ((data.totalAmount / (totalIncome + totalExpenses)) * 100).toFixed(1) : 0}% of total
                      </div>
                    </div>

                    {/* Transaction type breakdown */}
                    <div className="space-y-1">
                      {data.expense.count > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-red-400">Expenses ({data.expense.count})</span>
                          <span className="text-red-400">
                            {selectedWallet ? formatAmount(data.expense.amount, selectedWallet.currency) : '0'}
                          </span>
                        </div>
                      )}
                      {data.income.count > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-green-400">Income ({data.income.count})</span>
                          <span className="text-green-400">
                            {selectedWallet ? formatAmount(data.income.amount, selectedWallet.currency) : '0'}
                          </span>
                        </div>
                      )}
                      {data.transfer.count > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-blue-400">Transfers ({data.transfer.count})</span>
                          <span className="text-blue-400">
                            {selectedWallet ? formatAmount(data.transfer.amount, selectedWallet.currency) : '0'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            
            {Object.keys(labelBreakdown).length > 6 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-400">
                  Showing top 6 of {Object.keys(labelBreakdown).length} labels
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
        {/* Monthly Trends */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={20} className="text-purple-500" />
            <h3 className="text-lg font-semibold text-white">Monthly Trends</h3>
          </div>
          
          <div className="space-y-4">
            {monthlyTrends.length > 0 ? monthlyTrends.map(([month, data]) => {
              const maxAmount = Math.max(
                ...monthlyTrends.map(([, d]) => Math.max(d.income, d.expenses, d.transferIn || 0, d.transferOut || 0))
              );
              
              return (
                <div key={month} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm font-medium">{month}</span>
                    <div className="text-right grid grid-cols-2 gap-2 text-xs">
                      <div className="text-emerald-400">
                        +{selectedWallet ? formatAmount(data.income, selectedWallet.currency) : '0'}
                      </div>
                      <div className="text-red-400">
                        -{selectedWallet ? formatAmount(data.expenses, selectedWallet.currency) : '0'}
                      </div>
                      {(data.transferIn > 0 || data.transferOut > 0) && (
                        <>
                          <div className="text-blue-400">
                            In: {selectedWallet ? formatAmount(data.transferIn || 0, selectedWallet.currency) : '0'}
                          </div>
                          <div className="text-orange-400">
                            Out: {selectedWallet ? formatAmount(data.transferOut || 0, selectedWallet.currency) : '0'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Income Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16">Income</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: maxAmount > 0 ? `${(data.income / maxAmount) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Expense Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16">Expense</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-red-500"
                        style={{ width: maxAmount > 0 ? `${(data.expenses / maxAmount) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Transfer In Bar */}
                  {(data.transferIn > 0) && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16">Transfer In</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: maxAmount > 0 ? `${(data.transferIn / maxAmount) * 100}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Transfer Out Bar */}
                  {(data.transferOut > 0) && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16">Transfer Out</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-orange-500"
                          style={{ width: maxAmount > 0 ? `${(data.transferOut / maxAmount) * 100}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="text-gray-400 text-center py-8">No trend data available</p>
            )}
          </div>
        </div>


        {/* Top Categories This Period */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target size={20} className="text-yellow-500" />
            <h3 className="text-lg font-semibold text-white">Top Categories This Period</h3>
          </div>
          
          <div className="space-y-4">
            {/* Top Expense Categories */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Top Expenses</h4>
              <div className="space-y-2">
                {expensePieData.slice(0, 5).map((category, index) => (
                  <div 
                    key={category.name} 
                    className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => handleCategoryClick({ id: category.id, name: category.name })}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-400">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {category.icon && renderIcon(category.icon, { 
                          size: 14, 
                          className: `text-${category.color}-400`,
                          style: { color: CHART_COLORS[category.color] || CHART_COLORS.gray }
                        })}
                        <span className="text-white text-sm">{category.name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm">
                        {selectedWallet ? formatAmount(category.value, selectedWallet.currency) : '0'}
                      </div>
                      <div className="text-xs text-red-400">{category.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Income Categories */}
            {incomePieData.length > 0 && (
              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Top Income Sources</h4>
                <div className="space-y-2">
                  {incomePieData.slice(0, 3).map((category, index) => (
                    <div 
                      key={category.name} 
                      className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                      onClick={() => handleCategoryClick({ id: category.id, name: category.name })}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-400">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {category.icon && renderIcon(category.icon, { 
                          size: 14, 
                          className: `text-${category.color}-400`,
                          style: { color: CHART_COLORS[category.color] || CHART_COLORS.gray }
                        })}
                          <span className="text-white text-sm">{category.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-sm">
                          {selectedWallet ? formatAmount(category.value, selectedWallet.currency) : '0'}
                        </div>
                        <div className="text-xs text-emerald-400">{category.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6 animate-fadeInUp" style={{ animationDelay: '0.7s' }}>
        <div className="flex items-center gap-2 mb-6">
          <Calendar size={20} className="text-yellow-500" />
          <h3 className="text-lg font-semibold text-white">Financial Insights</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Average Monthly Income</p>
            <p className="text-xl font-semibold text-emerald-400">
              {selectedWallet ? formatAmount(averageMonthlyIncome, selectedWallet.currency) : '0'}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Average Monthly Expenses</p>
            <p className="text-xl font-semibold text-red-400">
              {selectedWallet ? formatAmount(averageMonthlyExpenses, selectedWallet.currency) : '0'}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Net Transfer Impact</p>
            <p className={`text-xl font-semibold ${
              (totalTransferIn - totalTransferOut) >= 0 ? 'text-blue-400' : 'text-orange-400'
            }`}>
              {(totalTransferIn - totalTransferOut) >= 0 ? '+' : ''}
              {selectedWallet ? formatAmount(totalTransferIn - totalTransferOut, selectedWallet.currency) : '0'}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Average Transaction</p>
            <p className="text-xl font-semibold text-cyan-400">
              {filteredTransactions.length > 0 
                ? selectedWallet 
                  ? formatAmount(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / filteredTransactions.length, selectedWallet.currency)
                  : '0'
                : '0'
              }
            </p>
            <p className="text-xs text-gray-500">
              Per transaction amount
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Avoidable Rate</p>
            <p className={`text-xl font-semibold ${
              totalExpenses > 0 && (totalAvoidableExpenses / totalExpenses) > 0.3 ? 'text-red-400' : 
              totalExpenses > 0 && (totalAvoidableExpenses / totalExpenses) > 0.15 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {totalExpenses > 0 ? ((totalAvoidableExpenses / totalExpenses) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-gray-500">
              {totalExpenses > 0 && (totalAvoidableExpenses / totalExpenses) > 0.3 ? 'High avoidable spending' : 
               totalExpenses > 0 && (totalAvoidableExpenses / totalExpenses) > 0.15 ? 'Moderate avoidable spending' : 'Good spending control'}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Expense Ratio</p>
            <p className={`text-xl font-semibold ${
              totalIncome > 0 && (totalSpendingOnly / totalIncome) > 0.8 ? 'text-red-400' :
              totalIncome > 0 && (totalSpendingOnly / totalIncome) > 0.6 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {totalIncome > 0 ? Math.round((totalSpendingOnly / totalIncome) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500">
              Expenses as % of income
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Largest Transaction</p>
            <p className={`text-xl font-semibold ${
              filteredTransactions.length > 0 && Math.max(...filteredTransactions.map(t => Math.abs(t.amount))) === 
              Math.max(...filteredTransactions.filter(t => t.type === 'income').map(t => t.amount)) 
              ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {filteredTransactions.length > 0 
                ? selectedWallet 
                  ? formatAmount(Math.max(...filteredTransactions.map(t => Math.abs(t.amount))), selectedWallet.currency)
                  : '0'
                : '0'
              }
            </p>
            <p className="text-xs text-gray-500">
              {filteredTransactions.length} transactions total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;