/**
 * SidebarBrand.jsx
 * Sección de branding con logo y texto - 100% Tailwind
 */

import React from 'react';

const SidebarBrand = ({ 
  logoSrc, 
  title, 
  subtitle,
  isCollapsed = false,
  className = ''
}) => {
  return (
    <div className={`
      flex flex-col items-center justify-center p-6 border-b border-white/10
      ${isCollapsed ? 'py-4' : 'py-6'}
      ${className}
    `}>
      {logoSrc && (
        <div className="flex-shrink-0">
          <img 
            src={logoSrc} 
            alt={title}
            className={`rounded-lg transition-all ${isCollapsed ? 'w-10 h-10' : 'w-16 h-16'}`}
          />
        </div>
      )}
      {!isCollapsed && (
        <div className="mt-3 text-center">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
        </div>
      )}
    </div>
  );
};

export default SidebarBrand;