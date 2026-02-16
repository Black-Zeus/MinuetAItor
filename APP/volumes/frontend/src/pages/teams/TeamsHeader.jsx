/**
 * TeamsHeader.jsx
 * Header del módulo de equipo con título y botón de creación
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import NewTeams from "@/components/ui/button/NewTeams";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-600 dark:text-gray-300";

const TeamsHeader = () => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaUsers" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Equipo
        </h1>

        <p className={`${TXT_META} mt-2 transition-theme`}>
          Gestión de usuarios y permisos del sistema
        </p>
      </div>

      <NewTeams />
    </div>
  );
};

export default TeamsHeader;