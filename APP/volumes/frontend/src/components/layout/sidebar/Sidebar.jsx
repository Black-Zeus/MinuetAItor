import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SidebarToggle from './SidebarToggle';
import SidebarBrand from './SidebarBrand';
import SidebarNav from './SidebarNav';
import SidebarFooter from './SidebarFooter';
import { SIDEBAR_MODULES, filterModulesByPermissions } from '@config/sidebarConfig';
import useBaseSiteStore from '@store/baseSiteStore';
import useAuthStore from '@store/authStore';
import contextSettingsService from '@/services/contextSettingsService';

const Sidebar = ({
  user = {
    initials: 'JD',
    name: 'John Doe',
    role: 'Administrador',
    isAdmin: true
  },
  isOperationLocked = false,
  operationMode = 'normal',
  onModuleChange = () => {}
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isSidebarCollapsed   = useBaseSiteStore((s) => s.sidebar?.collapsed ?? false);
  const toggleSidebar        = useBaseSiteStore((s) => s.toggleSidebar);
  const addToNavigationHistory = useBaseSiteStore((s) => s.addToNavigationHistory);
  const logout = useAuthStore((s) => s.logout);
  const [isKnowledgeSearchAvailable, setIsKnowledgeSearchAvailable] = useState(false);

  const activePath = pathname || '/';
  const userWithFeatures = useMemo(() => ({
    ...user,
    enabledFeatures: {
      ...(user?.enabledFeatures || {}),
      knowledgeSearch: isKnowledgeSearchAvailable,
    },
  }), [isKnowledgeSearchAvailable, user]);

  useEffect(() => {
    let alive = true;
    const handleAvailabilityChange = (event) => {
      if (!alive) return;
      setIsKnowledgeSearchAvailable(Boolean(event?.detail?.available));
    };

    window.addEventListener('knowledge-search-availability-change', handleAvailabilityChange);

    contextSettingsService.getAvailability()
      .then((result) => {
        if (!alive) return;
        setIsKnowledgeSearchAvailable(Boolean(result?.available));
      })
      .catch(() => {
        if (alive) setIsKnowledgeSearchAvailable(false);
      });
    return () => {
      alive = false;
      window.removeEventListener('knowledge-search-availability-change', handleAvailabilityChange);
    };
  }, []);

  const visibleModules = filterModulesByPermissions(SIDEBAR_MODULES, userWithFeatures)
    .filter((module) => {
      if (!isOperationLocked) return true;
      if (operationMode === 'commissioning') return module.section === 'config';
      return module.id === 'system';
    });

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

  const handleLogout = () => {
    logout('Manual logout from sidebar');
    navigate('/login', { replace: true });
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
        logoSrc="/images/chinchinAItor.jpg"
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
        isOperationLocked={isOperationLocked}
        user={user}
        onOpenProfile={() => navigate('/settings/userProfile')}
        onOpenPreferences={() => navigate('/settings/userProfile?tab=customization')}
        onLogout={handleLogout}
      />
    </aside>
  );
};

export default Sidebar;
