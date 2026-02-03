/**
 * SidebarFooter.jsx
 * Componente para el footer del sidebar con información de usuario - 100% Tailwind
 */

import React from 'react';

const SidebarFooter = ({ 
  isCollapsed = false,
  user = {
    initials: 'JD',
    name: 'John Doe',
    role: 'Administrador'
  },
  onClick = () => {}
}) => {
  return (
    <div className="border-t border-white/10 p-4">
      <div 
        className={`
          flex items-center p-3 rounded-lg
          hover:bg-white/10 transition-colors cursor-pointer
          ${isCollapsed ? 'justify-center' : ''}
        `}
        onClick={onClick}
        title={`${user.name} - ${user.role}`}
      >
        {/* Avatar con iniciales */}
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {user.initials || 'U'}
        </div>
        
        {/* Información de usuario - solo visible si no está colapsado */}
        {!isCollapsed && (
          <div className="ml-3">
            <p className="text-sm font-semibold">{user.name || 'Usuario'}</p>
            <p className="text-xs text-white/70">{user.role || 'Rol'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarFooter;