import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

const Login = () => {
  const { isDark, toggleTheme } = useTheme();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const errorTimerRef = useRef(null);
  const errorRef = useRef(''); // Persist error in ref - survives re-renders
  // Initialize error from sessionStorage if it exists (persists across remounts)
  const [error, setError] = useState(() => {
    return sessionStorage.getItem('loginError') || '';
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });

  // Redirect if already authenticated (but don't clear error if redirecting)
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  // Sync ref with sessionStorage on mount
  useEffect(() => {
    const storedError = sessionStorage.getItem('loginError');
    if (storedError) {
      errorRef.current = storedError;
      if (!error) {
        setError(storedError);
      }
    }
  }, []); // Run once on mount

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, []);

  // Function to manually close error message
  const closeError = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    errorRef.current = '';
    sessionStorage.removeItem('loginError');
    setError(''); // Clear error state
  };

  const slides = [
    {
      title: "Manage Procurement Efficiently",
      description: "Streamline your purchase requests, approvals, and payments in one place. Simplify your procurement workflow."
    },
    {
      title: "Multi-Level Approval Workflow",
      description: "Configure custom approval levels for different request types. Ensure proper authorization at every step."
    },
    {
      title: "AI-Powered Document Processing",
      description: "Automatically extract data from proforma invoices, generate purchase orders, and validate receipts with AI."
    }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing (optional - remove if you want error to persist)
    // setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear any existing error timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    
    // Basic validation
    if (!formData.username.trim()) {
      const errorMsg = 'Username is required';
      errorRef.current = errorMsg;
      sessionStorage.setItem('loginError', errorMsg);
      setError(errorMsg);
      return;
    }
    if (!formData.password.trim()) {
      const errorMsg = 'Password is required';
      errorRef.current = errorMsg;
      sessionStorage.setItem('loginError', errorMsg);
      setError(errorMsg);
      return;
    }

    // Only clear error when starting a valid submission (after validation passes)
    errorRef.current = '';
    sessionStorage.removeItem('loginError');
    setError(''); // Clear previous error
    setLoading(true);

    try {
      await login(formData.username, formData.password);
      // Redirect to dashboard on success (handled by useEffect)
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Handle error immediately
      let errorMessage = 'An error occurred. Please try again.';
      
      if (err.response?.data) {
        // API error response
        if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.non_field_errors) {
          errorMessage = Array.isArray(err.response.data.non_field_errors) 
            ? err.response.data.non_field_errors[0] 
            : err.response.data.non_field_errors;
        } else if (err.response.data.username) {
          errorMessage = Array.isArray(err.response.data.username) 
            ? err.response.data.username[0] 
            : err.response.data.username;
        } else if (err.response.data.password) {
          errorMessage = Array.isArray(err.response.data.password) 
            ? err.response.data.password[0] 
            : err.response.data.password;
        } else {
          errorMessage = 'Invalid username or password';
        }
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      // Set error and stop loading
      // Clear any existing timer (we're not auto-hiding anymore, user will close manually)
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      
      // Store error in ref and sessionStorage (persists across re-renders and remounts)
      errorRef.current = errorMessage;
      sessionStorage.setItem('loginError', errorMessage);
      
      // Set loading to false
      setLoading(false);
      
      // Set error state for display
      setError(errorMessage);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  // Auto-advance slides every 5 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen flex items-center justify-center p-3 sm:p-5 transition-colors duration-300 ${
      isDark ? 'bg-gray-900' : 'bg-[#f4f7fa]'
    }`} style={{ fontFamily: '"Poppins", sans-serif' }}>
      <div className="w-full max-w-[1200px]">
        <div className={`flex flex-col lg:flex-row rounded-2xl shadow-xl overflow-hidden min-h-[500px] lg:min-h-[650px] ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          
          {/* ========== LEFT SIDE - Hidden on mobile, visible on desktop ========== */}
          <div 
            className="hidden lg:flex flex-1 relative text-white p-6 lg:p-8 flex-col justify-between bg-cover bg-center transition-all duration-500"
            style={{
              backgroundImage: 'url(https://images.pexels.com/photos/34862432/pexels-photo-34862432.jpeg)',
              boxShadow: 'inset 0 0 0 2000px rgba(0,0,0,0.1)'
            }}
          >
            {/* Logo */}
            <div className="bg-white/30 px-4 py-2 flex items-center rounded-lg font-semibold text-sm w-max">
              <div className="w-5 h-5 mr-2 brightness-0 invert bg-white rounded"></div>
              Procure-to-Pay
            </div>

            {/* Text - Animated Content */}
            <div className="pb-12">
              <h1 className="text-2xl lg:text-3xl font-bold leading-tight drop-shadow transition-opacity duration-500">
                {slides[currentSlide].title}
              </h1>
              <p className="text-sm text-white/90 mt-3 max-w-[80%] leading-6 transition-opacity duration-500">
                {slides[currentSlide].description}
              </p>
            </div>

            {/* Pagination */}
            <div className="absolute bottom-8 left-8 flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all duration-300 ${
                    index === currentSlide
                      ? 'w-[25px] h-[8px] rounded-md bg-white'
                      : 'w-2 h-2 rounded-full bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ========== RIGHT SIDE / LOGIN FORM ========== */}
          <div className="flex-1 p-6 sm:p-8 lg:p-10 relative flex flex-col">
            
            {/* Top Right Buttons - Theme Toggle and Login */}
            <div className="absolute top-4 sm:top-6 lg:top-8 right-4 sm:right-6 lg:right-8 flex items-center gap-2">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isDark 
                    ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              
              {/* Login Button - Hidden on mobile, visible on desktop */}
              <button className={`hidden sm:block px-4 sm:px-6 py-2 rounded-lg font-semibold transition-colors ${
                isDark 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-black text-white hover:bg-gray-800'
              }`}>
                Login
              </button>
            </div>

            <div className="mt-8 sm:mt-12 lg:mt-14 max-w-[400px] w-full mx-auto">
              
              <h2 className={`text-xl sm:text-2xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                Welcome Back
              </h2>
              <p className={`text-sm mb-6 ${
                isDark ? 'text-gray-400' : 'text-gray-400'
              }`}>
                Sign in to your account
              </p>

              {/* Form */}
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                
                {/* Error Message */}
                {(error || errorRef.current) && (
                  <div className={`p-3 rounded-lg text-sm relative ${
                    isDark 
                      ? 'bg-red-900/30 border border-red-700 text-red-400' 
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                    <div className="flex items-start gap-2">
                      <i className="fas fa-exclamation-circle mt-0.5"></i>
                      <div className="flex-1">
                        <p className="font-medium">Login Failed</p>
                        <p className="text-xs mt-1 opacity-90">{error || errorRef.current}</p>
                      </div>
                      <button
                        type="button"
                        onClick={closeError}
                        className={`ml-2 flex-shrink-0 p-1 rounded hover:bg-opacity-20 transition-colors ${
                          isDark 
                            ? 'hover:bg-red-700 text-red-400' 
                            : 'hover:bg-red-200 text-red-600'
                        }`}
                        aria-label="Close error message"
                      >
                        <i className="fas fa-times text-xs"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* Username */}
                <div>
                  <label htmlFor="username" className={`text-sm font-medium text-left block mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Username
                  </label>
                  <input 
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-100 border-gray-300 text-gray-900'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="Enter your username"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className={`text-sm font-medium text-left block mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Password
                  </label>
                  
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 pr-12 transition-colors ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-100 border-gray-300 text-gray-900'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="Enter your password"
                    />

                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-colors ${
                        isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {/* Eye Icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 text-sm">
                  
                  <label className={`flex items-center space-x-2 cursor-pointer ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <input 
                      type="checkbox" 
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Remember Me</span>
                  </label>

                  <a href="#" className="text-blue-500 font-medium hover:text-blue-600 transition-colors">
                    Forgot password?
                  </a>
                </div>

                {/* Login Button */}
                <button 
                  type="submit"
                  disabled={loading}
                  className={`bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold mt-2 transition-colors w-full flex items-center justify-center gap-2 ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
