/**
 * SidebarMenuGroup.jsx
 * Componente para renderizar un grupo de menú con título - 100% Tailwind
 */

import React from 'react';
import SidebarMenuItem from './SidebarMenuItem';

const SidebarMenuGroup = ({ 
  section,
  modules = [],
  isCollapsed = false,
  activeModuleId = null,
  onModuleClick = () => {}
}) => {
  if (!modules || modules.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Título de la sección - solo visible si no está colapsado */}
      {!isCollapsed && section?.title && (
        <div className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          {section.title}
        </div>
      )}

      {/* Items del menú */}
      <div className="space-y-0.5">
        {modules.map((module) => (
          <SidebarMenuItem
            key={module.id}
            module={module}
            isCollapsed={isCollapsed}
            isActive={activeModuleId === module.id}
            onClick={() => onModuleClick(module)}
          />
        ))}
      </div>
    </div>
  );
};

export default SidebarMenuGroup;