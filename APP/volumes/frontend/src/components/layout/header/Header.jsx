/**
 * Header.jsx
 * Componente principal del header integrado con Zustand store
 */

import React, { useState } from 'react';
import HeaderContainer from './HeaderContainer';
import HeaderBreadcrumb from './HeaderBreadcrumb';
import HeaderSearch from './HeaderSearch';
import HeaderActionButton from './HeaderActionButton';
import HeaderThemeToggle from './HeaderThemeToggle';
import HeaderDivider from './HeaderDivider';
import HeaderUserMenu from './HeaderUserMenu';
import useBaseSiteStore from '@store/baseSiteStore';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // ====================================
  // ZUSTAND STORE
  // ====================================
  const {
    theme,
    toggleTheme,
    navigationHistory,
    unreadNotificationsCount,
    resetUnreadNotifications
  } = useBaseSiteStore();

  // ====================================
  // HANDLERS
  // ====================================
  const handleSearch = (query) => {
    // TODO: implementar búsqueda global
    console.log('Searching:', query);
  };

  const handleNotificationsClick = () => {
    resetUnreadNotifications();
  };

  // ====================================
  // BREADCRUMB DINÁMICO DESDE STORE
  // ====================================
  const currentSection = navigationHistory[0] || {
    name: 'Dashboard',
    path: '/'
  };

  const breadcrumbItems = [
    {
      label: 'Inicio',
      href: '/',
      onClick: (e) => {
        e.preventDefault();
      }
    },
    {
      label: currentSection.name
    }
  ];

  // ====================================
  // USER MENU ITEMS
  // ====================================
  const userMenuItems = [
    {
      label: 'Mi Perfil',
      icon: 'FaPerson',
      onClick: () => {}
    },
    {
      label: 'Configuración',
      icon: 'FaGear',
      onClick: () => {}
    },
    {
      label: 'Ayuda & Soporte',
      icon: 'FaCircleInfo',
      onClick: () => {}
    }
  ];

  return (
    <HeaderContainer>
      {/* LEFT SECTION */}
      <HeaderBreadcrumb
        title={currentSection.name}
        items={breadcrumbItems}
      />

      {/* RIGHT SECTION */}
      <div className="flex items-center space-x-4">
        {/* SEARCH */}
        <HeaderSearch
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSubmit={handleSearch}
          placeholder="Buscar Minutas..."
        />

        {/* ACTION BUTTONS */}
        <div className="flex items-center space-x-2">
          <HeaderActionButton
            iconName="FaBell"
            onClick={handleNotificationsClick}
            ariaLabel="Notificaciones"
            showBadge={unreadNotificationsCount > 0}
            badgeCount={unreadNotificationsCount}
          />

          <HeaderActionButton
            iconName="FaEnvelope"
            onClick={() => {}}
            ariaLabel="Mensajes"
          />

          <HeaderThemeToggle
            onClick={toggleTheme}
            currentTheme={theme}
          />
        </div>

        {/* DIVIDER */}
        <HeaderDivider />

        {/* USER MENU */}
        <HeaderUserMenu
          initials="JD"
          name="John Doe"
          role="Administrador"
          email="john.doe@example.com"
          menuItems={userMenuItems}
          onLogout={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    </HeaderContainer>
  );
};

export default Header;