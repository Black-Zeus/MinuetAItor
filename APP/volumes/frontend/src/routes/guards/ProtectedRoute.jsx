/**
 * ProtectedRoute.jsx
 * Guard para rutas protegidas.
 * Verifica autenticación y roles antes de permitir acceso.
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuthStore    from "@/store/authStore";
import useSessionStore from "@/store/sessionStore";
import ForbiddenPage   from "@/pages/errorPages/ForbiddenPage";

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const location = useLocation();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const roles           = useSessionStore((s) => s.authz?.roles ?? []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // ── Sin autenticación → login ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // ── Verificar roles (case-insensitive) ────────────────────────────────────
  if (requiredRoles.length > 0) {
    const userRoles     = roles.map((r) => r.toLowerCase());
    const requiredLower = requiredRoles.map((r) => r.toLowerCase());
    const hasRole       = requiredLower.some((r) => userRoles.includes(r));

    if (!hasRole) return <ForbiddenPage />;
  }

  return children;
};

export default ProtectedRoute;