/**
 * Header.jsx
 * Componente principal del header integrado con Zustand store.
 *
 * Breadcrumb derivado desde URL via useBreadcrumb hook:
 * - Lee sidebarConfig como fuente de verdad
 * - Funciona con cualquier tipo de navegación (sidebar, links, URL directa, búsqueda)
 * - Soporta 3 niveles: Inicio > Módulo > Submódulo
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
import useBreadcrumb from '@/hooks/useBreadcrumb';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // ====================================
  // ZUSTAND STORE
  // ====================================
  const {
    theme,
    toggleTheme,
    unreadNotificationsCount,
    resetUnreadNotifications
  } = useBaseSiteStore();

  // ====================================
  // BREADCRUMB — derivado desde URL
  // No depende del store ni de clicks en el sidebar.
  // Se actualiza automáticamente con cualquier cambio de ruta.
  // ====================================
  const { title, items: breadcrumbItems } = useBreadcrumb();

  // ====================================
  // HANDLERS
  // ====================================
  const handleNotificationsClick = () => {
    resetUnreadNotifications();
  };

  // ====================================
  // USER MENU ITEMS
  // ====================================
  const userMenuItems = [
    {
      label: 'Mi Perfil',
      icon: 'FaPerson',
      onClick: () => navigate('/settings/userProfile')
    },
    {
      label: 'Configuración',
      icon: 'FaGear',
      onClick: () => navigate('/settings/system')
    },
    {
      label: 'Ayuda & Soporte',
      icon: 'FaCircleInfo',
      onClick: () => navigate('/help')
    }
  ];

  return (
    <HeaderContainer>
      {/* LEFT SECTION — título + migas de pan */}
      <HeaderBreadcrumb
        title={title}
        items={breadcrumbItems}
      />

      {/* RIGHT SECTION */}
      <div className="flex items-center space-x-4">

        {/* SEARCH */}
        <HeaderSearch
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
            onClick={() => { }}
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