// ====================================
// volumes/frontend/src/routes/modules/profile.js
// Módulo de rutas para el perfil de usuario
// ====================================

import { lazy } from "react";

// Lazy loading del componente Profile
const Profile = lazy(() => import("@/pages/profile"));

// Definición de rutas del módulo profile
export const profileRoutes = [
    {
        path: "/profile",
        component: Profile,
        isPublic: false,
        requiresAuth: true,
        roles: [], // Accesible para todos los usuarios autenticados
        meta: {
            title: "Mi Perfil",
            description: "Gestión de información personal y configuración de cuenta",
            keywords: ["perfil", "usuario", "configuración", "contraseña"],
            breadcrumb: [
                { text: "Inicio", path: "/" },
                { text: "Mi Perfil", path: "/profile" }
            ]
        }
    }
];

export default profileRoutes;