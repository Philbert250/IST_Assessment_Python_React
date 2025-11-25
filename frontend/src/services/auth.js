import api from './api';

/**
 * Authentication service
 * Handles all authentication-related API calls
 */

/**
 * Login user with username and password
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise} Response with access_token, refresh_token, and user data
 */
export const login = async (username, password) => {
  const response = await api.post('/api/token/', {
    username,
    password,
  });
  return response.data;
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email
 * @param {string} userData.password - Password
 * @param {string} userData.role - User role (staff, approver-level-1, approver-level-2, finance)
 * @returns {Promise} Response with user data
 */
export const register = async (userData) => {
  const response = await api.post('/api/auth/register/', userData);
  return response.data;
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise} Response with new access_token
 */
export const refreshToken = async (refreshToken) => {
  const response = await api.post('/api/token/refresh/', {
    refresh: refreshToken,
  });
  return response.data;
};

/**
 * Get current authenticated user information
 * @returns {Promise} Response with user data
 */
export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me/');
  return response.data;
};

/**
 * Get user profile
 * @returns {Promise} Response with user profile data
 */
export const getUserProfile = async () => {
  const response = await api.get('/api/auth/profile/');
  return response.data;
};

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise} Response with updated profile data
 */
export const updateUserProfile = async (profileData) => {
  const response = await api.put('/api/auth/profile/', profileData);
  return response.data;
};

