/**
 * SidebarFooter.jsx
 * Sección inferior del sidebar, contenedor flexible
 */

import React from 'react';

const SidebarFooter = ({ children, className = '' }) => {
  return (
    <div className={`sidebar-footer ${className}`}>
      {children}
    </div>
  );
};

export default SidebarFooter;
