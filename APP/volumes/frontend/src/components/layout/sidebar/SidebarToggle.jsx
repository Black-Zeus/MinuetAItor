/**
 * SidebarToggle.jsx
 * Componente del botón toggle para colapsar/expandir el sidebar - 100% Tailwind
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const SidebarToggle = ({ 
  isCollapsed = false,
  onClick = () => {}
}) => {
  return (
    <button 
      className={`
        absolute top-6 z-50 p-2.5 rounded-full
        bg-slate-700 border-2 border-slate-600
        hover:bg-slate-600 transition-all shadow-xl
        ${isCollapsed ? 'right-[-18px]' : 'right-[-18px]'}
      `}
      onClick={onClick}
      aria-label="Toggle Sidebar"
      title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
    >
      <Icon 
        name={isCollapsed ? 'chevron-right' : 'chevron-left'} 
        className="w-4 h-4"
      />
    </button>
  );
};

export default SidebarToggle;