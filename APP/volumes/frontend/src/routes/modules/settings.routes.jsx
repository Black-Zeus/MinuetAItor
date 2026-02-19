/**
 * settings.routes.jsx
 * Rutas del módulo de configuración y perfil
 */
import { lazy } from "react";

const TagsPage         = lazy(() => import("@/pages/tags/Tags"));
const ProfilesCatalog  = lazy(() => import("@/pages/profiles/ProfilesCatalog"));
const UserProfile      = lazy(() => import("@/pages/userProfile/UserProfile"));
const UnderConstruction = lazy(() =>
  import("@/pages/errorPages/UnderConstructionPage")
);

export const settingsRoutes = [
  {
    path: "/settings/tags",
    component: TagsPage,
    title: "Etiquetas",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/settings/profiles",
    component: ProfilesCatalog,
    title: "Catálogo de Perfiles",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/settings/userProfile",
    component: UserProfile,
    title: "Mi Perfil",
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/settings/system",
    component: UnderConstruction,
    title: "Configuración del Sistema",
    requiresAuth: true,
    roles: ["admin"],
  },
  {
    path: "/help",
    component: UnderConstruction,
    title: "Ayuda",
    requiresAuth: true,
    roles: [],
  },
];

export default settingsRoutes;