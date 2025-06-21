import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Wallet, Sparkles,
  Bitcoin, Banknote, LineChart, BarChart3, DollarSign,
  Building2, Briefcase, CircleDollarSign, Landmark, ShieldCheck,
  Coins, BadgeDollarSign, Receipt, PiggyBank, GanttChartSquare,
  Scale, Trophy, Calculator, TrendingDown, CircleDot,
  Gem, Newspaper, Percent, Shuffle, Sigma, 
  BarChart2, CandlestickChart, ArrowUpDown, BellRing, Clock,
  Combine, HandCoins, 
  Building, CreditCard, IndianRupee, BadgeEuro,
  BadgePoundSterling, Zap, Target, TrendingUp,
  BadgeJapaneseYen, BadgeRussianRuble, BadgeSwissFranc
} from 'lucide-react';

const CustomAuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Get OAuth configuration from environment
  const cognitoDomain = process.env.REACT_APP_COGNITO_DOMAIN;
  const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
  const redirectUri = window.location.origin + '/dashboard';

  useEffect(() => {
    // Handle OAuth callback
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    
    if (errorParam) {
      setError(errorParam === 'access_denied' ? 'Login was cancelled' : 'Authentication failed');
      return;
    }
    
    if (code) {
      // OAuth code received, redirect to dashboard
      // The AuthContext will handle the token exchange
      navigate('/dashboard');
    }
  }, [searchParams, navigate]);

  const handleGoogleLogin = () => {
    if (!clientId) {
      setError('OAuth configuration missing');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Construct OAuth URL
    const oauthUrl = new URL(`https://${cognitoDomain}/oauth2/authorize`);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', 'email openid profile');
    oauthUrl.searchParams.set('identity_provider', 'Google');

    // Redirect to OAuth provider
    window.location.href = oauthUrl.toString();
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated gradient background for mobile */}
      <div className="block md:hidden absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 bg-black opacity-50"></div>
      </div>
      
      {/* Mobile-first responsive container */}
      <div className="block md:hidden relative z-10">
        {/* Mobile Currency Icons */}
        <DollarSign className="absolute top-[5%] left-[5%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0s' }} />
        <BadgeEuro className="absolute top-[5%] left-[25%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.1s' }} />
        <Bitcoin className="absolute top-[5%] left-[45%] text-blue-400 opacity-30 animate-bounce z-20" size={26} style={{ animationDelay: '0.2s' }} />
        <BadgePoundSterling className="absolute top-[5%] left-[65%] text-purple-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.3s' }} />
        <IndianRupee className="absolute top-[5%] left-[85%] text-indigo-400 opacity-25 animate-bounce z-20" size={24} style={{ animationDelay: '0.4s' }} />
        
        {/* Mobile Login */}
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
            <p className="text-gray-400 text-base">Clean. Simple. Secure.</p>
          </div>

          {/* Mobile Login Card */}
          <div className="w-full max-w-sm">
            <div className="bg-gray-900 bg-opacity-80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-800">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Welcome to Spendulon</h2>
                  <p className="text-gray-400 text-sm">Your personal finance companion</p>
                </div>

                {/* Mobile Google login button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl px-6 py-4 transition-all duration-300 transform active:scale-95 disabled:opacity-50"
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
                    <span className="text-xs">Track expenses & income</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                    <span className="text-xs">Organize with categories</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-xs">Analytics & insights</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Mobile Footer */}
          <div className="mt-8 text-center text-gray-500 text-xs px-4">
            <p>Secured by AWS Cognito • Privacy-first design</p>
          </div>
        </div>
      </div>

      {/* Desktop Version */}
      <div className="hidden md:block">
        {/* Desktop background and animations */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          <div className="absolute inset-0 bg-black opacity-50"></div>
        </div>
        
        {/* Animated orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        {/* Desktop Currency Icons */}
        <div className="absolute top-[5%] left-[7%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0.3s' }}><DollarSign size={40} /></div>
        <div className="absolute top-[8%] left-[15%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}><BadgeEuro size={38} /></div>
        <div className="absolute top-[3%] left-[23%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}><Bitcoin size={42} /></div>
        <div className="absolute top-[7%] left-[31%] text-purple-400 opacity-20 animate-bounce" style={{ animationDelay: '0s' }}><BadgePoundSterling size={40} /></div>
        <div className="absolute top-[4%] left-[39%] text-indigo-400 opacity-20 animate-bounce" style={{ animationDelay: '0.1s' }}><BadgeJapaneseYen size={38} /></div>
        <div className="absolute top-[6%] left-[47%] text-blue-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s' }}><IndianRupee size={42} /></div>
        <div className="absolute top-[45%] left-[48%] text-purple-400 opacity-30 animate-bounce" style={{ animationDelay: '0.3s' }}><Bitcoin size={46} /></div>

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
            <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              $pendulon
            </h1>
            <p className="text-gray-400 text-lg">Clean. Simple. Secure.</p>
          </div>

          {/* Login card */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            
            {/* Glass card */}
            <div className="relative bg-gray-900 bg-opacity-50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-gray-800">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
                  <p className="text-gray-400">Your personal finance companion</p>
                </div>

                {/* Google login button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full relative group overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
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
                        <span className="text-white font-medium">Continue with Google</span>
                      </>
                    )}
                  </div>
                </button>

                {/* Features */}
                <div className="pt-6 space-y-3">
                  <div className="flex items-center space-x-3 text-gray-400">
                    <Sparkles size={20} className="text-purple-400" />
                    <span className="text-sm">Track expenses & income</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-400">
                    <Sparkles size={20} className="text-indigo-400" />
                    <span className="text-sm">Organize with categories</span>
                  </div> 
                  <div className="flex items-center space-x-3 text-gray-400">
                    <Sparkles size={20} className="text-blue-400" />
                    <span className="text-sm">Analytics & insights</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-center">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>Secured by AWS Cognito • Privacy-first design</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomAuthPage;