/**
 * Layout.jsx
 * Shell principal de la aplicación autenticada.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FaTriangleExclamation } from 'react-icons/fa6';
import Sidebar         from './sidebar/Sidebar';
import Header          from './header/Header';
import { useMinuteSSE } from '@/hooks/useMinuteSSE';
import useSessionStore from '@store/sessionStore';
import systemMaintenanceService from '@/services/systemMaintenanceService';

const MAINTENANCE_RUNTIME_EVENT = "system-maintenance-runtime-update";
const SYSTEM_SETTINGS_PATH = "/settings/system";

const Layout = ({ children }) => {
  const location       = useLocation();
  const navigate       = useNavigate();
  const getDisplayData = useSessionStore((s) => s.getDisplayData);
  const userDisplay    = getDisplayData();
  const authz          = useSessionStore((s) => s.authz);
  const [operationState, setOperationState] = useState(null);

  const refreshOperationState = useCallback(async () => {
    try {
      const state = await systemMaintenanceService.getPublicOperationState();
      setOperationState(state || { mode: "normal" });
    } catch {
      setOperationState((current) => current || { mode: "normal" });
    }
  }, []);

  useEffect(() => {
    refreshOperationState();
    const interval = window.setInterval(refreshOperationState, 30000);
    const handleRuntimeUpdate = () => refreshOperationState();
    window.addEventListener(MAINTENANCE_RUNTIME_EVENT, handleRuntimeUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(MAINTENANCE_RUNTIME_EVENT, handleRuntimeUpdate);
    };
  }, [refreshOperationState]);

  const isOperationChecking = operationState === null;
  const operationMode = operationState?.mode || "normal";
  const isOperationLocked = operationMode !== "normal";
  const isMaintenanceMode = operationMode === "maintenance";
  const shouldRestrictShell = isOperationChecking || isMaintenanceMode;
  const isSystemSettingsRoute = location.pathname.startsWith(SYSTEM_SETTINGS_PATH);

  useMinuteSSE(!isOperationChecking && !isMaintenanceMode);

  useEffect(() => {
    if (isMaintenanceMode && !isSystemSettingsRoute) {
      navigate(`${SYSTEM_SETTINGS_PATH}?tab=maintenance`, { replace: true });
    }
  }, [isMaintenanceMode, isSystemSettingsRoute, navigate]);

  const operationLabel = isOperationChecking
    ? "verificación"
    : operationMode === "read_only"
      ? "solo lectura"
      : "mantenimiento";
  const operationMessage = useMemo(() => {
    if (!isOperationLocked) return "";
    return operationMode === "read_only"
      ? "Sistema en modo solo lectura. Puedes consultar datos y reportes, pero las escrituras están bloqueadas."
      : "Sistema en modo mantenimiento. Solo está disponible Configuración > Sistema para administrar el modo operativo.";
  }, [isOperationLocked, operationMode]);
  const operationReason = String(operationState?.reason || "").trim();

  const sidebarUser = {
    initials: userDisplay?.initials  || '?',
    avatar:   userDisplay?.avatarUrl || null,
    name:     userDisplay?.fullName  || userDisplay?.username || 'Usuario',
    role:     userDisplay?.position  || authz?.roles?.[0] || 'Sin rol',
    isAdmin:  authz?.roles?.includes('ADMIN') ?? false,
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar user={sidebarUser} isOperationLocked={shouldRestrictShell} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          isOperationLocked={shouldRestrictShell}
          operationLabel={operationLabel}
        />

        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-6">
          {isOperationChecking ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <p className="text-sm text-gray-600 dark:text-gray-300">Verificando modo operativo...</p>
              </div>
            </div>
          ) : (
            <>
              {isOperationLocked && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-100">
                  <FaTriangleExclamation className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold">Sistema en modo {operationLabel}</p>
                    <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-100/80">{operationMessage}</p>
                    {operationReason ? (
                      <p className="mt-1 text-sm text-amber-900 dark:text-amber-50">
                        <span className="font-semibold">Motivo:</span> {operationReason}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              {isMaintenanceMode && !isSystemSettingsRoute ? (
                <section className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  <h1 className="text-lg font-semibold">Acceso temporalmente restringido</h1>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    El sistema está en modo {operationLabel}. Serás redirigido al módulo Sistema para administrar el estado operativo.
                  </p>
                </section>
              ) : (
                children ?? <Outlet />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;
