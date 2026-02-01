// auth.routes.jsx - Módulo de rutas de autenticación
// Rutas públicas: login, forgot, reset

import { lazy } from 'react';

// Componentes lazy
const LoginPage = lazy(() => import('@/pages/auth/Login'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/Forgot/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/Reset/ResetPassword'));

export const authRoutes = [
    {
        path: '/login',
        component: LoginPage,
        title: 'Iniciar Sesión',
        isPublic: true
    },
    {
        path: '/forgot-password',
        component: ForgotPasswordPage,
        title: 'Recuperar Contraseña',
        isPublic: true
    },
    {
        path: '/reset-password',
        component: ResetPasswordPage,
        title: 'Restablecer Contraseña',
        isPublic: true
    }
];

export default authRoutes;