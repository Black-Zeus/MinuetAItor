/**
 * SidebarMenuTitle.jsx
 * Título de grupo de menú
 */

import React from 'react';

const SidebarMenuTitle = ({ children, className = '' }) => {
  return (
    <div className={`sidebar-menu-title ${className}`}>
      {children}
    </div>
  );
};

export default SidebarMenuTitle;
