// pages/errorPages/ForbiddenPage.jsx - Página 403 atractiva
// Acceso denegado/sin permisos con estilo moderno homologado

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/authStore"; // Ajusta según tu store
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const ForbiddenPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useDocumentTitle("Acceso Denegado");
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGoHome = () => {
    navigate("/", { replace: true });
  };

  const handleSwitchAccount = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleRequestAccess = () => {
    // Abrir modal de solicitud o email
    const subject = encodeURIComponent("Solicitud de acceso - Error 403");
    const body = encodeURIComponent(`
Solicito acceso a: ${window.location.href}
Usuario actual: ${user?.email || user?.username || "Desconocido"}
Rol actual: ${user?.roles?.join(", ") || "Sin roles"}
Fecha: ${new Date().toLocaleString()}
Justificación: [Escriba aquí por qué necesita acceso]
    `);
    window.open(`mailto:admin@tudominio.com?subject=${subject}&body=${body}`);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-amber-900 p-8 min-h-screen flex items-center justify-center">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-400/10 dark:bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-400/10 dark:bg-red-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-orange-400/10 dark:bg-orange-600/10 rounded-full blur-2xl animate-pulse delay-500" />
      </div>

      {/* Main container - 70% width with max height */}
      <div
        className={`
        relative z-10 w-full max-w-[70%] max-h-[85vh] overflow-auto
        transition-all duration-1000 ease-out
        ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
      `}
      >
        {/* Main content card with border */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700 rounded-lg shadow-2xl shadow-amber-500/10 dark:shadow-amber-500/20 p-4">
          {/* Main error section */}
          <div className="text-center mb-6">
            {/* 403 Number with glow effect */}
            <div className="relative mb-4">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-red-500 to-orange-500 animate-pulse">
                403
              </div>
              <div className="absolute inset-0 text-5xl font-black text-amber-500/20 dark:text-amber-400/20 blur-sm">
                403
              </div>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Acceso Denegado
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-6">
              No tienes los permisos necesarios para acceder a esta página.
              Contacta al administrador si crees que esto es un error.
            </p>

            {/* Decorative illustration */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-red-100 dark:from-amber-900/30 dark:to-red-900/30 rounded-full mb-4">
              <div className="text-3xl animate-pulse">🔒</div>
            </div>
          </div>

          {/* User info section */}
          {user && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md p-4 mb-6 max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                    Usuario actual:&nbsp;&nbsp;
                    <span className="text-sm text-amber-600 dark:text-amber-400 break-all">
                      {user.email || user.username || "Usuario desconocido"}
                      {user.roles && user.roles.length > 0 && (
                        <span className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                          &nbsp;&nbsp;|&nbsp;&nbsp;Roles:{" "}
                          {user.roles.join(", ")}
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={handleGoHome}
              className="relative flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 overflow-hidden group"
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-600" />

              <svg
                className="w-4 h-4 relative z-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="relative z-10">Panel Principal</span>
            </button>

            <button
              onClick={handleSwitchAccount}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Cambiar Usuario
            </button>
          </div>

          {/* Quick navigation - adapted for 403 */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 text-center mb-4">
              Páginas Disponibles
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <a
                href="/dashboard"
                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors duration-200 group"
              >
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                  <svg
                    className="w-5 h-5 text-amber-600 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-center">
                  Dashboard
                </span>
              </a>

              <a
                href="/profile"
                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors duration-200 group"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-center">
                  Mi Perfil
                </span>
              </a>

              <button
                onClick={handleRequestAccess}
                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors duration-200 group"
              >
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                  <svg
                    className="w-5 h-5 text-orange-600 dark:text-orange-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-center">
                  Solicitar Acceso
                </span>
              </button>
            </div>
          </div>

          {/* Footer info */}
          <div className="border-t border-gray-200 dark:border-gray-600 mt-4 pt-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Si crees que deberías tener acceso a esta página, contacta al
              administrador del sistema
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
