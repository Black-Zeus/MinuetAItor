/**
 * SidebarContainer.jsx
 * Componente principal del sidebar que maneja el estado colapsado/expandido - 100% Tailwind
 */

import React, { useState } from 'react';
import SidebarToggle from './SidebarToggle';

const SidebarContainer = ({ 
  children,
  defaultCollapsed = false,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <aside 
      className={`
        flex flex-col h-screen relative overflow-visible
        transition-all duration-300 ease-in-out
        bg-gradient-to-b from-slate-700 to-slate-800
        text-white shadow-lg
        ${isCollapsed ? 'w-20' : 'w-[280px]'}
        ${className}
      `}
      id="sidebar"
    >
      <SidebarToggle 
        isCollapsed={isCollapsed} 
        onClick={toggleSidebar} 
      />
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { isCollapsed });
        }
        return child;
      })}
    </aside>
  );
};

export default SidebarContainer;