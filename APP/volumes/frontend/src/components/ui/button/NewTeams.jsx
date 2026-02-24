/**
 * NewTeams.jsx
 * Botón que abre TeamsModal en modo CREATE.
 * Sigue el patrón: toApiPayload → service.create → onCreated
 */

import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon         from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";

import TeamsModal, { TEAMS_MODAL_MODES } from "@/pages/teams/TeamsModal";
import teamsService from "@/services/teamsService";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";
const teamsLog = logger.scope("teams");

// ─── Serializa clientProjects → { clients: string[], projects: string[] } ─────
//
// formData.clientProjects tiene forma:
//   { [clientId]: { clientEnabled: bool, projects: Set<projectId> | projectId[] } }
//
// El backend espera arrays planos de IDs:
//   clients:  IDs de clientes con clientEnabled = true
//   projects: IDs de proyectos seleccionados (de todos los clientes habilitados)

const serializeClientProjects = (clientProjects = {}) => {
  const clients  = [];
  const projects = [];

  Object.entries(clientProjects).forEach(([clientId, sel]) => {
    if (!sel?.clientEnabled) return;
    clients.push(clientId);
    const prSet = sel.projects instanceof Set ? sel.projects : new Set(sel.projects ?? []);
    prSet.forEach((pid) => projects.push(pid));
  });

  return { clients, projects };
};

// ─── Mapeo camelCase (formData) → alias backend ───────────────────────────────
// TeamCreateRequest acepta:
//   username, email, name, phone, position, department, initials, color, notes,
//   status, systemRole, assignmentMode, clients[], projects[]
//
// NOTA: color se guarda como string corto ("blue", "green"…), no como hex.

const toApiPayload = (formData) => {
  const { clients, projects } = serializeClientProjects(formData.clientProjects);
  return {
    username:       formData.username       ?? "",
    email:          formData.email          ?? "",
    name:           formData.name           ?? "",
    phone:          formData.phone          || null,
    position:       formData.position       || null,
    department:     formData.department     || null,
    initials:       formData.initials       || null,
    color:          formData.color          || null,   // string: "blue", "green", etc.
    notes:          formData.notes          || null,
    systemRole:     formData.systemRole     ?? "read",
    assignmentMode: formData.assignmentMode ?? "specific",
    status:         formData.status         ?? "active",
    clients,
    projects,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

const NewTeams = ({ onCreated }) => {
  const handleOpen = () => {
    ModalManager.show({
      type:        "custom",
      title:       "Crear Nuevo Usuario",
      size:        "large",
      showFooter:  false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.CREATE}
          onSubmit={async (formData) => {
            const payload = toApiPayload(formData);
            teamsLog.log("[NewTeams] Creando usuario:", payload);
            const created = await teamsService.create(payload);
            onCreated?.(created);
            toastSuccess("Usuario creado exitosamente.");
            ModalManager.closeAll();
          }}
        />
      ),
    });
  };

  return (
    <ActionButton
      label="Nuevo Usuario"
      onClick={handleOpen}
      variant="primary"
      icon={<Icon name="FaPlus" />}
    />
  );
};

export default NewTeams;