/**
 * ProjectCard.jsx
 * Recibe id + summary (DTO mínimo del list).
 * El detalle completo se carga on-demand al abrir View o Edit.
 */

import React, { useState } from 'react';
import Icon from '@/components/ui/icon/iconManager';
import { ModalManager } from '@/components/ui/modal';
import ProjectModal, { PROJECT_MODAL_MODES } from './ProjectModal';
import ActionButton from '@/components/ui/button/ActionButton';
import projectService from '@/services/projectService';

import logger from '@/utils/logger';
const projectLog = logger.scope("project");

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

// Mapea formData del wizard → snake_case para el backend
const toApiPayload = (formData) => ({
  client_id: formData.clientId ?? null,
  name: formData.projectName ?? '',
  code: formData.projectCode ?? null,
  description: formData.projectDescription ?? null,
  status: formData.projectStatus ?? 'activo',
  is_confidential: Boolean(formData.isConfidential),
});

const getStatusColor = (status) => {
  const map = {
    activo: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
    inactivo: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200",
  };
  return map[status] || map.activo;
};

const getStatusText = (status) => {
  const map = { activo: "Activo", inactivo: "Inactivo" };
  return map[status] || status;
};

const ProjectCard = ({ id, summary = null, clientCatalog = [], onUpdated, onDeleted }) => {
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ─── Carga de detalle on-demand ───────────────────────────────────────────

  const fetchDetail = async () => {
    setLoadingDetail(true);
    try {
      const detail = await projectService.getById(id);
      return detail;
    } catch (err) {
      projectLog.error('[ProjectCard] Error cargando detalle:', id, err);
      return summary;
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Cierre modal ─────────────────────────────────────────────────────────

  const closeModal = () => {
    try { ModalManager.hide?.(); } catch (_) { }
    try { ModalManager.close?.(); } catch (_) { }
    try { ModalManager.closeAll?.(); } catch (_) { }
  };

  // ─── Modal: Ver Detalle ───────────────────────────────────────────────────

  const handleViewProject = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: 'custom',
      title: 'Detalle Proyecto',
      size: 'large',
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.VIEW}
          data={detail}
          clientCatalog={clientCatalog}
          onClose={closeModal}
          onSubmit={() => { }}
        />
      ),
    });
  };

  // ─── Modal: Editar ────────────────────────────────────────────────────────

  const handleEditProject = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: 'custom',
      title: 'Editar Proyecto',
      size: 'large',
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.EDIT}
          data={detail}
          clientCatalog={clientCatalog}
          onClose={closeModal}
          onSubmit={async (formData) => {
            const payload = toApiPayload(formData);
            const updated = await projectService.update(id, payload); // lanza si falla → modal muestra toast error
            onUpdated?.(updated);
          }}
        />
      ),
    });
  };

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  const handleDeleteProject = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar el proyecto "${summary?.name ?? 'este proyecto'}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
      });

      if (confirmed) {
        await projectService.softDelete(id);
        onDeleted?.(id);
      }
    } catch (err) {
      projectLog.log('[ProjectCard] Eliminación cancelada o fallida', err);
    }
  };

  // ─── Render (usa summary para mostrar la card) ────────────────────────────

  const name = summary?.name ?? '—';
  const status = summary?.status ?? 'activo';
  const isActive = summary?.isActive ?? true;
  const isConf = summary?.isConfidential ?? false;
  const description = summary?.description ?? null;
  const clientName = summary?.clientName ?? summary?.client ?? null;
  const code = summary?.code ?? null;


  // Tags normalizados
  const tagList =
    typeof summary?.tags === "string" && summary.tags.trim()
      ? summary.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : Array.isArray(summary?.tags)
        ? summary.tags.filter(Boolean)
        : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-secondary-200 dark:border-secondary-700 shadow-sm flex flex-col h-full transition-theme">

      {/* HEADER */}
      <div className="p-5 border-b border-secondary-200 dark:border-secondary-700/60 min-h-[100px]">
        <div className="flex items-start justify-between gap-3 mb-2">
          {/* Left: Título + meta */}
          <div className="min-w-0 flex-1">
            <h3 className={`text-base font-bold ${TXT_TITLE} leading-snug transition-theme`} title={name}>
              {name}
            </h3>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {clientName && (
                <div className={`text-xs ${TXT_META} flex items-center gap-1 truncate col-span-2 transition-theme`}>
                  <Icon name="FaBuilding" className="flex-shrink-0 w-3 h-3" />
                  <span className="truncate">{clientName}</span>
                </div>
              )}

              {/* Si quieres mostrar una mini-descripción en header, que sea col-span-2 */}
              {/* OJO: en tu card ya hay descripción en el BODY, yo sugiero NO duplicar. */}
              {false && description && (
                <div className={`text-xs ${TXT_META} col-span-2 transition-theme`}>
                  <span className="line-clamp-2">{description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isConf ? (
              <span
                className="
            px-2 py-1 rounded-full text-xs font-semibold
            bg-red-100 dark:bg-red-900/30
            text-red-700 dark:text-red-300
            border border-red-200 dark:border-red-800/60
            transition-theme
          "
                title="Proyecto confidencial (acceso restringido)"
              >
                Confidencial
              </span>
            ) : null}

            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
              {getStatusText(status)}
            </span>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-5 flex-1">
        {description ? (
          <p className={`text-sm ${TXT_BODY} line-clamp-3 transition-theme`}>{description}</p>
        ) : (
          <p className={`text-sm ${TXT_META} italic transition-theme`}>Sin descripción</p>
        )}
      </div>

      {/* TAGS */}
      {tagList.length > 0 && (
        <div className="px-5 pb-3 border-t border-secondary-200 dark:border-secondary-700/60 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {tagList.slice(0, 4).map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200"
              >
                {tag}
              </span>
            ))}
            {tagList.length > 4 && (
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${TXT_META} bg-secondary-100 dark:bg-secondary-800`}>
                +{tagList.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <div className="grid grid-cols-3 gap-2 place-items-center">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            tooltip="Ver detalle del proyecto"
            onClick={handleViewProject}
            disabled={loadingDetail}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaEdit" />}
            tooltip="Editar proyecto"
            onClick={handleEditProject}
            disabled={loadingDetail}
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