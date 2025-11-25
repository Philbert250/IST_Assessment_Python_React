import api from './api';

/**
 * Purchase Requests API service
 * Handles all purchase request-related API calls
 */

/**
 * Get all purchase requests
 * @param {Object} params - Query parameters (status, etc.)
 * @returns {Promise} Response with list of purchase requests
 */
export const getPurchaseRequests = async (params = {}) => {
  const response = await api.get('/api/requests/', { params });
  // Handle both paginated (results) and non-paginated (array) responses
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

/**
 * Get a single purchase request by ID
 * @param {string} id - Purchase request ID (UUID)
 * @returns {Promise} Response with purchase request details
 */
export const getPurchaseRequest = async (id) => {
  const response = await api.get(`/api/requests/${id}/`);
  return response.data;
};

/**
 * Create a new purchase request
 * @param {FormData} formData - Purchase request data (multipart/form-data)
 * @returns {Promise} Response with created purchase request
 */
export const createPurchaseRequest = async (formData) => {
  const response = await api.post('/api/requests/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Update a purchase request
 * @param {string} id - Purchase request ID (UUID)
 * @param {FormData} formData - Updated purchase request data
 * @returns {Promise} Response with updated purchase request
 */
export const updatePurchaseRequest = async (id, formData) => {
  const response = await api.put(`/api/requests/${id}/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Approve a purchase request
 * @param {string} id - Purchase request ID (UUID)
 * @param {Object} data - Approval data (comment, etc.)
 * @returns {Promise} Response with updated purchase request
 */
export const approvePurchaseRequest = async (id, data = {}) => {
  const response = await api.patch(`/api/requests/${id}/approve/`, data);
  return response.data;
};

/**
 * Reject a purchase request
 * @param {string} id - Purchase request ID (UUID)
 * @param {Object} data - Rejection data (comment, etc.)
 * @returns {Promise} Response with updated purchase request
 */
export const rejectPurchaseRequest = async (id, data = {}) => {
  const response = await api.patch(`/api/requests/${id}/reject/`, data);
  return response.data;
};

/**
 * Submit receipt for a purchase request
 * @param {string} id - Purchase request ID (UUID)
 * @param {FormData} formData - Receipt file
 * @returns {Promise} Response with updated purchase request
 */
export const submitReceipt = async (id, formData) => {
  const response = await api.post(`/api/requests/${id}/submit-receipt/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Get all request types
 * @returns {Promise} Response with list of request types
 */
export const getRequestTypes = async () => {
  const response = await api.get('/api/request-types/');
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

