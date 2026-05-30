/**
 * Header.jsx
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderContainer    from './HeaderContainer';
import HeaderBreadcrumb   from './HeaderBreadcrumb';
import HeaderSearch       from './HeaderSearch';
import HeaderNotificationsBell from './HeaderNotificationsBell';
import HeaderThemeToggle  from './HeaderThemeToggle';
import HeaderDivider      from './HeaderDivider';
import HeaderUserMenu     from './HeaderUserMenu';
import personalizationService from '@/services/personalizationService';
import useBaseSiteStore   from '@store/baseSiteStore';
import useAuthStore       from '@store/authStore';
import useSessionStore    from '@store/sessionStore';

const Header = ({
  isOperationLocked = false,
  operationLabel = 'mantenimiento',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const theme = useBaseSiteStore((s) => s.theme);
  const setTheme = useBaseSiteStore((s) => s.setTheme);
  const hydratePersonalization = useBaseSiteStore((s) => s.hydratePersonalization);
  const logout       = useAuthStore((s) => s.logout);
  const getDisplayData = useSessionStore((s) => s.getDisplayData);
  const userDisplay  = getDisplayData();

  const handleLogout = () => {
    logout('Manual logout');
    navigate('/login', { replace: true });
  };

  const handleThemeToggle = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);

    try {
      const payload = useBaseSiteStore.getState().getPersonalizationSnapshot();
      const persisted = await personalizationService.updateMyPersonalization(payload);
      hydratePersonalization(persisted);
    } catch {
      // El cambio local se conserva; la próxima edición de personalización puede reintentar la sincronización.
    }
  };

  const userMenuItems = [
    ...(isOperationLocked ? [] : [
      { label: 'Mi Perfil',      icon: 'FaPerson',      onClick: () => navigate('/settings/userProfile') },
      { label: 'Preferencias',   icon: 'FaSliders',     onClick: () => navigate('/settings/userProfile?tab=customization') },
      { label: 'Seguridad',      icon: 'FaUserShield',  onClick: () => navigate('/settings/userProfile?tab=security') },
      { label: 'Sesiones',       icon: 'FaClockRotateLeft', onClick: () => navigate('/settings/userProfile?tab=sessions') },
    ]),
    { label: 'Configuración',  icon: 'FaGear',        onClick: () => navigate('/settings/system?tab=maintenance') },
  ];

  return (
    <HeaderContainer>
      {/* LEFT — HeaderBreadcrumb ahora es autónomo, sin props de items */}
      <HeaderBreadcrumb />

      {/* RIGHT */}
      <div className="flex items-center space-x-4">
        {isOperationLocked ? (
          <div className="hidden md:flex items-center rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-200">
            {operationLabel === "puesta en marcha" ? "Sistema en puesta en marcha" : `Sistema en modo ${operationLabel}`}
          </div>
        ) : (
          <HeaderSearch
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar Minutas..."
          />
        )}
        <div className="flex items-center space-x-2">
          <HeaderThemeToggle onClick={handleThemeToggle} currentTheme={theme} />
          {!isOperationLocked && <HeaderNotificationsBell />}
        </div>
        <HeaderDivider />
        <HeaderUserMenu
          avatar={userDisplay?.avatarUrl}
          initials={userDisplay?.initials || 'U'}
          name={userDisplay?.fullName || userDisplay?.username || 'Usuario'}
          role={userDisplay?.position || 'Sin rol'}
          email={userDisplay?.email || ''}
          menuItems={userMenuItems}
          onLogout={handleLogout}
        />
      </div>
    </HeaderContainer>
  );
};

export default Header;
