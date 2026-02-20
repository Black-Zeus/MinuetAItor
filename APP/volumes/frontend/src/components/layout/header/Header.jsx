/**
 * Header.jsx
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderContainer    from './HeaderContainer';
import HeaderBreadcrumb   from './HeaderBreadcrumb';
import HeaderSearch       from './HeaderSearch';
import HeaderActionButton from './HeaderActionButton';
import HeaderThemeToggle  from './HeaderThemeToggle';
import HeaderDivider      from './HeaderDivider';
import HeaderUserMenu     from './HeaderUserMenu';
import useBaseSiteStore   from '@store/baseSiteStore';
import useAuthStore       from '@store/authStore';
import useSessionStore    from '@store/sessionStore';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const { theme, toggleTheme } = useBaseSiteStore();
  const logout       = useAuthStore((s) => s.logout);
  const getDisplayData = useSessionStore((s) => s.getDisplayData);
  const userDisplay  = getDisplayData();

  const handleLogout = () => {
    logout('Manual logout');
    navigate('/login', { replace: true });
  };

  const userMenuItems = [
    { label: 'Mi Perfil',      icon: 'FaPerson',      onClick: () => navigate('/settings/userProfile') },
    { label: 'Configuración',  icon: 'FaGear',        onClick: () => navigate('/settings/system') },
    { label: 'Ayuda & Soporte',icon: 'FaCircleInfo',  onClick: () => navigate('/help') },
  ];

  const userName     = userDisplay?.fullName  || userDisplay?.username || 'Usuario';
  const userInitials = userDisplay?.initials  || userName.substring(0, 2).toUpperCase();
  const userEmail    = userDisplay?.email     || '';
  const userRole     = userDisplay?.job_title || 'Sin rol';

  return (
    <HeaderContainer>
      {/* LEFT — HeaderBreadcrumb ahora es autónomo, sin props de items */}
      <HeaderBreadcrumb />

      {/* RIGHT */}
      <div className="flex items-center space-x-4">
        <HeaderSearch
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar Minutas..."
        />
        <div className="flex items-center space-x-2">
          <HeaderActionButton iconName="FaBell"     onClick={() => {}} ariaLabel="Notificaciones" />
          <HeaderActionButton iconName="FaEnvelope" onClick={() => {}} ariaLabel="Mensajes" />
          <HeaderThemeToggle onClick={toggleTheme} currentTheme={theme} />
        </div>
        <HeaderDivider />
        <HeaderUserMenu
          initials={userInitials}
          name={userName}
          role={userRole}
          email={userEmail}
          menuItems={userMenuItems}
          onLogout={handleLogout}
        />
      </div>
    </HeaderContainer>
  );
};

export default Header;