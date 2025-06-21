import React, { createContext, useState, useEffect, useContext } from 'react';
import { Auth, Hub } from 'aws-amplify';
import { API_CONFIG } from '../config/api-config';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processedUsers, setProcessedUsers] = useState(new Set());

  const checkUser = async () => {
    try {
      const userData = await Auth.currentAuthenticatedUser();
      
      // For Google OAuth, extract user info from the session token
      try {
        const session = await Auth.currentSession();
        const idToken = session.getIdToken();
        const payload = idToken.payload;
        
        // Extract user info from token and add to attributes
        if (payload) {
          userData.attributes = userData.attributes || {};
          userData.attributes.name = payload.name || payload.given_name;
          userData.attributes.email = payload.email;
          userData.attributes.given_name = payload.given_name;
          userData.attributes.family_name = payload.family_name;
          userData.attributes.picture = payload.picture;
        }
      } catch (tokenError) {
        // Silently fail token extraction
        
        // Fallback: try to fetch user attributes
        try {
          const userAttributes = await Auth.userAttributes(userData);
          
          if (Array.isArray(userAttributes)) {
            const attributesObj = {};
            userAttributes.forEach(attr => {
              attributesObj[attr.Name] = attr.Value;
            });
            userData.attributes = { ...userData.attributes, ...attributesObj };
          }
        } catch (attrError) {
          // Silently fail - token extraction is the primary method
        }
      }
      
      setUser(userData);
      setError(null);
      
      // Create user in database only if we haven't processed this user yet in this session
      const userId = userData.username;
      if (!processedUsers.has(userId)) {
        try {
          const session = await Auth.currentSession();
          const token = session.getIdToken().getJwtToken(); // Use ID token, not access token
          
          const response = await fetch(`${API_CONFIG.baseUrl}/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token // No "Bearer " prefix, just the token
            },
            body: JSON.stringify({
              name: userData.attributes?.name || 'Unknown User',
              email: userData.attributes?.email || '',
              picture: userData.attributes?.picture || ''
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Mark this user as processed for this session
          setProcessedUsers(prev => new Set(prev).add(userId));
        } catch (userError) {
          console.error('Error updating user profile:', userError);
          // Don't fail auth if user profile update fails
        }
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
    
    // Listen for auth events
    const unsubscribe = Hub.listen('auth', ({ payload: { event, data } }) => {
      console.log('Auth event:', event, data);
      switch (event) {
        case 'signIn':
        case 'cognitoHostedUI':
          // Add a small delay to ensure OAuth callback is complete
          setTimeout(() => {
            checkUser();
          }, 500);
          break;
        case 'signOut':
          setUser(null);
          setLoading(false);
          break;
        case 'signIn_failure':
        case 'cognitoHostedUI_failure':
          setError('Sign in failed');
          setLoading(false);
          break;
        default:
          // Handle other auth events if needed
          break;
      }
    });

    // Additional polling for iOS Safari Face ID issues
    const pollAuthState = () => {
      if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
        console.log('OAuth callback detected, checking auth state...');
        setTimeout(() => {
          checkUser();
        }, 1000);
      }
    };

    // Check for OAuth callback on page load
    pollAuthState();
    
    // Poll auth state periodically for iOS Face ID edge cases
    const authPollInterval = setInterval(() => {
      if (!user && window.location.pathname !== '/' && window.location.search.includes('code=')) {
        console.log('Polling auth state for OAuth callback...');
        checkUser();
      }
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(authPollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    try {
      await Auth.federatedSignIn({ provider: 'Google' });
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await Auth.signOut();
      setUser(null);
      setProcessedUsers(new Set()); // Clear processed users on sign out
    } catch (error) {
      setError(error.message);
    }
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};