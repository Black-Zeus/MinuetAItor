// PublicRoute.jsx - Guard para rutas públicas
// Redirige a dashboard si ya está autenticado

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

const PublicRoute = ({ children, redirectTo = '/' }) => {
    const location        = useLocation();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading       = useAuthStore((s) => s.isLoading);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Verificando estado...</p>
                </div>
            </div>
        );
    }

    if (isAuthenticated) {
        const from = location.state?.from || redirectTo;
        return <Navigate to={from} replace />;
    }

    return children;
};

export default PublicRoute;