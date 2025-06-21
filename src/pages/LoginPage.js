import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hub } from '@aws-amplify/core';
import { 
  Wallet, Sparkles,
  Bitcoin, Banknote, LineChart, BarChart3, DollarSign,
  Building2, Briefcase, CircleDollarSign, Landmark, ShieldCheck,
  Coins, BadgeDollarSign, Receipt, PiggyBank, GanttChartSquare,
  Scale, Trophy, Calculator, TrendingDown, CircleDot,
  Gem, Percent, Shuffle, Sigma, 
  BarChart2, CandlestickChart, ArrowUpDown, HandCoins, 
  Building, CreditCard, IndianRupee, BadgeEuro,
  BadgePoundSterling, Zap, Target, TrendingUp,
  BadgeJapaneseYen, BadgeRussianRuble, BadgeSwissFranc,
  Kanban, PieChart, Activity,
  Repeat, Archive, BookOpen, Database,
  // New unique financial/currency/investment icons
  TrendingDown as TrendDown, Clock, Bell, Combine,
  Newspaper, Layers, Package, Users, Globe,
  Heart, Star, Crown, Diamond, Flame,
  Compass, Map, Shield, Lock, Key,
  Eye, Search, Filter, Settings, Wrench,
  Phone, Mail, Home, Car, Plane,
  Camera, Image, Video, Music, Headphones,
  Coffee, Pizza, Gift, ShoppingCart, Store,
  Factory, Truck, Train, Ship, Rocket,
  Atom, Beaker, Microscope, Telescope, Satellite
} from 'lucide-react';

const LoginPage = () => {
  const { user, loading, signIn, error: authError } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  // Additional check for iOS Safari OAuth callbacks
  useEffect(() => {
    const checkOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get('access_token');
      
      if (code || accessToken) {
        console.log('OAuth callback detected in LoginPage');
        // Force a page reload to trigger auth check
        if (!user && !loading && !isLoading) {
          setIsLoading(true);
          // Clear URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          // Force reload after a delay
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    };
    
    checkOAuthCallback();
  }, [user, loading, isLoading]);

  useEffect(() => {
    // Set up Hub listener for auth events
    const unsubscribe = Hub.listen('auth', ({ payload: { event, data } }) => {
      if (event === 'signIn' || event === 'cognitoHostedUI') {
        setIsLoading(false);
      } else if (event === 'signIn_failure' || event === 'cognitoHostedUI_failure') {
        setError(data?.message || 'Authentication failed');
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  // Handle auth errors silently

  // Don't show loading state on initial page load
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // If user is authenticated, don't render login page
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated gradient background for mobile */}
      <div className="block md:hidden absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 bg-black opacity-50"></div>
      </div>
      
      {/* Animated orbs for mobile */}
      <div className="block md:hidden absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Mobile-first responsive container */}
      <div className="block md:hidden relative z-10">
        {/* Mobile Currency Icons - staggered rows like desktop */}
        
        {/* Top row - 5 icons */}
        <DollarSign className="absolute top-[5%] left-[5%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <BadgeEuro className="absolute top-[5%] left-[25%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <Bitcoin className="absolute top-[5%] left-[45%] text-blue-400 opacity-30 animate-bounce z-20" size={26} style={{ animationDelay: '0.2s' }} />
        <BadgePoundSterling className="absolute top-[5%] left-[65%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <IndianRupee className="absolute top-[5%] left-[85%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        
        {/* Second row - 4 icons (staggered) */}
        <BadgeJapaneseYen className="absolute top-[15%] left-[15%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        <BadgeRussianRuble className="absolute top-[15%] left-[35%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <BadgeSwissFranc className="absolute top-[15%] left-[55%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <Coins className="absolute top-[15%] left-[75%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        
        {/* Third row - 5 icons */}
        <CircleDollarSign className="absolute top-[25%] left-[5%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <Banknote className="absolute top-[25%] left-[25%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        <Wallet className="absolute top-[25%] left-[45%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        <PiggyBank className="absolute top-[25%] left-[65%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <CreditCard className="absolute top-[25%] left-[85%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        
        {/* Fourth row - 4 icons (staggered) */}
        <BadgeDollarSign className="absolute top-[35%] left-[15%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        <LineChart className="absolute top-[35%] left-[35%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <BarChart3 className="absolute top-[35%] left-[55%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        <Calculator className="absolute top-[35%] left-[75%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        
        {/* Bottom row - 5 icons */}
        <TrendingUp className="absolute top-[45%] left-[5%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <HandCoins className="absolute top-[45%] left-[25%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <PieChart className="absolute top-[45%] left-[45%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        <Building2 className="absolute top-[45%] left-[65%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <Landmark className="absolute top-[45%] left-[85%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        
        {/* Sixth row - 4 icons (staggered) */}
        <Scale className="absolute top-[55%] left-[15%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        <Trophy className="absolute top-[55%] left-[35%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <BarChart2 className="absolute top-[55%] left-[55%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <CandlestickChart className="absolute top-[55%] left-[75%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        
        {/* Seventh row - 5 icons */}
        <ArrowUpDown className="absolute top-[65%] left-[5%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <Bell className="absolute top-[65%] left-[25%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        <Clock className="absolute top-[65%] left-[45%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        <Combine className="absolute top-[65%] left-[65%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <Percent className="absolute top-[65%] left-[85%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        
        {/* Eighth row - 4 icons (staggered) */}
        <Shuffle className="absolute top-[75%] left-[15%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        <Sigma className="absolute top-[75%] left-[35%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <Building className="absolute top-[75%] left-[55%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        <Briefcase className="absolute top-[75%] left-[75%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        
        {/* Ninth row - 5 icons */}
        <ShieldCheck className="absolute top-[85%] left-[5%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <CircleDot className="absolute top-[85%] left-[25%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <Gem className="absolute top-[85%] left-[45%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        <Newspaper className="absolute top-[85%] left-[65%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <Target className="absolute top-[85%] left-[85%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        
        {/* Tenth row - 4 icons (staggered, consistent pattern) */}
        <Zap className="absolute top-[95%] left-[15%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.5s' }} />
        <TrendDown className="absolute top-[95%] left-[35%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <GanttChartSquare className="absolute top-[95%] left-[55%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <Activity className="absolute top-[95%] left-[75%] text-blue-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.2s' }} />
        
        {/* Mobile Login - Simple and Clean */}
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
          {/* Mobile Logo */}
          <div className="mb-8 text-center">
            <div className="relative inline-block mb-4">
              <div className="relative bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <img 
                  src="/spendulon-pie-logo.svg" 
                  alt="Spendulon Logo" 
                  className="w-16 h-16"
                />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              $pendulon
            </h1>
            <p className="text-gray-400 text-base">Not a Spender, Shh!!!</p>
          </div>

          {/* Mobile Login Card */}
          <div className="w-full max-w-sm">
            <div className="bg-gray-900 bg-opacity-80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-800">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Welcome to Spendulon</h2>
                  <p className="text-gray-400 text-sm">Sign in to manage your finances</p>
                </div>

                {/* Mobile Google login button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl px-6 py-4 transition-all duration-300 transform active:scale-95"
                >
                  <div className="flex items-center justify-center space-x-3">
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-white font-medium">Continue with Google</span>
                      </>
                    )}
                  </div>
                </button>

                {/* Mobile Features */}
                <div className="pt-4 space-y-2">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-xs">Track incomes and expenses</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                    <span className="text-xs">Create wallets, categories & labels</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-xs">Visualize spending patterns instantly</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Footer */}
          <div className="mt-8 text-center text-gray-500 text-xs px-4">
            <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>

      {/* Desktop Version - Keep existing design */}
      <div className="hidden md:block">
        {/* Google Fonts */}
        <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
          
          .font-space-grotesk {
            font-family: 'Space Grotesk', sans-serif;
          }
          
          .font-manrope {
            font-family: 'Manrope', sans-serif;
          }
        `}
      </style>

      {/* Animated gradient background - Cosmic Purple theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 bg-black opacity-50"></div>
      </div>
      
      {/* Animated orbs - Cosmic Purple theme */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>


      {/* Desktop Icons (full set for desktop) */}
      <div className="hidden md:block">
        {/* Top section - Financial and currency icons */}
        <div className="absolute top-[5%] left-[7%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><DollarSign size={40} /></div>
        <div className="absolute top-[8%] left-[15%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><BadgeEuro size={38} /></div>
        <div className="absolute top-[3%] left-[23%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><BadgePoundSterling size={42} /></div>
        <div className="absolute top-[7%] left-[31%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><BadgeJapaneseYen size={40} /></div>
        <div className="absolute top-[4%] left-[39%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><IndianRupee size={38} /></div>
        <div className="absolute top-[6%] left-[47%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Diamond size={42} /></div>
        <div className="absolute top-[9%] left-[55%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><BadgeRussianRuble size={40} /></div>
        <div className="absolute top-[5%] left-[63%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><BadgeSwissFranc size={38} /></div>
        <div className="absolute top-[8%] left-[71%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Coins size={42} /></div>
        <div className="absolute top-[4%] left-[79%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><CircleDollarSign size={40} /></div>
        <div className="absolute top-[7%] left-[87%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Banknote size={38} /></div>
        <div className="absolute top-[3%] left-[95%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Wallet size={42} /></div>

        {/* Upper middle section - Financial symbols and tools */}
        <div className="absolute top-[25%] left-[5%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><BadgeDollarSign size={40} /></div>
        <div className="absolute top-[28%] left-[13%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><PiggyBank size={38} /></div>
        <div className="absolute top-[23%] left-[21%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><CreditCard size={42} /></div>
        <div className="absolute top-[27%] left-[29%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><LineChart size={40} /></div>
        <div className="absolute top-[24%] left-[37%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><BarChart3 size={38} /></div>
        <div className="absolute top-[26%] left-[45%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><TrendingUp size={42} /></div>
        <div className="absolute top-[29%] left-[53%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><Calculator size={40} /></div>
        <div className="absolute top-[25%] left-[61%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><HandCoins size={38} /></div>
        <div className="absolute top-[28%] left-[69%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Building2 size={42} /></div>
        <div className="absolute top-[24%] left-[77%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><Landmark size={40} /></div>
        <div className="absolute top-[27%] left-[85%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Scale size={38} /></div>
        <div className="absolute top-[23%] left-[93%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Receipt size={42} /></div>

        {/* Center section - Investment and business icons */}
        <div className="absolute top-[45%] left-[48%] text-purple-400 opacity-30 animate-bounce" style={{ animationDelay: '0.3s' }}><Trophy size={46} /></div>
        <div className="absolute top-[42%] left-[45%] text-blue-400 opacity-30 animate-bounce" style={{ animationDelay: '0.4s' }}><Gem size={46} /></div>
        <div className="absolute top-[48%] left-[52%] text-indigo-400 opacity-30 animate-bounce" style={{ animationDelay: '0.5s' }}><Target size={46} /></div>
        <div className="absolute top-[43%] left-[8%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><Briefcase size={40} /></div>
        <div className="absolute top-[46%] left-[16%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><ShieldCheck size={38} /></div>
        <div className="absolute top-[41%] left-[24%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Repeat size={42} /></div>
        <div className="absolute top-[45%] left-[32%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><CircleDot size={40} /></div>
        <div className="absolute top-[42%] left-[40%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><Percent size={38} /></div>
        <div className="absolute top-[44%] left-[60%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Sigma size={42} /></div>
        <div className="absolute top-[47%] left-[68%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><ArrowUpDown size={40} /></div>
        <div className="absolute top-[43%] left-[76%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Shuffle size={38} /></div>
        <div className="absolute top-[46%] left-[84%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Zap size={42} /></div>
        <div className="absolute top-[48%] left-[90%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><Mail size={40} /></div>

        {/* Lower middle section - Charts and analytics */}
        <div className="absolute top-[65%] left-[7%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><BarChart2 size={40} /></div>
        <div className="absolute top-[68%] left-[15%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><CandlestickChart size={38} /></div>
        <div className="absolute top-[63%] left-[23%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><GanttChartSquare size={42} /></div>
        <div className="absolute top-[67%] left-[31%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><PieChart size={40} /></div>
        <div className="absolute top-[64%] left-[39%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Activity size={38} /></div>
        <div className="absolute top-[66%] left-[47%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><BookOpen size={42} /></div>
        <div className="absolute top-[69%] left-[55%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><Archive size={40} /></div>
        <div className="absolute top-[65%] left-[63%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><Database size={38} /></div>
        <div className="absolute top-[68%] left-[71%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Kanban size={42} /></div>
        <div className="absolute top-[64%] left-[79%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><TrendDown size={40} /></div>
        <div className="absolute top-[67%] left-[87%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Bell size={38} /></div>
        <div className="absolute top-[63%] left-[95%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Clock size={42} /></div>

        {/* Bottom section - Unique icons not used elsewhere */}
        <div className="absolute top-[85%] left-[5%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><Newspaper size={40} /></div>
        <div className="absolute top-[88%] left-[13%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><Combine size={38} /></div>
        <div className="absolute top-[83%] left-[21%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Key size={42} /></div>
        <div className="absolute top-[87%] left-[29%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><Users size={40} /></div>
        <div className="absolute top-[84%] left-[37%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Package size={38} /></div>
        <div className="absolute top-[86%] left-[45%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Layers size={42} /></div>
        <div className="absolute top-[89%] left-[53%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><Search size={40} /></div>
        <div className="absolute top-[85%] left-[61%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><Filter size={38} /></div>
        <div className="absolute top-[88%] left-[69%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Settings size={42} /></div>
        <div className="absolute top-[84%] left-[77%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><Wrench size={40} /></div>
        <div className="absolute top-[87%] left-[85%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><Eye size={38} /></div>
        <div className="absolute top-[83%] left-[93%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><Phone size={42} /></div>
      </div>

      {/* Edge elements - Keep these core financial icons */}
      <div className="absolute top-[50%] left-[2%] text-indigo-400 opacity-25 animate-bounce" style={{ animationDelay: '0.3s' }}><BadgeEuro size={40} /></div>
      <div className="absolute top-[50%] left-[98%] text-purple-400 opacity-25 animate-bounce" style={{ animationDelay: '0.4s' }}><BadgePoundSterling size={40} /></div>
      <div className="absolute top-[2%] left-[50%] text-blue-400 opacity-25 animate-bounce" style={{ animationDelay: '0.5s' }}><Bitcoin size={40} /></div>
      <div className="absolute top-[98%] left-[50%] text-indigo-400 opacity-25 animate-bounce" style={{ animationDelay: '0s' }}><DollarSign size={40} /></div>

      {/* Mouse trail effect */}
      <div 
        className="absolute w-80 h-80 rounded-full pointer-events-none transition-all duration-300 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
          left: mousePosition.x - 160,
          top: mousePosition.y - 160,
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Main content */}
      <div 
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4"
        onMouseMove={(e) => {
          setMousePosition({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* Logo and title */}
        <div className="mb-8 text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 blur-lg opacity-75 animate-pulse"></div>
            <div className="relative bg-black rounded-2xl p-4">
              <img 
                src="/spendulon-pie-logo.svg" 
                alt="Spendulon Logo" 
                className="w-20 h-20"
              />
            </div>
          </div>
          <h1 className="font-space-grotesk text-6xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            $pendulon
          </h1>
          <p className="font-manrope text-gray-400 text-lg">Not a Spender, shh!!!</p>
        </div>

        {/* Login card */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
          
          {/* Glass card */}
          <div className="relative bg-gray-900 bg-opacity-50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-gray-800">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="font-space-grotesk text-2xl font-semibold mb-2">Welcome</h2>
                <p className="font-manrope text-gray-400">Sign in to manage your finances</p>
              </div>

              {/* Google login button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full relative group overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300 group-hover:from-purple-500 group-hover:to-blue-500"></div>
                <div className="relative flex items-center justify-center space-x-3 px-8 py-4">
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-manrope text-white font-medium">Continue with Google</span>
                    </>
                  )}
                </div>
              </button>

              {/* Features */}
              <div className="pt-6 space-y-3">
                <div className="flex items-center space-x-3 text-gray-400">
                  <Sparkles size={20} className="text-purple-400" />
                  <span className="font-manrope text-sm">Track incomes and expenses</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-400">
                  <Sparkles size={20} className="text-indigo-400" />
                  <span className="font-manrope text-sm">Create wallets, categories & labels</span>
                </div> 
                <div className="flex items-center space-x-3 text-gray-400">
                  <Sparkles size={20} className="text-blue-400" />
                  <span className="font-manrope text-sm">Visualize spending patterns instantly</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p className="font-manrope">By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Add error display */}
      {(error || authError) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {error || authError}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default LoginPage;