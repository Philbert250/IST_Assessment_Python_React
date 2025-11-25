import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  // Role-based menu items
  const getMenuItems = () => {
    const role = user?.role || 'staff';
    const isSuperuser = user?.is_superuser || false;

    // Base menu items
    const baseMenu = [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'fas fa-home',
        roles: ['staff', 'approver-level-1', 'approver-level-2', 'finance', 'admin']
      }
    ];

    // Staff menu
    const staffMenu = [
      {
        path: '/requests/my-requests',
        label: 'My Requests',
        icon: 'fas fa-list',
        roles: ['staff']
      },
      {
        path: '/requests/create',
        label: 'Create Request',
        icon: 'fas fa-plus-circle',
        roles: ['staff']
      }
    ];

    // Approver menu
    const approverMenu = [
      {
        path: '/approvals/pending',
        label: 'Pending Approvals',
        icon: 'fas fa-clock',
        roles: ['approver-level-1', 'approver-level-2']
      },
      {
        path: '/requests/all',
        label: 'All Requests',
        icon: 'fas fa-list-alt',
        roles: ['approver-level-1', 'approver-level-2']
      }
    ];

    // Finance menu
    const financeMenu = [
      {
        path: '/requests/approved',
        label: 'Approved Requests',
        icon: 'fas fa-check-circle',
        roles: ['finance']
      },
      {
        path: '/requests/all',
        label: 'All Requests',
        icon: 'fas fa-list-alt',
        roles: ['finance']
      }
    ];

    // Admin menu
    const adminMenu = [
      {
        path: '/requests/all',
        label: 'All Requests',
        icon: 'fas fa-list-alt',
        roles: ['admin']
      },
      {
        path: '/admin/users',
        label: 'Users Management',
        icon: 'fas fa-users',
        roles: ['admin']
      },
      {
        path: '/admin/request-types',
        label: 'Request Types',
        icon: 'fas fa-tags',
        roles: ['admin']
      },
      {
        path: '/admin/approval-levels',
        label: 'Approval Levels',
        icon: 'fas fa-layer-group',
        roles: ['admin']
      }
    ];

    // Common menu items
    const commonMenu = [
      {
        path: '/profile',
        label: 'Profile',
        icon: 'fas fa-user',
        roles: ['staff', 'approver-level-1', 'approver-level-2', 'finance', 'admin']
      }
    ];

    // Combine all menus
    let allMenuItems = [...baseMenu];

    if (isSuperuser) {
      // Superuser sees all admin items
      allMenuItems = [
        ...allMenuItems,
        ...staffMenu,
        ...approverMenu,
        ...financeMenu,
        ...adminMenu,
        ...commonMenu
      ];
    } else {
      // Regular users see items based on their role
      if (role === 'staff') {
        allMenuItems = [...allMenuItems, ...staffMenu, ...commonMenu];
      } else if (role === 'approver-level-1' || role === 'approver-level-2') {
        allMenuItems = [...allMenuItems, ...approverMenu, ...commonMenu];
      } else if (role === 'finance') {
        allMenuItems = [...allMenuItems, ...financeMenu, ...commonMenu];
      } else if (role === 'admin') {
        allMenuItems = [...allMenuItems, ...adminMenu, ...commonMenu];
      }
    }

    return allMenuItems;
  };

  const menuItems = getMenuItems();

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-[80px] lg:top-0 left-0 h-[calc(100vh-80px)] lg:h-screen z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isDark ? 'bg-gray-800' : 'bg-white'} border-r ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        } w-64 overflow-y-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              Procure-to-Pay
            </h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {user?.role_display || user?.role || 'User'}
            </p>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    // Close mobile menu when clicking a link
                    if (window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? isDark
                        ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                      : isDark
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <i className={`${item.icon} w-5 text-center`}></i>
                  <span className="font-medium">{item.label}</span>
                  {active && (
                    <div
                      className={`ml-auto w-2 h-2 rounded-full ${
                        isDark ? 'bg-blue-400' : 'bg-blue-600'
                      }`}
                    ></div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Version 1.0.0</p>
              <p className="mt-1">© 2025 Procure-to-Pay</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

