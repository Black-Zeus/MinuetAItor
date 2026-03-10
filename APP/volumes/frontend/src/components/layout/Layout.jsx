/**
 * Layout.jsx
 * Shell principal de la aplicación autenticada.
 * Monta useMinuteSSE para notificaciones globales de minutas en procesamiento.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar         from './sidebar/Sidebar';
import Header          from './header/Header';
import useAuthStore    from '@store/authStore';
import useSessionStore from '@store/sessionStore';
import { useMinuteSSE } from '@/hooks/useMinuteSSE';

const Layout = ({ children }) => {
  const logout         = useAuthStore((s) => s.logout);
  const getDisplayData = useSessionStore((s) => s.getDisplayData);
  const userDisplay    = getDisplayData();
  const authz          = useSessionStore((s) => s.authz);

  // Notificaciones SSE globales — escucha minutas en procesamiento
  useMinuteSSE();

  const sidebarUser = {
    initials: userDisplay?.initials  || '?',
    name:     userDisplay?.fullName  || userDisplay?.username || 'Usuario',
    role:     userDisplay?.position  || authz?.roles?.[0] || 'Sin rol',
    isAdmin:  authz?.roles?.includes('ADMIN') ?? false,
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar user={sidebarUser} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default Layout;