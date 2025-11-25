// Runtime configuration for the application
// This file is loaded at runtime, so we can set the API URL without rebuilding
// For local development, this will be overridden by nginx or api.js localhost detection
(function() {
  // Detect if running on localhost
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';
  
  window.APP_CONFIG = {
    API_BASE_URL: isLocalhost 
      ? 'http://localhost:8000' 
      : 'https://procure-to-pay-backend-philbert.fly.dev'
  };
})();

