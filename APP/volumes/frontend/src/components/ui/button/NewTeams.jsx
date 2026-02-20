/**
 * NewTeams.jsx
 * Botón que abre el modal para crear usuario (team member) usando TeamsModal (modo createNewTeam)
 */

import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import { FaPlus } from "react-icons/fa";
import ModalManager from "@/components/ui/modal";

// Import del componente modal (wizard)
import TeamsModal, { TEAMS_MODAL_MODES } from "@/pages/teams/TeamsModal"; // <-- ajusta ruta si corresponde

import logger from '@/utils/logger';
const teamsLog = logger.scope("teams");

// Botón que abre el modal
const showTeamsWizard = () => {
  ModalManager.show({
    type: "custom",
    title: "Crear Nuevo Usuario",
    size: "large",
    showFooter: false,
    content: (
      <TeamsModal
        mode={TEAMS_MODAL_MODES.CREATE}
        // (opcional) si tu TeamsModal requiere catálogos/lookup, puedes pasar data auxiliar:
        // catalog={teamsData?.teams || []}
        onSubmit={(data) => {
          // data normalizado desde TeamsModal (según tu estructura de "equipo" = usuario):
          // {
          //   id,
          //   name,
          //   email,
          //   position,
          //   phone,
          //   department,
          //   status,        // active|inactive
          //   systemRole,    // admin|write|read
          //   assignmentMode,// all|specific
          //   clients,       // ["client_001", ...]
          //   projects,      // [{clientId, projectId, permission}, ...]
          //   notes,
          //   initials,
          //   color,
          //   createdAt,
          //   lastActivity
          // }
          teamsLog.log("Nuevo usuario:", data);

          // Aquí luego iría TeamService.create(data) / UserService.create(data)
          ModalManager.success({
            title: "Usuario Creado",
            message: "El usuario ha sido creado exitosamente.",
          });
        }}
        onClose={() => {
          // cierre automático por ModalManager
        }}
      />
    ),
  });
};

const NewTeams = () => {
  return (
    <ActionButton
      label="Nuevo Usuario"
      onClick={showTeamsWizard}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewTeams;