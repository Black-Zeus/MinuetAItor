/**
 * settings.routes.jsx
 * Rutas del módulo de configuración y perfil
 */
import { lazy } from "react";

const TagsPage         = lazy(() => import("@/pages/tags/Tags"));
const ProfilesCatalog  = lazy(() => import("@/pages/profiles/ProfilesCatalog"));
const OrganizationSettings = lazy(() => import("@/pages/system/OrganizationSettings"));
const UserProfile      = lazy(() => import("@/pages/userProfile/UserProfile"));
const SystemSettings   = lazy(() => import("@/pages/system/SystemSettings"));
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
    permissions: [],
  },
  {
    path: "/settings/profiles",
    component: ProfilesCatalog,
    title: "Catálogo de Perfiles",
    requiresAuth: true,
    roles: [],
    permissions: [],
  },
  {
    path: "/settings/organization",
    component: OrganizationSettings,
    title: "Organización",
    requiresAuth: true,
    roles: ["admin"],
    permissions: [],
  },
  {
    path: "/settings/userProfile",
    component: UserProfile,
    title: "Mi Perfil",
    requiresAuth: true,
    roles: [],
    permissions: [],
  },
  {
    path: "/settings/system",
    component: SystemSettings,
    title: "Configuración del Sistema",
    requiresAuth: true,
    roles: ["admin"],
    permissions: [],
  },
  {
    path: "/help",
    component: UnderConstruction,
    title: "Ayuda",
    requiresAuth: true,
    roles: [],
    permissions: [],
  },
];

export default settingsRoutes;
