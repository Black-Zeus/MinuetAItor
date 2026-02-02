/**
 * Header.jsx
 * Componente principal del header - Va en src/components/layout/Header.jsx
 * Importa desde la carpeta 
 */

import React, { useState } from 'react';
import HeaderContainer from './HeaderContainer';
import HeaderBreadcrumb from './HeaderBreadcrumb';
import HeaderSearch from './HeaderSearch';
import HeaderActionButton from './HeaderActionButton';
import HeaderThemeToggle from './HeaderThemeToggle';
import HeaderDivider from './HeaderDivider';
import HeaderUserMenu from './HeaderUserMenu';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query) => {
    console.log('Searching:', query);
  };

  const breadcrumbItems = [
    {
      label: 'Inicio',
      href: '#',
      onClick: (e) => { e.preventDefault(); console.log('Inicio clicked'); }
    },
    {
      label: 'Dashboard'
    }
  ];

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
        title="Dashboard"
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
            onClick={() => console.log('Notifications clicked')}
            ariaLabel="Notificaciones"
            showBadge={true}
          />
          
          <HeaderActionButton
            iconName="FaEnvelope"
            onClick={() => console.log('Messages clicked')}
            ariaLabel="Mensajes"
          />
          
          <HeaderThemeToggle
            onClick={() => console.log('Theme toggled')}
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