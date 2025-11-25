import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Normalize user data to match login response structure
  const normalizeUserData = (userData) => {
    // If userData already has role and role_display at top level (from login), return as is
    if (userData.role !== undefined) {
      return {
        ...userData,
        is_superuser: userData.role === 'admin' || userData.is_superuser || false
      };
    }

    // Otherwise, normalize from /api/auth/me/ response structure
    // Check if user is superuser (Django User model has is_superuser field)
    // For superusers, set role to 'admin' and role_display to 'Administrator'
    const isSuperuser = userData.is_superuser || false;
    
    if (isSuperuser) {
      return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: 'admin',
        role_display: 'Administrator',
        is_superuser: true
      };
    }

    // For regular users, extract role from profile
    if (userData.profile) {
      return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.profile.role || null,
        role_display: userData.profile.role_display || null,
        is_superuser: false
      };
    }

    // Fallback if no profile
    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      role: null,
      role_display: null,
      is_superuser: false
    };
  };

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('access_token');

      if (storedUser && accessToken) {
        try {
          // Verify token is still valid by fetching current user
          const userData = await authService.getCurrentUser();
          // Normalize the response to match login structure
          const normalizedUser = normalizeUserData(userData);
          setUser(normalizedUser);
          // Update localStorage with normalized data
          localStorage.setItem('user', JSON.stringify(normalizedUser));
          setIsAuthenticated(true);
        } catch (error) {
          // Token is invalid, clear storage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise} User data
   */
  const login = async (username, password) => {
    try {
      const response = await authService.login(username, password);
      const { access, refresh, user: userData } = response;

      // Store tokens and user data
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      setIsAuthenticated(true);

      return userData;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Register new user
   * @param {Object} userData - Registration data
   * @returns {Promise} User data
   */
  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout user
   */
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  /**
   * Update user data
   * @param {Object} userData - Updated user data
   */
  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

