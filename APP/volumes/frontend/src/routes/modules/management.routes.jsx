/**
 * management.routes.jsx
 * Rutas del módulo de gestión: clientes, proyectos, equipos
 */
import { lazy } from "react";

const ClientPage  = lazy(() => import("@/pages/clientes/Client"));
const ProjectPage = lazy(() => import("@/pages/project/Project"));
const TeamsPage   = lazy(() => import("@/pages/teams/Teams"));

export const managementRoutes = [
  {
    path: "/clients",
    component: ClientPage,
    title: "Clientes",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/projects",
    component: ProjectPage,
    title: "Proyectos",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/teams",
    component: TeamsPage,
    title: "Equipos",
    requiresAuth: true,
    roles: [],
  },
];

export default managementRoutes;