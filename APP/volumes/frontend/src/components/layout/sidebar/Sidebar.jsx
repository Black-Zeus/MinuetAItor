/**
 * Sidebar.jsx
 * Componente principal del sidebar - 100% Tailwind CSS
 */

import React, { useState } from 'react';
import Icon from '@components/ui/icon/iconManager';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('Dashboard');

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleMenuClick = (menuName) => {
    setActiveMenu(menuName);
    console.log(`${menuName} clicked`);
  };

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
      {/* Toggle Button - Completamente fuera del sidebar */}
      <button 
        className={`
          absolute top-6 z-50 p-2.5 rounded-full
          bg-slate-700 border-2 border-slate-600
          hover:bg-slate-600 transition-all shadow-xl
          ${isCollapsed ? 'right-[-18px]' : 'right-[-18px]'}
        `}
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        <Icon 
          name={isCollapsed ? 'chevron-right' : 'chevron-left'} 
          className="w-4 h-4"
        />
      </button>

      {/* SECCIÓN A: BRANDING */}
      <div className={`
        flex flex-col items-center justify-center p-6 border-b border-white/10
        ${isCollapsed ? 'py-4' : 'py-6'}
      `}>
        {/* Logo centrado */}
        <div className="flex-shrink-0">
          <img 
            src="/chinchinAItor.jpg" 
            alt="MinuetAItor"
            className={`rounded-lg transition-all ${isCollapsed ? 'w-10 h-10' : 'w-16 h-16'}`}
          />
        </div>
        
        {/* Texto debajo del logo */}
        {!isCollapsed && (
          <div className="mt-3 text-center">
            <h1 className="text-lg font-semibold">MinuetAItor</h1>
            <p className="text-xs text-white/70 mt-1">Gestión de Minutas</p>
          </div>
        )}
      </div>

      {/* SECCIÓN B: NAVEGACIÓN */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Grupo Principal */}
        <div className="mb-6">
          {!isCollapsed && (
            <div className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Principal
            </div>
          )}

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Dashboard' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Dashboard'); }}
            title="Dashboard"
          >
            <Icon name="FaChartLine" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Dashboard</span>}
          </a>

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Minutas' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Minutas'); }}
            title="Minutas"
          >
            <Icon name="FaRegFileLines" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Minutas</span>}
          </a>
        </div>

        {/* Grupo Gestión */}
        <div className="mb-6">
          {!isCollapsed && (
            <div className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Gestión
            </div>
          )}

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Clientes' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Clientes'); }}
            title="Clientes"
          >
            <Icon name="FaBuilding" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Clientes</span>}
          </a>

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Proyectos' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Proyectos'); }}
            title="Proyectos"
          >
            <Icon name="FaLayerGroup" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Proyectos</span>}
          </a>

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Equipos' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Equipos'); }}
            title="Equipos"
          >
            <Icon name="FaUsers" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Equipos</span>}
          </a>

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Reportes' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Reportes'); }}
            title="Reportes"
          >
            <Icon name="FaChartBar" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Reportes</span>}
          </a>

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Analíticas' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Analíticas'); }}
            title="Analíticas"
          >
            <Icon name="FaChartSimple" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Analíticas</span>}
          </a>
        </div>

        {/* Grupo Sistema */}
        <div className="mb-6">
          {!isCollapsed && (
            <div className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Sistema
            </div>
          )}

          <a 
            href="#" 
            className={`
              flex items-center px-6 py-3 text-white/90
              hover:bg-white/10 transition-colors
              ${activeMenu === 'Configuración' ? 'bg-white/15 border-l-4 border-primary-500' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            onClick={(e) => { e.preventDefault(); handleMenuClick('Configuración'); }}
            title="Configuración"
          >
            <Icon name="FaFilter" className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Configuración</span>}
          </a>
        </div>
      </nav>

      {/* SECCIÓN C: USER PROFILE */}
      <div className="border-t border-white/10 p-4">
        <div 
          className={`
            flex items-center p-2 rounded-lg
            hover:bg-white/10 transition-colors cursor-pointer
            ${isCollapsed ? 'justify-center' : ''}
          `}
          onClick={() => handleMenuClick('User Profile')}
          title="Perfil de Usuario"
        >
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-semibold text-sm flex-shrink-0">
            JD
          </div>
          {!isCollapsed && (
            <div className="ml-3">
              <p className="text-sm font-semibold">John Doe</p>
              <p className="text-xs text-white/70">Administrador</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;