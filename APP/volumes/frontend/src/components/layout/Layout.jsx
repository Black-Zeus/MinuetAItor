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
import { SYSTEM_MAINTENANCE_SSE_STATE_EVENT } from '@/hooks/useSystemMaintenanceSSE';
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
  const [maintenanceSseConnected, setMaintenanceSseConnected] = useState(false);

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
  }, [refreshOperationState]);

  useEffect(() => {
    if (maintenanceSseConnected) return undefined;
    const interval = window.setInterval(refreshOperationState, 120000);
    return () => window.clearInterval(interval);
  }, [maintenanceSseConnected, refreshOperationState]);

  useEffect(() => {
    const handleRuntimeUpdate = (event) => {
      const nextState = event?.detail?.metadata?.operationState;
      if (nextState) {
        setOperationState(nextState);
        return;
      }
      refreshOperationState();
    };
    const handleSseState = (event) => {
      setMaintenanceSseConnected(Boolean(event?.detail?.connected));
    };
    window.addEventListener(MAINTENANCE_RUNTIME_EVENT, handleRuntimeUpdate);
    window.addEventListener(SYSTEM_MAINTENANCE_SSE_STATE_EVENT, handleSseState);
    return () => {
      window.removeEventListener(MAINTENANCE_RUNTIME_EVENT, handleRuntimeUpdate);
      window.removeEventListener(SYSTEM_MAINTENANCE_SSE_STATE_EVENT, handleSseState);
    };
  }, [refreshOperationState]);

  const isOperationChecking = operationState === null;
  const operationMode = operationState?.mode || "normal";
  const isOperationLocked = operationMode !== "normal";
  const isMaintenanceMode = operationMode === "maintenance";
  const shouldRestrictShell = isMaintenanceMode;
  const isSystemSettingsRoute = location.pathname.startsWith(SYSTEM_SETTINGS_PATH);

  useMinuteSSE(!isMaintenanceMode);

  useEffect(() => {
    if (isMaintenanceMode && !isSystemSettingsRoute) {
      navigate(`${SYSTEM_SETTINGS_PATH}?tab=maintenance`, { replace: true });
    }
  }, [isMaintenanceMode, isSystemSettingsRoute, navigate]);

  const operationLabel = isOperationChecking
    ? "verificación"
    : operationMode === "read_only"
      ? "solo lectura"
      : operationMode === "commissioning"
        ? "puesta en marcha"
        : "mantenimiento";
  const operationMessage = useMemo(() => {
    if (!isOperationLocked) return "";
    if (operationMode === "read_only") {
      return "El sistema se encuentra habilitado solo para consulta. Durante este estado, los usuarios pueden revisar información y reportes, pero las acciones que modifiquen datos permanecen bloqueadas.";
    }
    if (operationMode === "commissioning") {
      return "El sistema aún no se encuentra habilitado para operación productiva. Durante este estado, solo los administradores pueden iniciar sesión, realizar configuraciones y ejecutar transacciones de validación.";
    }
    return "El sistema se encuentra temporalmente fuera de operación general. Durante este estado, solo administradores pueden acceder a las herramientas necesarias para administrar o recuperar el servicio.";
  }, [isOperationLocked, operationMode]);
  const operationReason = String(operationState?.reason || "").trim();

  const sidebarUser = {
    initials: userDisplay?.initials  || '?',
    avatar:   userDisplay?.avatarUrl || null,
    name:     userDisplay?.fullName  || userDisplay?.username || 'Usuario',
    email:    userDisplay?.email     || '',
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
          {isOperationLocked && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-100">
              <FaTriangleExclamation className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-300" />
              <div>
                <p className="text-sm font-semibold">
                  {operationMode === "commissioning" ? "Sistema en puesta en marcha" : `Sistema en modo ${operationLabel}`}
                </p>
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
        </main>
      </div>
    </div>
  );
};

export default Layout;
