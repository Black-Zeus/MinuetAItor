import React from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from './sidebar/Sidebar';
import Header from './header/Header';

const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
