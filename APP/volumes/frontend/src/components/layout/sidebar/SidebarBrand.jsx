/**
 * SidebarBrand.jsx
 * Componente para la sección de branding/logo del sidebar - 100% Tailwind
 */

import React from 'react';

const SidebarBrand = ({ 
  isCollapsed = false,
  logoSrc = '/chinchinAItor.jpg',
  appName = 'MinuetAItor',
  tagline = 'Gestión de Minutas'
}) => {
  return (
    <div className={`
      flex flex-col items-center justify-center p-6 border-b border-white/10
      ${isCollapsed ? 'py-4' : 'py-6'}
    `}>
      {/* Logo centrado */}
      <div className="flex-shrink-0">
        <img 
          src={logoSrc} 
          alt={appName}
          className={`
            rounded-lg transition-all 
            ${isCollapsed ? 'w-10 h-10' : 'w-16 h-16'}
          `}
        />
      </div>
      
      {/* Texto debajo del logo - solo visible si no está colapsado */}
      {!isCollapsed && (
        <div className="mt-3 text-center">
          <h1 className="text-lg font-semibold">{appName}</h1>
          <p className="text-xs text-white/70 mt-1">{tagline}</p>
        </div>
      )}
    </div>
  );
};

export default SidebarBrand;