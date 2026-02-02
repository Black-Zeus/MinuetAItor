/**
 * HeaderUserMenu.jsx
 * Menú desplegable de usuario con avatar y opciones - 100% Tailwind
 */

import React, { useState } from 'react';
import Icon from '@components/ui/icon/iconManager';

const HeaderUserMenu = ({ 
  avatar,
  initials = 'JD',
  name = 'Usuario',
  role = 'Rol',
  email = 'usuario@example.com',
  menuItems = [],
  onLogout,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const defaultMenuItems = [
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

  const items = menuItems.length > 0 ? menuItems : defaultMenuItems;

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      console.log('Cerrar Sesión clicked');
      window.location.href = './login.html';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* User Button */}
      <button
        className="
          flex items-center space-x-3 p-2 rounded-lg
          hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors
        "
        onClick={toggleMenu}
        aria-label="Menú de usuario"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-semibold text-sm text-primary-600 dark:text-primary-400">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full rounded-lg object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* User Info (hidden on mobile) */}
        <div className="hidden lg:block text-left">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {role}
          </p>
        </div>

        {/* Chevron */}
        <Icon 
          name="FaChevronDown" 
          className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30"
            onClick={toggleMenu}
          ></div>

          {/* Dropdown Content */}
          <div className="
            absolute right-0 mt-2 w-64 z-40
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            py-2
          ">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {email}
              </p>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {items.map((item, index) => (
                <a
                  key={index}
                  href={item.href || '#'}
                  className="
                    flex items-center px-4 py-2
                    text-sm text-gray-700 dark:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors
                  "
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (item.onClick) {
                      item.onClick();
                    }
                  }}
                >
                  <Icon name={item.icon} className="w-4 h-4 mr-3" />
                  {item.label}
                </a>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-2"></div>

            {/* Logout */}
            <div className="px-2 py-2">
              <button
                onClick={handleLogout}
                className="
                  flex items-center justify-center w-full px-4 py-2
                  bg-red-500 hover:bg-red-600
                  text-white text-sm font-medium
                  rounded-lg transition-colors
                "
              >
                <Icon name="FaDoorOpen" className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeaderUserMenu;
