/**
 * ProjectCard.jsx
 * Tarjeta individual de proyecto con acciones (Ver, Editar, Eliminar)
 * Ajustada visualmente para calzar con el estilo de ClientCard
 * Mantiene datos y lógica original, solo cambia formato/estilos.
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const ProjectCard = ({ project, onEdit, onDelete }) => {
  // Status helpers
  const getStatusColor = (status) => {
    const colors = {
      activo:   "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
      inactivo: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400",
    };
    return colors[status] || colors.activo;
  };

  const getStatusText = (status) => {
    const texts = {
      activo: "Activo",
      inactivo: "Inactivo",
    };
    return texts[status] || status;
  };

  // Modal: Ver Detalles
  const handleViewProject = () => {
    ModalManager.show({
      type: "custom",
      title: "Detalles del Proyecto",
      size: "large",
      content: (
        <ViewProjectContent
          project={project}
          onEdit={() => handleEditProject()}
        />
      ),
      showFooter: false,
    });
  };

  // Modal: Editar Proyecto
  const handleEditProject = async () => {
    try {
      const data = await ModalManager.form({
        title: "Editar Proyecto",
        fields: [
          {
            name: "name",
            label: "Nombre del Proyecto",
            type: "text",
            required: true,
            defaultValue: project.name,
            placeholder: "Ej: Desarrollo Web Corporativo",
          },
          {
            name: "client",
            label: "Cliente",
            type: "text",
            required: true,
            defaultValue: project.client,
            placeholder: "Ej: ACME Corporation",
          },
          {
            name: "description",
            label: "Descripción",
            type: "textarea",
            defaultValue: project.description || "",
            placeholder: "Describe brevemente el proyecto...",
            rows: 4,
          },
          {
            name: "status",
            label: "Estado",
            type: "select",
            required: true,
            defaultValue: project.status,
            options: [
              { value: "activo", label: "Activo" },
              { value: "inactivo", label: "Inactivo" },
            ],
          },
          {
            name: "tags",
            label: "Etiquetas",
            type: "text",
            defaultValue: project.tags || "",
            placeholder: "Ej: Web, CMS, Backend (separadas por coma)",
          },
        ],
        submitText: "Guardar Cambios",
        cancelText: "Cancelar",
      });

      onEdit({ ...project, ...data });
    } catch (error) {
      console.log("[ProjectCard] Edición cancelada");
    }
  };

  // Eliminar Proyecto
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

      if (confirmed) onDelete(project.id);
    } catch (error) {
      console.log("[ProjectCard] Eliminación cancelada");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
      <div className="p-6">
        {/* Header (alineado al estilo ClientCard) */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* “Avatar” */}
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <Icon
                name="FaFolderOpen"
                className="text-primary-600 dark:text-primary-400 w-5 h-5"
              />
            </div>

            {/* Title + Meta */}
            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold ${TXT_TITLE} truncate transition-theme`}>
                {project.name}
              </h3>
              <p className={`text-sm ${TXT_META} truncate transition-theme flex items-center gap-2`}>
                <Icon name="FaBuilding" className="w-3.5 h-3.5" />
                {project.client}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
              project.status
            )} flex-shrink-0`}
          >
            {getStatusText(project.status)}
          </span>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className={`text-sm ${TXT_BODY} transition-theme line-clamp-3`}>
            {project.description || "Sin descripción"}
          </p>
        </div>

        {/* Stats (similar a ClientCard) */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Icon name="FaFileAlt" className="text-primary-500 w-4 h-4" />
            <span className={`text-sm ${TXT_BODY} transition-theme`}>
              <span className={`font-semibold ${TXT_TITLE} transition-theme`}>
                {project.minutas || 0}
              </span>{" "}
              {(project.minutas || 0) === 1 ? "minuta" : "minutas"}
            </span>
          </div>

          {/* Tags como “meta” si existen */}
          {project.tags && (
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="FaTags" className={`${TXT_META} w-4 h-4`} />
              <span className={`text-sm ${TXT_BODY} transition-theme truncate`}>
                {project.tags}
              </span>
            </div>
          )}
        </div>

        {/* Tags pills (opcional, estética consistente) */}
        {project.tags && (
          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.split(",").map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs transition-theme"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        )}

        {/* Actions (mismo patrón que ClientCard) */}
        <div className="flex gap-2">
          <button
            onClick={handleViewProject}
            className="flex-1 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
          >
            <Icon name="FaEye" className="w-4 h-4 inline mr-1" />
            Ver Detalles
          </button>

          <button
            onClick={handleEditProject}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Editar proyecto"
            title="Editar"
          >
            <Icon name="FaEdit" className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteProject}
            className="px-3 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            aria-label="Eliminar proyecto"
            title="Eliminar"
          >
            <Icon name="FaTrash" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===========================
   Modal Content: View Details
   (se mantiene tu enfoque, solo se normaliza un poco el look)
   =========================== */
const ViewProjectContent = ({ project, onEdit }) => {
  return (
    <div className="space-y-6">
      {/* Información básica */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
          <Icon name="FaInfoCircle" className="text-primary-500 w-5 h-5" />
          Información General
        </h4>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${TXT_META} w-24`}>Proyecto:</span>
            <span className={`${TXT_TITLE} transition-theme`}>{project.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${TXT_META} w-24`}>Cliente:</span>
            <span className={`${TXT_TITLE} transition-theme`}>{project.client}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${TXT_META} w-24`}>Estado:</span>
            <span className={`${TXT_TITLE} capitalize transition-theme`}>{project.status}</span>
          </div>
        </div>
      </div>

      {/* Descripción */}
      {project.description && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
            <Icon name="FaAlignLeft" className="text-primary-500 w-5 h-5" />
            Descripción
          </h4>
          <p className={`${TXT_BODY} transition-theme`}>{project.description}</p>
        </div>
      )}

      {/* Minutas */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
          <Icon name="FaFileAlt" className="text-primary-500 w-5 h-5" />
          Minutas
        </h4>

        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
            {project.minutas || 0}
          </span>
          <span className={`${TXT_BODY} transition-theme`}>
            {project.minutas === 1 ? "minuta asociada" : "minutas asociadas"}
          </span>
        </div>
      </div>

      {/* Tags */}
      {project.tags && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
            <Icon name="FaTags" className="text-primary-500 w-5 h-5" />
            Etiquetas
          </h4>
          <div className="flex flex-wrap gap-2">
            {project.tags.split(",").map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Botón editar */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Icon name="FaEdit" />
          Editar Proyecto
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;
