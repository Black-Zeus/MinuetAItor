/**
 * routes/modules/auth.routes.jsx
 * Rutas públicas de autenticación — MinuetAItor
 * Base API: /api/v1/auth/{endpoint}
 */

import { lazy } from "react";

const LoginPage          = lazy(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPasswordPage  = lazy(() => import("@/pages/auth/ResetPassword"));

export const authRoutes = [
  {
    path: "/login",
    component: LoginPage, 
    title: "Iniciar Sesión",
    isPublic: true,
  },
  {
    path: "/forgot-password",
    component: ForgotPasswordPage,
    title: "Recuperar Contraseña",
    isPublic: true,
  },
  {
    path: "/reset-password",
    component: ResetPasswordPage,
    title: "Restablecer Contraseña",
    isPublic: true,
  },
];

export default authRoutes;