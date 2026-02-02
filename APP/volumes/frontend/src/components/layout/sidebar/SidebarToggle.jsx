/**
 * SidebarToggle.jsx
 * Botón para colapsar/expandir el sidebar
 */

import React from 'react';
import Icon from '@componentes/ui/icon/iconManager';

const SidebarToggle = ({ isCollapsed, onClick }) => {
  return (
    <button 
      className="sidebar-toggle" 
      id="sidebarToggle" 
      onClick={onClick}
      aria-label="Toggle Sidebar"
    >
      <Icon 
        name={isCollapsed ? 'chevron-right' : 'chevron-left'} 
        className="w-6 h-6"
      />
    </button>
  );
};

export default SidebarToggle;
