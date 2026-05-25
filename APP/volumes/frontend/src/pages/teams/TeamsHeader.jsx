/**
 * TeamsHeader.jsx
 * Header del módulo de equipo con título y botón de creación.
 * Recibe onCreated y lo propaga hacia NewTeams → TeamsModal.
 */

import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewTeams  from "@/components/ui/button/NewTeams";

const TeamsHeader = ({ onCreated, initialNewUser = null, autoOpenKey = "" }) => {
  return (
    <ModuleHeader
      icon="FaUsers"
      title="Equipo"
      description="Gestión de usuarios y permisos del sistema"
      actions={<NewTeams onCreated={onCreated} initialData={initialNewUser} autoOpenKey={autoOpenKey} />}
    />
  );
};

export default TeamsHeader;
