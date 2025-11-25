import axios from 'axios';

// Get API base URL from runtime config (config.js) or build-time env var or default
const getApiBaseUrl = () => {
  // Priority 1: Check if running on localhost (local development or local Docker)
  // If running on localhost, always use local backend
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';
  
  if (isLocalhost) {
    // For local development, use local backend
    // Can be overridden by REACT_APP_API_BASE_URL env var
    if (process.env.REACT_APP_API_BASE_URL) {
      const url = process.env.REACT_APP_API_BASE_URL;
      console.log('[API] Using REACT_APP_API_BASE_URL:', url);
      return url;
    }
    const url = 'http://localhost:8000';
    console.log('[API] Detected localhost, using local backend:', url);
    return url;
  }
  
  // Priority 2: Runtime config (from config.js loaded in index.html) - for production
  if (window.APP_CONFIG?.API_BASE_URL) {
    const url = window.APP_CONFIG.API_BASE_URL;
    console.log('[API] Using window.APP_CONFIG.API_BASE_URL:', url);
    return url;
  }
  
  // Priority 3: Build-time environment variable
  if (process.env.REACT_APP_API_BASE_URL) {
    const url = process.env.REACT_APP_API_BASE_URL;
    console.log('[API] Using process.env.REACT_APP_API_BASE_URL:', url);
    return url;
  }
  
  // Priority 4: Default fallback
  const url = 'http://localhost:8000';
  console.log('[API] Using default fallback:', url);
  return url;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No refresh token, redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Try to refresh the token
        const response = await axios.post(
          `${getApiBaseUrl()}/api/token/refresh/`,
          { refresh: refreshToken }
        );

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

