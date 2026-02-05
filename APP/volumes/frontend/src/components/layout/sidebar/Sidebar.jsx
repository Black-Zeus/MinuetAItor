import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const {
    isSidebarCollapsed,
    toggleSidebar,
    addToNavigationHistory
  } = useBaseSiteStore();

  const activePath = pathname || '/';

  const visibleModules = filterModulesByPermissions(SIDEBAR_MODULES, user);

  const handleModuleClick = (module) => {
    // Historial (opcional)
    addToNavigationHistory({
      name: module.name,
      path: module.path || `/${module.id}`,
      icon: module.icon
    });

    // Navegación real
    if (module.path) {
      navigate(module.path);
    }

    onModuleChange?.(module);
  };

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
      <SidebarToggle isCollapsed={isSidebarCollapsed} onClick={toggleSidebar} />

      <SidebarBrand
        isCollapsed={isSidebarCollapsed}
        logoSrc="/chinchinAItor.jpg"
        appName="MinuetAItor"
        tagline="Gestión de Minutas"
      />

      <SidebarNav
        modules={visibleModules}
        isCollapsed={isSidebarCollapsed}
        activePath={activePath}
        onModuleClick={handleModuleClick}
      />

      <SidebarFooter
        isCollapsed={isSidebarCollapsed}
        user={user}
        onClick={() => {}}
      />
    </aside>
  );
};

export default Sidebar;
