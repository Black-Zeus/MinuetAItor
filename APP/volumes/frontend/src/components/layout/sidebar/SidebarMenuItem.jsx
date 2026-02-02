/**
 * SidebarMenuItem.jsx
 * Item individual de navegación con icono - 100% Tailwind
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const SidebarMenuItem = ({ 
  label,
  iconName,
  href = '#',
  active = false,
  onClick,
  tooltip,
  isCollapsed = false,
  className = ''
}) => {
  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <a 
      href={href}
      className={`
        flex items-center px-6 py-3 text-white/90
        hover:bg-white/10 transition-colors
        ${active ? 'bg-white/15 border-l-4 border-primary-500' : ''}
        ${isCollapsed ? 'justify-center' : ''}
        ${className}
      `}
      onClick={handleClick}
      title={tooltip || label}
    >
      <Icon name={iconName} className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && <span className="ml-3 font-medium">{label}</span>}
    </a>
  );
};

export default SidebarMenuItem;