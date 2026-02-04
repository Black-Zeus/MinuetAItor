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
    console.log('Searching:', query);
  };

  const handleNotificationsClick = () => {
    console.log('Notifications clicked');
    resetUnreadNotifications(); // Resetear contador al abrir notificaciones
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
        console.log('Inicio clicked'); 
      }
    },
    {
      label: currentSection.name // Título dinámico desde store
    }
  ];

  // ====================================
  // USER MENU
  // ====================================
  const userMenuItems = [
    {
      label: 'Mi Perfil',
      icon: 'FaPerson',
      onClick: () => console.log('Mi Perfil clicked')
    },
    {
      label: 'Configuración',
      icon: 'FaFilter',
      onClick: () => console.log('Configuración clicked')
    },
    {
      label: 'Ayuda & Soporte',
      icon: 'FaCircleInfo',
      onClick: () => console.log('Ayuda clicked')
    }
  ];

  return (
    <HeaderContainer>
      {/* LEFT SECTION */}
      <HeaderBreadcrumb
        title={currentSection.name} // Título dinámico
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
            showBadge={unreadNotificationsCount > 0} // Badge dinámico
            badgeCount={unreadNotificationsCount} // Opcional: pasar el contador
          />
          
          <HeaderActionButton
            iconName="FaEnvelope"
            onClick={() => console.log('Messages clicked')}
            ariaLabel="Mensajes"
          />
          
          <HeaderThemeToggle
            onClick={toggleTheme} // ✅ Conectado al store
            currentTheme={theme} // ✅ Pasar theme actual
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
            console.log('Cerrar Sesión');
            window.location.href = './login.html';
          }}
        />
      </div>
    </HeaderContainer>
  );
};

export default Header;