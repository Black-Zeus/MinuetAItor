/**
 * core.routes.jsx
 * Rutas principales: dashboard y búsqueda global
 */
import { lazy } from "react";
import { Navigate } from "react-router-dom";

const Dashboard    = lazy(() => import("@/pages/dashboard/Dashboard"));
const GlobalSearch = lazy(() => import("@/pages/globalSearch/GlobalSearch"));

export const coreRoutes = [
  {
    path: "/",
    // Redirige a /dashboard sin necesitar un componente completo
    component: () => <Navigate to="/dashboard" replace />,
    title: "Inicio",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/dashboard",
    component: Dashboard,
    title: "Dashboard",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/globalSearch",
    component: GlobalSearch,
    title: "Búsqueda Global",
    requiresAuth: true,
    roles: [],
  },
];

export default coreRoutes;