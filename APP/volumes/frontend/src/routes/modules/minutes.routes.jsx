/**
 * minutes.routes.jsx
 * Rutas del módulo core de actas de reunión
 */
import { lazy } from "react";

const MinutePage    = lazy(() => import("@/pages/minutes/Minute"));
const MinuteEditor  = lazy(() => import("@/pages/minuteEditor/MinuteEditor"));
const MinuteViewPage = lazy(() => import("@/pages/minuteView/MinuteViewPage"));

export const minutesRoutes = [
  {
    path: "/minutes",
    component: MinutePage,
    title: "Actas de Reunión",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/minutes/process/:id",
    component: MinuteEditor,
    title: "Editor de Acta",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/minutes/view/:id",
    component: MinuteViewPage,
    title: "Visualizacion de Acta",
    guard: "none",
    layout: "none",
  },
];

export default minutesRoutes;
