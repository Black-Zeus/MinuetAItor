/**
 * UserProfileTabNav.jsx
 * Navegación por tabs del perfil de usuario.
 * Tabs: Perfil | Seguridad | Sesiones | Notificaciones | Personalización
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";

export const PROFILE_TABS = [
  {
    id: "profile",
    label: "Perfil",
    icon: "FaUser",
    description: "Datos personales y cuenta",
  },
  {
    id: "security",
    label: "Seguridad",
    icon: "FaLock",
    description: "Contraseña y acceso",
  },
  {
    id: "sessions",
    label: "Sesiones",
    icon: "FaDesktop",
    description: "Actividad y dispositivos",
  },
  {
    id: "notifications",
    label: "Notificaciones",
    icon: "FaBell",
    description: "Preferencias de alertas",
  },
  {
    id: "customization",
    label: "Personalización",
    icon: "FaGear",
    description: "Widgets del dashboard",
  },
];

const UserProfileTabNav = ({ activeTab, onTabChange }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-theme overflow-hidden">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-px bg-gray-200 dark:bg-gray-700">
      {PROFILE_TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={[
              "min-w-0 flex items-center gap-2.5 px-4 py-4 transition-all text-left bg-white dark:bg-gray-800",
              isActive
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200",
            ].join(" ")}
          >
            {/* Indicador activo — línea izquierda */}
            <span
              className={[
                "w-0.5 h-7 rounded-full shrink-0 transition-all",
                isActive ? "bg-primary-500 dark:bg-primary-400" : "bg-transparent",
              ].join(" ")}
            />

            <Icon
              name={tab.icon}
              className={[
                "w-4 h-4 shrink-0",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-400 dark:text-gray-500",
              ].join(" ")}
            />

            <div className="text-left min-w-0">
              <p className={`text-sm font-semibold leading-tight ${isActive ? "text-primary-700 dark:text-primary-300" : ""}`}>
                {tab.label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                {tab.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

export default UserProfileTabNav;
