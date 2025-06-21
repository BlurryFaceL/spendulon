import React from 'react';

export const SkeletonLoader = ({ className = '', variant = 'text' }) => {
  const baseClasses = 'animate-pulse bg-gray-700/50 rounded';
  
  const variantClasses = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    stat: 'h-8 w-24',
    card: 'h-32 w-full',
    circle: 'h-10 w-10 rounded-full',
    button: 'h-10 w-32'
  };
  
  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
};

export const StatCardSkeleton = () => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <SkeletonLoader variant="circle" className="!w-10 !h-10" />
      </div>
      <SkeletonLoader variant="text" className="!w-20 !h-3 mb-2" />
      <SkeletonLoader variant="stat" className="!w-28" />
    </div>
  );
};

export const TransactionCardSkeleton = () => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <SkeletonLoader variant="text" className="!w-20 !h-4" />
            <SkeletonLoader variant="text" className="!w-16 !h-4" />
          </div>
          <div className="flex items-center gap-4">
            <SkeletonLoader variant="text" className="!w-24 !h-5" />
            <SkeletonLoader variant="text" className="!w-32 !h-4" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonLoader variant="button" className="!w-16 !h-8" />
          <SkeletonLoader variant="button" className="!w-16 !h-8" />
        </div>
      </div>
    </div>
  );
};

export const AnalyticsChartSkeleton = () => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <SkeletonLoader variant="title" className="mb-4" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonLoader variant="text" className="!w-20" />
            <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
              <SkeletonLoader 
                className="h-full !rounded-none" 
                style={{ width: `${Math.random() * 60 + 20}%` }} 
              />
            </div>
            <SkeletonLoader variant="text" className="!w-16" />
          </div>
        ))}
      </div>
    </div>
  );
};