import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import Header from '../Header/Header';

const Layout = ({ children }) => {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'
    }`}>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="min-h-[calc(100vh-80px)]">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

