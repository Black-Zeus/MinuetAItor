/**
 * SidebarNav.jsx
 * Componente que orquesta la navegación completa del sidebar - 100% Tailwind
 */

import React from 'react';
import SidebarMenuGroup from './SidebarMenuGroup';
import { SIDEBAR_SECTIONS } from '@config/sidebarConfig';

const SidebarNav = ({ 
  modules = [],
  isCollapsed = false,
  activeModuleId = null,
  onModuleClick = () => {}
}) => {
  // Agrupar módulos por sección
  const groupedModules = modules.reduce((acc, module) => {
    const sectionId = module.section || 'other';
    if (!acc[sectionId]) {
      acc[sectionId] = [];
    }
    acc[sectionId].push(module);
    return acc;
  }, {});

  // Ordenar secciones según el orden definido en SIDEBAR_SECTIONS
  const sortedSections = Object.keys(groupedModules).sort((a, b) => {
    const orderA = SIDEBAR_SECTIONS[a]?.order || 999;
    const orderB = SIDEBAR_SECTIONS[b]?.order || 999;
    return orderA - orderB;
  });

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {sortedSections.map((sectionId) => (
        <SidebarMenuGroup
          key={sectionId}
          section={SIDEBAR_SECTIONS[sectionId]}
          modules={groupedModules[sectionId]}
          isCollapsed={isCollapsed}
          activeModuleId={activeModuleId}
          onModuleClick={onModuleClick}
        />
      ))}
    </nav>
  );
};

export default SidebarNav;