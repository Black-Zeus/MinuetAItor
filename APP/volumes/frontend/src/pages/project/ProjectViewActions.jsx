import React, { useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import useSessionStore from "@/store/sessionStore";
import { canManageProjects as canManageProjectsAuthz } from "@/utils/authz";
import ProjectModal, { PROJECT_MODAL_MODES } from "./ProjectModal";
import projectService from "@/services/projectService";
import { parseError } from "@/utils/errors";

import logger from "@/utils/logger";

const projectLog = logger.scope("project");

const toApiPayload = (formData) => ({
  client_id: formData.clientId ?? null,
  name: formData.projectName ?? "",
  code: formData.projectCode ?? null,
  description: formData.projectDescription ?? null,
  notes: formData.projectNotes ?? null,
  tags: formData.projectTags ?? null,
  status: formData.projectStatus ?? "activo",
  is_active: (formData.projectStatus ?? "activo") === "activo",
  is_confidential: Boolean(formData.isConfidential),
  auto_send_on_preview: Boolean(formData.autoSendOnPreview),
  auto_send_on_completed: Boolean(formData.autoSendOnCompleted),
  pdf_template_override: formData.pdfTemplateOverride || null,
});

const ProjectViewActions = ({
  id,
  summary = null,
  clientCatalog = [],
  onUpdated,
  onDeleted,
  buttonClassName = "w-full",
}) => {
  const [loadingDetail, setLoadingDetail] = useState(false);
  const authz = useSessionStore((state) => state.authz);
  const canManageProjects = canManageProjectsAuthz(authz);

  const fetchDetail = async () => {
    setLoadingDetail(true);
    try {
      return await projectService.getById(id);
    } catch (error) {
      projectLog.error("[ProjectViewActions] Error cargando detalle:", id, error);
      return summary;
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    try { ModalManager.hide?.(); } catch (_) {}
    try { ModalManager.close?.(); } catch (_) {}
    try { ModalManager.closeAll?.(); } catch (_) {}
  };

  const handleView = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: "custom",
      title: "Detalle Proyecto",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.VIEW}
          data={detail}
          clientCatalog={clientCatalog}
          onClose={closeModal}
          onSubmit={() => {}}
        />
      ),
    });
  };

  const handleEdit = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: "custom",
      title: "Editar Proyecto",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.EDIT}
          data={detail}
          clientCatalog={clientCatalog}
          onClose={closeModal}
          onSubmit={async (formData) => projectService.update(id, toApiPayload(formData))}
          onSaved={async (updated) => {
            onUpdated?.(updated);
          }}
        />
      ),
    });
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar el proyecto "${summary?.name ?? "este proyecto"}"? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      await projectService.softDelete(id);
      onDeleted?.(id);
    } catch (error) {
      projectLog.log("[ProjectViewActions] Eliminación cancelada o fallida", error);
      const parsed = parseError(error);
      ModalManager.warning({
        title: "No se pudo eliminar el proyecto",
        message: parsed.message || "La operación no pudo completarse.",
      });
    }
  };

  return (
    <div className={`grid gap-2 ${canManageProjects ? "grid-cols-3" : "grid-cols-1"}`}>
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="eye" />}
        tooltip="Ver proyecto"
        onClick={handleView}
        className={buttonClassName}
        disabled={loadingDetail}
      />
      {canManageProjects ? (
        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="edit" />}
          tooltip="Editar proyecto"
          onClick={handleEdit}
          className={buttonClassName}
          disabled={loadingDetail}
        />
      ) : null}
      {canManageProjects ? (
        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="delete" />}
          tooltip="Eliminar proyecto"
          onClick={handleDelete}
          className={buttonClassName}
          disabled={loadingDetail}
        />
      ) : null}
    </div>
  );
};

export default ProjectViewActions;
