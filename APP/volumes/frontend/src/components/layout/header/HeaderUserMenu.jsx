/**
 * HeaderUserMenu.jsx
 * Menú desplegable de usuario con avatar y opciones - 100% Tailwind
 *
 * Fix: backdrop en z-30, dropdown en z-40 — pero el backdrop estaba
 * capturando clicks antes que los items. Solución: backdrop con
 * pointer-events solo en el área exterior via onMouseDown + stopPropagation
 * en el dropdown, o simplemente subir el dropdown a z-50.
 */

import React, { useState, useRef, useEffect } from 'react';
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
  const containerRef = useRef(null);

  // Cierra al hacer click fuera del componente completo
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleItemClick = (item) => {
    setIsOpen(false);
    item.onClick?.();
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout?.();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>

      {/* ── TRIGGER BUTTON ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Menú de usuario"
        aria-expanded={isOpen}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-semibold text-sm text-primary-600 dark:text-primary-400 overflow-hidden">
          {avatar
            ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
            : <span>{initials}</span>
          }
        </div>

        {/* User info */}
        <div className="hidden lg:block text-left">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
            {name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
            {role}
          </p>
        </div>

        {/* Chevron */}
        <Icon
          name="FaChevronDown"
          className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── DROPDOWN ── */}
      {isOpen && (
        <div className="
          absolute right-0 top-full mt-2 w-64
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-xl shadow-xl
          z-50
          overflow-hidden
        ">
          {/* User header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {email}
            </p>
          </div>

          {/* Menu items */}
          {menuItems.length > 0 && (
            <div className="py-1">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleItemClick(item)}
                  className="
                    w-full flex items-center gap-3 px-4 py-2.5
                    text-sm text-gray-700 dark:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors text-left
                  "
                >
                  <Icon name={item.icon} className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-gray-700" />

          {/* Logout */}
          <div className="p-2">
            <button
              onClick={handleLogout}
              className="
                w-full flex items-center justify-center gap-2
                px-4 py-2 rounded-lg
                bg-red-500 hover:bg-red-600 active:bg-red-700
                text-white text-sm font-medium
                transition-colors
              "
            >
              <Icon name="FaDoorOpen" className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderUserMenu;