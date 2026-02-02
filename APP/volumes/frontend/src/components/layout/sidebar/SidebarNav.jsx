/**
 * SidebarNav.jsx
 * Contenedor de navegación principal que agrupa MenuGroups
 */

import React from 'react';

const SidebarNav = ({ children, className = '' }) => {
  return (
    <nav className={`sidebar-nav ${className}`}>
      {children}
    </nav>
  );
};

export default SidebarNav;
