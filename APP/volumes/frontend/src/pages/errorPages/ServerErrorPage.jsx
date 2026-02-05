// pages/errorPages/ServerErrorPage.jsx - Página 500 atractiva
// Error interno del servidor con estilo moderno homologado

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const ServerErrorPage = () => {
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    useDocumentTitle("Error Interno del Servidor");
    useEffect(() => {
        setMounted(true);
    }, []);

    const handleGoHome = () => {
        navigate('/', { replace: true });
    };

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        // Simular reintento
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleReportIssue = () => {
        // Abrir modal de reporte o email
        const subject = encodeURIComponent('Error 500 - Reporte de problema');
        const body = encodeURIComponent(`
Error detectado en: ${window.location.href}
Fecha: ${new Date().toLocaleString()}
Navegador: ${navigator.userAgent}
Intentos de reintento: ${retryCount}
    `);
        window.open(`mailto:soporte@tudominio.com?subject=${subject}&body=${body}`);
    };

    return (
        <div className="bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-red-900 p-4 min-h-screen flex items-center justify-center">

            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-400/10 dark:bg-red-600/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-400/10 dark:bg-orange-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-yellow-400/10 dark:bg-yellow-600/10 rounded-full blur-2xl animate-pulse delay-500" />
            </div>

            {/* Main container - 70% width with max height */}
            <div className={`
        relative z-10 w-full max-w-[70%] max-h-[85vh] overflow-auto
        transition-all duration-1000 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}>

                {/* Main content card with border */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700 rounded-lg shadow-2xl shadow-red-500/10 dark:shadow-red-500/20 p-8">

                    {/* Main error section */}
                    <div className="text-center mb-2">
                        {/* 500 Number with glow effect */}
                        <div className="relative">
                            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 animate-pulse">
                                500
                            </div>
                            <div className="absolute inset-0 text-5xl font-black text-red-500/20 dark:text-red-400/20 blur-sm">
                                500
                            </div>
                        </div>

                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            Error Interno del Servidor
                        </h1>
                        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-2">
                            Algo salió mal en nuestros servidores. Nuestro equipo técnico ha sido notificado
                            y está trabajando para solucionar el problema.
                        </p>

                        {/* Decorative illustration */}
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-full">
                            <div className="text-3xl animate-bounce">⚡</div>
                        </div>
                    </div>

                    {/* Error details section */}
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md p-2 mb-3 max-w-2xl mx-auto">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 14c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Información técnica:</p>
                                <p className="text-sm text-red-600 dark:text-red-400 break-all">
                                    ID del error: ERR-{Date.now().toString(36).toUpperCase()}
                                </p>
                                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                                    Timestamp: {new Date().toISOString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-center gap-4 mb-3">
                        <button
                            onClick={handleRetry}
                            className="relative flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/30 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 overflow-hidden group"
                        >
                            {/* Button shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-600" />

                            <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="relative z-10">
                                Reintentar {retryCount > 0 && `(${retryCount})`}
                            </span>
                        </button>

                        <button
                            onClick={handleGoHome}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Panel Principal
                        </button>
                    </div>

                    {/* Quick navigation - adapted for server errors */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-5">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 text-center mb-4">
                            Opciones de Ayuda
                        </h3>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <button
                                onClick={handleReportIssue}
                                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 group"
                            >
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 14c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <span className="text-xs font-medium text-center">Reportar Error</span>
                            </button>

                            <a
                                href="/status"
                                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors duration-200 group"
                            >
                                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <span className="text-xs font-medium text-center">Estado del Sistema</span>
                            </a>

                            <a
                                href="/help"
                                className="flex flex-col items-center gap-2 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200 group"
                            >
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="text-xs font-medium text-center">Centro de Ayuda</span>
                            </a>
                        </div>
                    </div>

                    {/* Footer info */}
                    <div className="border-t border-gray-200 dark:border-gray-600 mt-4 pt-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Si el problema persiste, contacta al administrador del sistema
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ServerErrorPage;