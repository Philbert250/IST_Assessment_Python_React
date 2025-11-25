import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

const Header = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Role-based menu items - recalculate when user changes
  const menuItems = useMemo(() => {
    if (!user && !loading) {
      return []; // No menu items if no user and not loading
    }

    const role = user?.role || 'staff';
    const isSuperuser = user?.is_superuser || false;

    // Base menu items
    const baseMenu = [
      {
        path: '/dashboard',
        label: 'Dashboard',
        roles: ['staff', 'approver_level_1', 'approver_level_2', 'approver-level-1', 'approver-level-2', 'finance', 'admin']
      }
    ];

    // Staff menu
    const staffMenu = [
      {
        path: '/requests/my-requests',
        label: 'My Requests',
        roles: ['staff']
      },
      {
        path: '/requests/create',
        label: 'Create Request',
        roles: ['staff']
      }
    ];

    // Approver menu
    const approverMenu = [
      {
        path: '/approvals/pending',
        label: 'Pending Approvals',
        roles: ['approver_level_1', 'approver_level_2', 'approver-level-1', 'approver-level-2']
      },
      {
        path: '/requests/all',
        label: 'All Requests',
        roles: ['approver_level_1', 'approver_level_2', 'approver-level-1', 'approver-level-2']
      }
    ];

    // Finance menu
    const financeMenu = [
      {
        path: '/requests/approved',
        label: 'Approved Requests',
        roles: ['finance']
      },
      {
        path: '/requests/all',
        label: 'All Requests',
        roles: ['finance']
      }
    ];

    // Admin menu
    const adminMenu = [
      {
        path: '/requests/all',
        label: 'All Requests',
        roles: ['admin']
      },
      {
        path: '/admin/users',
        label: 'Users',
        roles: ['admin']
      },
      {
        path: '/admin/request-types',
        label: 'Request Types',
        roles: ['admin']
      },
      {
        path: '/admin/approval-levels',
        label: 'Approval Levels',
        roles: ['admin']
      }
    ];

    // Combine all menus
    let allMenuItems = [...baseMenu];

    if (isSuperuser) {
      // Superuser sees all admin items (but not duplicate if role is also 'admin')
      // Only add admin menu if role is not already 'admin' to avoid duplication
      if (role !== 'admin') {
        allMenuItems = [
          ...allMenuItems,
          ...staffMenu,
          ...approverMenu,
          ...financeMenu,
          ...adminMenu
        ];
      } else {
        // If role is 'admin' and isSuperuser, just add admin menu once
        allMenuItems = [...allMenuItems, ...adminMenu];
      }
    } else {
      // Regular users see items based on their role
      if (role === 'staff') {
        allMenuItems = [...allMenuItems, ...staffMenu];
      } else if (role === 'approver_level_1' || role === 'approver_level_2' || 
                 role === 'approver-level-1' || role === 'approver-level-2') {
        allMenuItems = [...allMenuItems, ...approverMenu];
      } else if (role === 'finance') {
        allMenuItems = [...allMenuItems, ...financeMenu];
      } else if (role === 'admin') {
        allMenuItems = [...allMenuItems, ...adminMenu];
      }
    }

    // Remove duplicates based on path
    const uniqueMenuItems = [];
    const seenPaths = new Set();
    for (const item of allMenuItems) {
      if (!seenPaths.has(item.path)) {
        seenPaths.add(item.path);
        uniqueMenuItems.push(item);
      }
    }

    return uniqueMenuItems;
  }, [user, loading]); // Recalculate when user or loading state changes

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 backdrop-blur-md ${
      isDark 
        ? 'bg-gray-900/80 border-b border-gray-800' 
        : 'bg-white/80 border-b border-gray-200 shadow-sm'
    }`}>
      <div className="px-4 sm:px-6 lg:px-10 w-full">
        <div className="flex justify-between items-center py-4 sm:py-6">
          {/* Left Side - Logo and Desktop Nav */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Logo */}
            <div 
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-br from-blue-600 to-blue-700 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
            >
              P
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex gap-6">
              {menuItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`font-medium relative transition-colors px-2 py-1 rounded-md ${
                      active
                        ? isDark
                          ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-800'
                          : 'text-blue-600 hover:text-blue-700 hover:bg-gray-200'
                        : isDark
                        ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                    } ${
                      active ? 'after:content-[\'\'] after:absolute after:w-full after:h-[3px] after:bg-blue-600 after:bottom-0 after:left-0 after:rounded-full' : ''
                    }`}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isDark 
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700 hover:scale-105' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:scale-105 shadow-sm'
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

            {/* Search Button */}
            <button className={`hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full items-center justify-center transition-all duration-200 ${
              isDark 
                ? 'border border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600 hover:bg-gray-800' 
                : 'border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-white shadow-sm'
            }`}>
              <i className="fas fa-search text-sm"></i>
            </button>

            {/* Notifications Button */}
            <button className={`hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full items-center justify-center transition-all duration-200 relative ${
              isDark 
                ? 'border border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600 hover:bg-gray-800' 
                : 'border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-white shadow-sm'
            }`}>
              <i className="fas fa-bell text-sm"></i>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Profile Avatar with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white w-9 h-9 rounded-full flex items-center justify-center font-semibold shadow-md cursor-pointer hover:scale-105 transition-transform"
              >
                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </button>

              {profileMenuOpen && (
                <>
                  {/* Backdrop to close menu */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setProfileMenuOpen(false)}
                  ></div>
                  
                  {/* Dropdown Menu */}
                  <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-20 ${
                    isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                  }`}>
                    <div className={`block px-4 py-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Signed in as
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        {user?.username || 'Guest'}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                        {user?.email || ''}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                        Role: {user?.role_display || user?.role || 'N/A'}
                      </p>
                    </div>
                    <div className={`border-t my-1 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/profile');
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <i className="fas fa-user-circle mr-2"></i> Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className={`block w-full text-left px-4 py-2 text-sm ${isDark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-red-50'}`}
                    >
                      <i className="fas fa-sign-out-alt mr-2"></i> Logout
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <i className="fas fa-times text-lg"></i>
              ) : (
                <i className="fas fa-bars text-lg"></i>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`lg:hidden transition-all duration-300 overflow-hidden ${
          mobileMenuOpen ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0 pb-0'
        }`}>
          <nav className={`mx-4 sm:mx-6 lg:mx-10 rounded-xl shadow-lg p-4 space-y-2 backdrop-blur-md ${
            isDark ? 'bg-gray-800/90 border border-gray-700' : 'bg-white/90 border border-gray-200'
          }`}>
            {menuItems.map((item) => {
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    active
                      ? isDark
                        ? 'text-blue-400 bg-gray-700/50 hover:bg-gray-700'
                        : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <i className={`fas fa-${item.path.includes('dashboard') ? 'home' : item.path.includes('request') ? 'shopping-cart' : item.path.includes('approval') ? 'check-circle' : item.path.includes('admin') ? 'cog' : 'file-alt'} mr-3`}></i>
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;

