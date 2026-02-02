/**
 * SidebarMenuGroup.jsx
 * Agrupa items de menú bajo un título opcional
 */

import React from 'react';
import SidebarMenuTitle from './SidebarMenuTitle';

const SidebarMenuGroup = ({ 
  title, 
  children, 
  className = '' 
}) => {
  return (
    <div className={`sidebar-menu-group ${className}`}>
      {title && <SidebarMenuTitle>{title}</SidebarMenuTitle>}
      {children}
    </div>
  );
};

export default SidebarMenuGroup;
