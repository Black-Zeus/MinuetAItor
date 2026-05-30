/**
 * SidebarFooter.jsx
 * Footer del sidebar con menu compacto de cuenta.
 */

import React, { useEffect, useRef, useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import useBaseSiteStore from '@store/baseSiteStore';
import { BROWSER_TIMEZONE, resolveTimeZone } from '@/utils/timeZone';

const SidebarFooter = ({ 
  isCollapsed = false,
  isOperationLocked = false,
  user = {
    initials: 'JD',
    name: 'John Doe',
    role: 'Administrador',
    email: ''
  },
  onOpenProfile = () => {},
  onOpenPreferences = () => {},
  onLogout = () => {}
}) => {
  const containerRef = useRef(null);
  const configuredTimeZone = useBaseSiteStore((s) => s.ui?.timeZone ?? BROWSER_TIMEZONE);
  const effectiveTimeZone = resolveTimeZone(configuredTimeZone);
  const timeZoneLabel = configuredTimeZone === BROWSER_TIMEZONE
    ? `${effectiveTimeZone} (navegador)`
    : effectiveTimeZone;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user.avatar]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (callback) => {
    setIsOpen(false);
    callback?.();
  };

  return (
    <div ref={containerRef} className="relative border-t border-white/10 p-4">
      <button
        type="button"
        className={`
          flex w-full items-center p-3 rounded-lg text-left
          hover:bg-white/10 transition-colors
          ${isCollapsed ? 'justify-center' : ''}
        `}
        onClick={() => setIsOpen((current) => !current)}
        title={`${user.name} - ${user.role}`}
        aria-label="Menu de cuenta"
        aria-expanded={isOpen}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-semibold text-sm flex-shrink-0 overflow-hidden">
          {user.avatar && !avatarFailed ? (
            <img
              src={user.avatar}
              alt={user.name || 'Usuario'}
              className="w-full h-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            user.initials || 'U'
          )}
        </div>

        {/* Información de usuario - solo visible si no está colapsado */}
        {!isCollapsed && (
          <div className="ml-3 min-w-0">
            <p className="truncate text-sm font-semibold">{user.name || 'Usuario'}</p>
            <p className="text-xs text-white/70">{user.role || 'Rol'}</p>
          </div>
        )}

        {!isCollapsed && (
          <Icon
            name="FaChevronUp"
            className={`ml-auto h-3.5 w-3.5 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {isOpen && (
        <div
          className={`
            absolute z-50 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-800 shadow-2xl
            dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100
            ${isCollapsed ? 'bottom-4 left-full ml-2 w-64' : 'bottom-full left-4 right-4 mb-2'}
          `}
        >
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/80">
            <p className="truncate text-sm font-semibold">{user.name || 'Usuario'}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{user.email || user.role || 'Cuenta activa'}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Icon name="FaClock" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{timeZoneLabel}</span>
            </div>
          </div>

          <div className="py-1">
            {!isOperationLocked && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction(onOpenProfile)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Icon name="FaPerson" className="h-4 w-4 text-gray-400" />
                  <span>Mi perfil</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(onOpenPreferences)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Icon name="FaSliders" className="h-4 w-4 text-gray-400" />
                  <span>Preferencias</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handleAction(onLogout)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Icon name="FaDoorOpen" className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarFooter;
