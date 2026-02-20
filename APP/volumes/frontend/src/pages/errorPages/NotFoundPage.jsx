// pages/errorPages/NotFoundPage.jsx - Página 404 atractiva
// Recurso no encontrado con estilo moderno homologado

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

import logger from '@/utils/logger';
const erNotFoundLog = logger.scope("error-page");

const NotFoundPage = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [searchAttempts, setSearchAttempts] = useState(0);

  useDocumentTitle("Recurso No Encontrado");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGoHome = () => {
    navigate("/", { replace: true });
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const handleSearchAgain = () => {
    setSearchAttempts((prev) => prev + 1);
    // Simular búsqueda
    setTimeout(() => {
      // Aquí podrías implementar una búsqueda real o sugerencias
      erNotFoundLog.info("Búsqueda realizada");
    }, 500);
  };

  const handleReportBrokenLink = () => {
    // Abrir modal de reporte o email
    const subject = encodeURIComponent("Enlace roto - Error 404");
    const body = encodeURIComponent(`
Enlace roto encontrado: ${window.location.href}
Referencia desde: ${document.referrer || "Directo"}
Fecha: ${new Date().toLocaleString()}
Navegador: ${navigator.userAgent}
Descripción del problema: [Escriba aquí cómo llegó a este enlace]
    `);
    window.open(`mailto:soporte@tudominio.com?subject=${subject}&body=${body}`);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 p-4 min-h-screen flex items-center justify-center">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-purple-400/10 dark:bg-purple-600/10 rounded-full blur-2xl animate-pulse delay-500" />
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
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700 rounded-lg shadow-2xl shadow-blue-500/10 dark:shadow-blue-500/20 p-8">
          {/* Main error section */}
          <div className="text-center mb-2">
            {/* 404 Number with glow effect */}
            <div className="relative">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse">
                404
              </div>
              <div className="absolute inset-0 text-5xl font-black text-blue-500/20 dark:text-blue-400/20 blur-sm">
                404
              </div>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Recurso No Encontrado
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-2">
              El recurso solicitado no existe en el sistema. Verifique la URL
              ingresada o utilice la navegación del sistema para acceder a los
              módulos disponibles.
            </p>

            {/* Decorative illustration */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full">
              <div className="text-3xl animate-bounce">🔍</div>
            </div>
          </div>

          {/* Current location info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-md p-2 mb-2 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  URL solicitada:
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-mono break-all bg-white dark:bg-gray-800 px-3 py-2 rounded border">
                  {window.location.pathname}
                </p>
                {document.referrer && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                    Referencia desde: {document.referrer}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-4 mb-2">
            <button
              onClick={handleSearchAgain}
              className=" invisible  relative flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium rounded-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 overflow-hidden group"
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="relative z-10">
                Buscar Recurso {searchAttempts > 0 && `(${searchAttempts})`}
              </span>
            </button>

            <button
              onClick={handleGoHome}
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Panel Principal
            </button>
          </div>

          {/* Quick navigation - adapted for 404 */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Accesos Rápidos
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-2">
              <a
                href="/dashboard"
                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200 group"
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-center">
                  Dashboard
                </span>
              </a>

              <a
                href="/inventory"
                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200 group"
              >
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-center">
                  Inventario
                </span>
              </a>

              <a
                href="/reports"
                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200 group"
              >
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                  <svg
                    className="w-5 h-5 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-center">
                  Reportes
                </span>
              </a>
            </div>
          </div>

          {/* Footer info */}
          <div className="border-t border-gray-200 dark:border-gray-600 mt-4 pt-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Si el problema persiste, contacte al administrador del sistema
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
