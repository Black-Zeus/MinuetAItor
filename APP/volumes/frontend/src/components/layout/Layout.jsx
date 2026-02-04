import React from 'react';
import Sidebar from './sidebar/Sidebar';
import Header from './header/Header';
import TailwindDarkTest from '../TailwindDarkTest';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800">
          {children}
        </main>
      </div>

      {/* 🔍 DEBUG COMPONENT - Remover en producción */}
      <TailwindDarkTest />
    </div>
  );
};

export default Layout;