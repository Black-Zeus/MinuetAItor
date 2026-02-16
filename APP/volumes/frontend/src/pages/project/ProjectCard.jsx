/**
 * ProjectCard.jsx (alineado a MinuteCard template)
 * - Card con h-full + flex-col (misma proporción en grillas)
 * - Header con min-h fijo y grid 2 columnas (cliente/estado)
 * - Título truncado por longitud (igual patrón)
 * - Footer fijo con ActionButton + tooltip
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";

import ProjectModal, { PROJECT_MODAL_MODES } from "@/pages/project/ProjectModal";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const ProjectCard = ({ project, clients = [], onEdit, onDelete }) => {
  const getStatusColor = (status) => {
    const colors = {
      activo:
        "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
      inactivo:
        "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200",
    };
    return colors[status] || colors.activo;
  };

  const getStatusText = (status) => {
    const texts = { activo: "Activo", inactivo: "Inactivo" };
    return texts[status] || status;
  };

  const applyWizardPayload = (payload) => {
    const clientId =
      payload.clientId !== undefined &&
        payload.clientId !== null &&
        String(payload.clientId).trim() !== ""
        ? Number.isFinite(Number(payload.clientId))
          ? Number(payload.clientId)
          : payload.clientId
        : project.clientId;

    return {
      ...project,
      clientId,
      name: payload.projectName,
      client: payload.clientName || project.client,
      description: payload.projectDescription,
      status: payload.projectStatus,
      tags: payload.projectTags,
      confidential: Boolean(payload.isConfidential),
      isConfidential: Boolean(payload.isConfidential),
    };
  };

  const handleViewProject = () => {
    ModalManager.show({
      type: "custom",
      title: "Detalles del Proyecto",
      size: "large",
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.VIEW}
          data={project}
          clients={clients}
          onClose={() => { }}
          onSubmit={() => { }}
        />
      ),
    });
  };

  const handleEditProject = () => {
    ModalManager.show({
      type: "custom",
      title: "Editar Proyecto",
      size: "large",
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.EDIT}
          data={project}
          clients={clients}
          onClose={() => { }}
          onSubmit={(payload) => {
            const updated = applyWizardPayload(payload);
            onEdit?.(updated);

            ModalManager.success({
              title: "Proyecto Actualizado",
              message: "Los cambios han sido guardados exitosamente.",
            });
          }}
        />
      ),
    });
  };

  const handleDeleteProject = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar el proyecto "${project.name}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (confirmed) onDelete?.(project.id);
    } catch (error) {
      console.log("[ProjectCard] Eliminación cancelada");
    }
  };

  // --- Header truncation (mismo patrón) ---
  const title = String(project?.name ?? "");
  const numberIndex = 25;
  const titleUi =
    title.length > numberIndex ? `${title.slice(0, numberIndex + 3)}...` : title;

  // --- Tags normalizados (si vienen como string CSV) ---
  const tagList =
    typeof project?.tags === "string" && project.tags.trim()
      ? project.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  return (
    <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400 h-full flex flex-col">
      {/* HEADER (fijo) */}
      <div className="p-6 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[120px]">
        <div className="grid grid-cols-2 gap-3 items-start">
          {/* Título ocupa todo el ancho */}
          <div className="col-span-2 flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <Icon name="FaFolderOpen" className="text-primary-600 dark:text-primary-400 w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className={`text-lg font-semibold ${TXT_TITLE} leading-snug transition-theme text-center`}
                title={title}
              >
                {titleUi}
              </h3>
            </div>
          </div>

          {/* Cliente (izquierda) */}
          <div className={`flex flex-col gap-2 text-xs ${TXT_META} transition-theme`}>
            <span className="flex items-center gap-1.5 min-w-0">
              <Icon name="FaBuilding" className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project.client || "Sin cliente"}</span>
            </span>
          </div>

          {/* Estado (derecha) */}
          <div className="flex justify-end">
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-theme ${getStatusColor(
                project.status
              )}`}
              title={`Estado: ${getStatusText(project.status)}`}
            >
              <Icon name={project.status === "activo" ? "checkCircle" : "ban"} />
              {getStatusText(project.status)}
            </div>
          </div>
        </div>
      </div>

      {/* BODY (flexible) */}
      <div className="flex-1 flex flex-col">
        {/* Contenido principal */}
        <div className="p-6">
          <div className="mb-4">
            <p className={`text-sm ${TXT_BODY} transition-theme line-clamp-3`}>
              {project.description || "Sin descripción"}
            </p>
          </div>

          {/* Minutas (mejor presentación) */}
          <div className="flex items-center gap-3 pt-4">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
              <Icon name="FaFileAlt" className="text-primary-600 dark:text-primary-400 w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className={`flex items-baseline gap-2 ${TXT_BODY} transition-theme`}>
                <span className={`text-xl font-extrabold ${TXT_TITLE} transition-theme leading-none`}>
                  {project.minutas || 0}
                </span>
                <span className="text-sm">
                  {(project.minutas || 0) === 1 ? "minuta" : "minutas"}
                </span>
              </div>

              <div className={`text-xs ${TXT_META} transition-theme`}>
                Total registradas en este proyecto
              </div>
            </div>
          </div>
        </div>

        {/* Línea separadora SOBRE tags */}
        {tagList.length ? (
          <div className="px-6 mt-auto border-t border-secondary-200 dark:border-secondary-700/60 pt-4 pb-4">
            <div className="flex flex-wrap gap-2 justify-center">
              {tagList.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-theme bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* FOOTER (fijo) */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[70px] flex flex-col">
        <div className="grid grid-cols-3 gap-2 mt-auto w-full place-items-center">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            tooltip="Abrir vista detalle del proyecto"
            onClick={handleViewProject}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaEdit" />}
            tooltip="Editar proyecto"
            onClick={handleEditProject}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaTrash" />}
            tooltip="Eliminar proyecto"
            onClick={handleDeleteProject}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;