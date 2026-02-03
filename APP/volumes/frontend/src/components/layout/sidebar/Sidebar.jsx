/**
 * Sidebar.jsx
 * Componente principal del sidebar - 100% Tailwind CSS
 * Versión refactorizada: modular, componentizada y basada en configuración
 */

import React, { useState } from 'react';
import SidebarToggle from './SidebarToggle';
import SidebarBrand from './SidebarBrand';
import SidebarNav from './SidebarNav';
import SidebarFooter from './SidebarFooter';
import { SIDEBAR_MODULES, filterModulesByPermissions } from '@config/sidebarConfig';

const Sidebar = ({ 
  user = {
    initials: 'JD',
    name: 'John Doe',
    role: 'Administrador',
    isAdmin: true
  },
  onModuleChange = () => {},
  defaultCollapsed = false,
  defaultActiveModule = 'dashboard'
}) => {
  // ====================================
  // ESTADO
  // ====================================
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activeModuleId, setActiveModuleId] = useState(defaultActiveModule);

  // ====================================
  // FILTRADO DE MÓDULOS SEGÚN PERMISOS
  // ====================================
  const visibleModules = filterModulesByPermissions(SIDEBAR_MODULES, user);

  // ====================================
  // HANDLERS
  // ====================================
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleModuleClick = (module) => {
    setActiveModuleId(module.id);
    console.log(`Módulo seleccionado: ${module.name} (${module.id})`);
    
    // Callback al componente padre
    if (onModuleChange) {
      onModuleChange(module);
    }
  };

  const handleUserClick = () => {
    console.log('User profile clicked');
    // Aquí puedes navegar al perfil o abrir un menú
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
        text-white shadow-lg
        ${isCollapsed ? 'w-20' : 'w-[280px]'}
      `}
      id="sidebar"
    >
      {/* Toggle Button */}
      <SidebarToggle 
        isCollapsed={isCollapsed} 
        onClick={toggleSidebar} 
      />

      {/* Brand Section */}
      <SidebarBrand 
        isCollapsed={isCollapsed}
        logoSrc="/chinchinAItor.jpg"
        appName="MinuetAItor"
        tagline="Gestión de Minutas"
      />

      {/* Navigation Section */}
      <SidebarNav 
        modules={visibleModules}
        isCollapsed={isCollapsed}
        activeModuleId={activeModuleId}
        onModuleClick={handleModuleClick}
      />

      {/* Footer Section */}
      <SidebarFooter 
        isCollapsed={isCollapsed}
        user={user}
        onClick={handleUserClick}
      />
    </aside>
  );
};

export default Sidebar;