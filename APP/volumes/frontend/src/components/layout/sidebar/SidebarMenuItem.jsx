/**
 * SidebarMenuItem.jsx
 * Componente para renderizar un item individual del menú - 100% Tailwind
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const SidebarMenuItem = ({ 
  module,
  isCollapsed = false,
  isActive = false,
  onClick = () => {}
}) => {
  if (!module) return null;

  return (
    <a 
      href={module.path || '#'} 
      className={`
        flex items-center px-6 py-3 text-white/90
        hover:bg-white/10 transition-colors cursor-pointer
        ${isActive ? 'bg-white/15 border-l-4 border-primary-500' : ''}
        ${isCollapsed ? 'justify-center' : ''}
      `}
      onClick={(e) => {
        e.preventDefault();
        onClick(module);
      }}
      title={module.name}
      aria-label={module.name}
    >
      {/* Icono */}
      <Icon 
        name={module.icon} 
        className="w-5 h-5 flex-shrink-0" 
      />
      
      {/* Texto - solo visible si no está colapsado */}
      {!isCollapsed && (
        <span className="ml-3 font-medium">
          {module.name}
        </span>
      )}
    </a>
  );
};

export default SidebarMenuItem;