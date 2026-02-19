/**
 * demo.routes.jsx
 * Rutas del módulo Demo — MinuetAItor
 * isPublic: false → accesibles solo autenticado pero sin restricción de rol
 */
import { lazy } from "react";

const GeneralDemo    = lazy(() => import("@/pages/demo/General"));
const ModalDemo      = lazy(() => import("@/pages/demo/ModalDemo"));
const ForbiddenPage  = lazy(() => import("@/pages/errorPages/ForbiddenPage"));
const NotFoundPage   = lazy(() => import("@/pages/errorPages/NotFoundPage"));
const ServerErrorPage = lazy(() => import("@/pages/errorPages/ServerErrorPage"));

export const demoRoutes = [
  {
    path: "/demo/general",
    component: GeneralDemo,
    title: "Demo General",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/demo/modal",
    component: ModalDemo,
    title: "Demo Modales",
    requiresAuth: true,
    roles: [],
  },
  // Páginas de error accesibles para testing
  {
    path: "/demo/forbidden",
    component: ForbiddenPage,
    title: "Demo - Acceso Denegado",
    requiresAuth: false,
    isPublic: true,
  },
  {
    path: "/demo/not-found",
    component: NotFoundPage,
    title: "Demo - No Encontrado",
    requiresAuth: false,
    isPublic: true,
  },
  {
    path: "/demo/server-error",
    component: ServerErrorPage,
    title: "Demo - Error de Servidor",
    requiresAuth: false,
    isPublic: true,
  },
];

export default demoRoutes;