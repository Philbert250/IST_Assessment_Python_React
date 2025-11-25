import api from './api';

/**
 * Admin API service
 * Handles admin-related API calls
 */

// ========== User Management ==========

/**
 * Get all users (admin only)
 * @param {Object} params - Query parameters (role, is_active, etc.)
 * @returns {Promise} Response with list of users
 */
export const getUsers = async (params = {}) => {
  const response = await api.get('/api/users/', { params });
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

/**
 * Get a single user by ID (admin only)
 * @param {string} id - User ID
 * @returns {Promise} Response with user details
 */
export const getUser = async (id) => {
  const response = await api.get(`/api/users/${id}/`);
  return response.data;
};

/**
 * Create a new user (admin only)
 * @param {Object} userData - User registration data
 * @returns {Promise} Response with created user
 */
export const createUser = async (userData) => {
  // Remove password fields if they are empty (to trigger auto-generation)
  const dataToSend = { ...userData };
  if (!dataToSend.password || dataToSend.password.trim() === '') {
    delete dataToSend.password;
    delete dataToSend.password_confirm;
  }
  const response = await api.post('/api/users/', dataToSend);
  return response.data;
};

/**
 * Update a user (admin only)
 * @param {string} id - User ID
 * @param {Object} userData - Updated user data
 * @returns {Promise} Response with updated user
 */
export const updateUser = async (id, userData) => {
  const response = await api.patch(`/api/users/${id}/`, userData);
  return response.data;
};

/**
 * Delete a user (admin only)
 * @param {string} id - User ID
 * @returns {Promise} Response
 */
export const deleteUser = async (id) => {
  const response = await api.delete(`/api/users/${id}/`);
  return response.data;
};

/**
 * Register a new user (admin only) - Legacy endpoint
 * @param {Object} userData - User registration data
 * @returns {Promise} Response with created user
 */
export const registerUser = async (userData) => {
  const response = await api.post('/api/auth/register/', userData);
  return response.data;
};

// ========== Request Type Management ==========

/**
 * Get all request types
 * @returns {Promise} Response with list of request types
 */
export const getRequestTypes = async () => {
  const response = await api.get('/api/request-types/');
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

/**
 * Get a single request type by ID
 * @param {string} id - Request type ID (UUID)
 * @returns {Promise} Response with request type details
 */
export const getRequestType = async (id) => {
  const response = await api.get(`/api/request-types/${id}/`);
  return response.data;
};

/**
 * Create a new request type (admin only)
 * @param {Object} requestTypeData - Request type data
 * @returns {Promise} Response with created request type
 */
export const createRequestType = async (requestTypeData) => {
  const response = await api.post('/api/request-types/', requestTypeData);
  return response.data;
};

/**
 * Update a request type (admin only)
 * @param {string} id - Request type ID (UUID)
 * @param {Object} requestTypeData - Updated request type data
 * @returns {Promise} Response with updated request type
 */
export const updateRequestType = async (id, requestTypeData) => {
  const response = await api.patch(`/api/request-types/${id}/`, requestTypeData);
  return response.data;
};

/**
 * Delete a request type (admin only)
 * @param {string} id - Request type ID (UUID)
 * @returns {Promise} Response
 */
export const deleteRequestType = async (id) => {
  const response = await api.delete(`/api/request-types/${id}/`);
  return response.data;
};

// ========== Approval Level Management ==========

/**
 * Get all approval levels (admin only)
 * @param {Object} params - Query parameters (request_type, etc.)
 * @returns {Promise} Response with list of approval levels
 */
export const getApprovalLevels = async (params = {}) => {
  const response = await api.get('/api/approval-levels/', { params });
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

/**
 * Get a single approval level by ID (admin only)
 * @param {string} id - Approval level ID (UUID)
 * @returns {Promise} Response with approval level details
 */
export const getApprovalLevel = async (id) => {
  const response = await api.get(`/api/approval-levels/${id}/`);
  return response.data;
};

/**
 * Create a new approval level (admin only)
 * @param {Object} approvalLevelData - Approval level data
 * @returns {Promise} Response with created approval level
 */
export const createApprovalLevel = async (approvalLevelData) => {
  const response = await api.post('/api/approval-levels/', approvalLevelData);
  return response.data;
};

/**
 * Update an approval level (admin only)
 * @param {string} id - Approval level ID (UUID)
 * @param {Object} approvalLevelData - Updated approval level data
 * @returns {Promise} Response with updated approval level
 */
export const updateApprovalLevel = async (id, approvalLevelData) => {
  const response = await api.patch(`/api/approval-levels/${id}/`, approvalLevelData);
  return response.data;
};

/**
 * Delete an approval level (admin only)
 * @param {string} id - Approval level ID (UUID)
 * @returns {Promise} Response
 */
export const deleteApprovalLevel = async (id) => {
  const response = await api.delete(`/api/approval-levels/${id}/`);
  return response.data;
};

