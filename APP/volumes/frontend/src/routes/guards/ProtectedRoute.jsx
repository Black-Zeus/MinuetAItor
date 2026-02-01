// ProtectedRoute.jsx - Guard para rutas protegidas
// Verifica autenticación y roles antes de permitir acceso

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/authStore"; // Ajusta según tu store
import ForbiddenPage from "@/pages/errorPages/ForbiddenPage";

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const location = useLocation();
  const { isAuthenticated, user, isLoading } = useAuth();

  // Mostrar loading mientras verifica auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Redirigir a login si no está autenticado
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Verificar roles si son requeridos
  if (requiredRoles.length > 0) {
    const userRoles = user?.roles || [];
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!hasRequiredRole) {
      return <ForbiddenPage></ForbiddenPage>;
    }
  }

  return children;
};

export default ProtectedRoute;
