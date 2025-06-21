import React, { useState, useEffect } from 'react';
import { Wallet, Bitcoin, TrendingUp, PieChart } from 'lucide-react';

const LoadingSpinner = ({ message = "Not Spending...", showLogo = true, variant = "default" }) => {
  const [currentIcon, setCurrentIcon] = useState(0);
  const icons = [Wallet, Bitcoin, TrendingUp, PieChart];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIcon(prev => (prev + 1) % icons.length);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [icons.length]);

  if (variant === "creative") {
    const CurrentIcon = icons[currentIcon];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-blue-950/20 flex items-center justify-center">
        <div className="text-center relative">
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-70 animate-pulse"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + (i % 2) * 40}%`,
                  animationDelay: `${i * 0.5}s`,
                  animation: `float 3s ease-in-out infinite ${i * 0.5}s`
                }}
              />
            ))}
          </div>
          
          {/* Main logo area */}
          <div className="relative z-10">
            <div className="flex justify-center mb-8">
              <div className="relative">
                {/* Pulsing background circle */}
                <div className="absolute inset-0 w-24 h-24 bg-gradient-to-br from-purple-500/30 to-blue-600/30 rounded-full animate-ping"></div>
                
                {/* Main container */}
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 p-2 shadow-2xl">
                  {/* Rotating outer ring */}
                  <div 
                    className="absolute inset-1 rounded-full border-2 border-white/30 border-t-white/80 animate-spin"
                    style={{ animation: 'spin 3s linear infinite' }}
                  ></div>
                  
                  {/* Icon container */}
                  <div className="relative w-full h-full rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <CurrentIcon 
                      size={28} 
                      className="text-white transition-all duration-500 transform"
                      style={{
                        transform: `scale(${currentIcon % 2 === 0 ? 1.1 : 0.9})`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Loading text with gradient */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent animate-pulse">
                {message}
              </h2>
              
              {/* Progress bar */}
              <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  style={{
                    animation: 'progress 4s ease-in-out infinite alternate'
                  }}
                ></div>
              </div>
              
              {/* Status text */}
              <p className="text-gray-400 text-sm animate-pulse">
                Hang tight, we're getting things ready...
              </p>
            </div>
          </div>
        </div>
        
      </div>
    );
  }

  // Default loading (existing)
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        {showLogo && (
          <div className="flex justify-center mb-8">
            <div className="relative">
              {/* Spinning outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-gray-800"></div>
              <div 
                className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-500 border-r-blue-500 animate-spin"
                style={{
                  animation: 'spin 2s linear infinite'
                }}
              ></div>
              
              {/* Logo in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl animate-pulse">
                  <Wallet size={24} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading text with typing animation */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white animate-pulse">
            {message}
          </h2>
          
          {/* Animated dots */}
          <div className="flex justify-center space-x-1">
            <div 
              className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            ></div>
            <div 
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            ></div>
            <div 
              className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;