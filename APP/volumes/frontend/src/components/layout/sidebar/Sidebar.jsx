/**
 * Sidebar.jsx
 * Componente principal del sidebar integrado con Zustand store
 */

import React from 'react';
import SidebarToggle from './SidebarToggle';
import SidebarBrand from './SidebarBrand';
import SidebarNav from './SidebarNav';
import SidebarFooter from './SidebarFooter';
import { SIDEBAR_MODULES, filterModulesByPermissions } from '@config/sidebarConfig';
import useBaseSiteStore from '@store/baseSiteStore';

const Sidebar = ({ 
  user = {
    initials: 'JD',
    name: 'John Doe',
    role: 'Administrador',
    isAdmin: true
  },
  onModuleChange = () => {}
}) => {
  // ====================================
  // ZUSTAND STORE
  // ====================================
  const { 
    isSidebarCollapsed,
    toggleSidebar,
    addToNavigationHistory,
    navigationHistory
  } = useBaseSiteStore();

  // ====================================
  // ACTIVE MODULE desde navigationHistory
  // ====================================
  const currentSection = navigationHistory[0];
  const activeModuleId = currentSection?.path?.split('/')[1] || 'dashboard';

  // ====================================
  // FILTRADO DE MÓDULOS SEGÚN PERMISOS
  // ====================================
  const visibleModules = filterModulesByPermissions(SIDEBAR_MODULES, user);

  // ====================================
  // HANDLERS
  // ====================================
  const handleModuleClick = (module) => {
    console.log(`Módulo seleccionado: ${module.name} (${module.id})`);
    
    // ✅ Guardar en historial de navegación
    addToNavigationHistory({
      name: module.name,
      path: module.path || `/${module.id}`,
      icon: module.icon
    });
    
    // Callback al componente padre
    if (onModuleChange) {
      onModuleChange(module);
    }
  };

  const handleUserClick = () => {
    console.log('User profile clicked');
  };

  // ====================================
  // RENDER
  // ====================================
  return (
    <aside 
      className={`
        flex flex-col h-screen relative overflow-visible
        transition-all duration-300 ease-in-out
        bg-gradient-to-b from-slate-700 to-slate-800
        dark:from-slate-900 dark:to-black
        text-white shadow-lg
        ${isSidebarCollapsed ? 'w-20' : 'w-[280px]'}
      `}
      id="sidebar"
    >
      {/* Toggle Button - Conectado al store */}
      <SidebarToggle 
        isCollapsed={isSidebarCollapsed}
        onClick={toggleSidebar}
      />

      {/* Brand Section */}
      <SidebarBrand 
        isCollapsed={isSidebarCollapsed}
        logoSrc="/chinchinAItor.jpg"
        appName="MinuetAItor"
        tagline="Gestión de Minutas"
      />

      {/* Navigation Section */}
      <SidebarNav 
        modules={visibleModules}
        isCollapsed={isSidebarCollapsed}
        activeModuleId={activeModuleId} // ✅ Dinámico desde store
        onModuleClick={handleModuleClick}
      />

      {/* Footer Section */}
      <SidebarFooter 
        isCollapsed={isSidebarCollapsed}
        user={user}
        onClick={handleUserClick}
      />
    </aside>
  );
};

export default Sidebar;