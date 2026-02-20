/**
 * TagsCard.jsx (alineado a ProjectCard / MinuteCard template)
 * - Card h-full + flex-col (misma proporción en grillas)
 * - Header con min-h fijo y grid (título + estado)
 * - Título truncado (mismo patrón)
 * - Footer fijo con ActionButton + tooltip
 * - View/Edit/Delete con ModalManager (mismo patrón que ProjectCard)
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";

import TagsModal, { TAGS_MODAL_MODES } from "@/pages/tags/TagsModal";

import logger from '@/utils/logger';
const tagLog = logger.scope("tag");

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const TagsCard = ({ tag, onEdit, onDelete, onToggleStatus }) => {
  const getStatusColor = (status) => {
    const colors = {
      active:
        "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
      inactive:
        "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200",
    };
    return colors[status] || colors.active;
  };

  const getStatusText = (status) => {
    const texts = { active: "Activo", inactive: "Inactivo" };
    return texts[status] || status;
  };

  const statusLabel = getStatusText(tag?.status);

  // --- Header truncation (mismo patrón) ---
  const title = String(tag?.name ?? "");
  const numberIndex = 25;
  const titleUi =
    title.length > numberIndex ? `${title.slice(0, numberIndex + 3)}...` : title;

  const applyWizardPayload = (payload) => {
    // payload desde TagsModal:
    // { id?, tagName, tagDescription, tagStatus }
    return {
      ...tag,
      id: payload.id ?? tag.id, // conserva id si backend lo asigna
      name: payload.tagName,
      description: payload.tagDescription,
      status: payload.tagStatus,
      // category se conserva desde el tag actual
    };
  };

  const handleViewTag = () => {
    ModalManager.show({
      type: "custom",
      title: "Detalle de Etiqueta",
      size: "large",
      showFooter: false,
      content: (
        <TagsModal
          mode={TAGS_MODAL_MODES.VIEW}
          data={tag}
          onClose={() => {}}
          onSubmit={() => {}}
          onDelete={async () => {
            // opcional: si quieres permitir eliminar desde modal en view
            await handleDeleteTag();
          }}
        />
      ),
    });
  };

  const handleEditTag = () => {
    ModalManager.show({
      type: "custom",
      title: "Editar Etiqueta",
      size: "large",
      showFooter: false,
      content: (
        <TagsModal
          mode={TAGS_MODAL_MODES.EDIT}
          data={tag}
          onClose={() => {}}
          onSubmit={(payload) => {
            const updated = applyWizardPayload(payload);
            onEdit?.(updated);

            ModalManager.success({
              title: "Etiqueta Actualizada",
              message: "Los cambios han sido guardados exitosamente.",
            });
          }}
          onDelete={async () => {
            await handleDeleteTag();
          }}
        />
      ),
    });
  };

  const handleDeleteTag = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar la etiqueta "${tag?.name}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (confirmed) onDelete?.(tag?.id);
    } catch (error) {
      tagLog.log("[TagsCard] Eliminación cancelada");
    }
  };

  const handleToggle = async () => {
    // Mantengo tu API, pero es más coherente pasar id.
    // Si tu padre hoy espera name, cambia a onToggleStatus?.(tag?.name)
    onToggleStatus?.(tag?.id);
  };

  return (
    <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400 h-full flex flex-col">
      {/* HEADER (fijo) */}
      <div className="p-6 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[120px]">
        <div className="grid grid-cols-2 gap-3 items-start">
          {/* Título ocupa todo el ancho */}
          <div className="col-span-2 flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <Icon
                name="FaTag"
                className="text-primary-600 dark:text-primary-400 w-5 h-5"
              />
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

          {/* Meta (izquierda) */}
          <div className={`flex flex-col gap-2 text-xs ${TXT_META} transition-theme`}>
            <span className="flex items-center gap-1.5 min-w-0">
              <Icon name="FaLayerGroup" className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tag?.category || "Sin categoría"}</span>
            </span>
          </div>

          {/* Estado (derecha) */}
          <div className="flex justify-end items-center gap-2">
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-theme ${getStatusColor(
                tag?.status
              )}`}
              title={`Estado: ${statusLabel}`}
            >
              <Icon name={tag?.status === "active" ? "checkCircle" : "ban"} />
              {statusLabel}
            </div>

            {/* Si quieres toggle real en UI, agrega botón aquí (opcional) */}
            {/* <ActionButton variant="soft" size="xs" icon={<Icon name="FaPowerOff" />} tooltip="Cambiar estado" onClick={handleToggle} /> */}
          </div>
        </div>
      </div>

      {/* BODY (flexible) */}
      <div className="flex-1 flex flex-col">
        <div className="p-6">
          <p className={`text-sm ${TXT_BODY} transition-theme line-clamp-3`}>
            {tag?.description || "Sin descripción"}
          </p>

          <div className="flex items-center gap-3 pt-6">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
              <Icon
                name="FaTag"
                className="text-primary-600 dark:text-primary-400 w-4 h-4"
              />
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER (fijo) */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[70px] flex flex-col">
        <div className="grid grid-cols-3 gap-2 mt-auto w-full place-items-center">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaEye" />}
            tooltip="Ver detalle de la etiqueta"
            onClick={handleViewTag}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaPenToSquare" />}
            tooltip="Editar etiqueta"
            onClick={handleEditTag}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaTrash" />}
            tooltip="Eliminar etiqueta"
            onClick={handleDeleteTag}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default TagsCard;