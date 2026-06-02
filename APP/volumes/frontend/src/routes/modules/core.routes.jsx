/**
 * core.routes.jsx
 * Rutas principales: dashboard y búsqueda global
 */
import { lazy } from "react";
import { Navigate } from "react-router-dom";

const Dashboard    = lazy(() => import("@/pages/dashboard/Dashboard"));
const GlobalSearch = lazy(() => import("@/pages/globalSearch/GlobalSearch"));
const NotificationsInbox = lazy(() => import("@/pages/notifications/NotificationsInbox"));
const HistoryPage = lazy(() => import("@/pages/history/HistoryPage"));

export const coreRoutes = [
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
  {
    path: "/notifications",
    component: NotificationsInbox,
    title: "Notificaciones",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/history",
    component: HistoryPage,
    title: "Historial",
    requiresAuth: true,
    roles: [],
  },
];

export default coreRoutes;
