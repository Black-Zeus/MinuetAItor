/**
 * TagsCard.jsx
 * Card individual de Tag — patrón ProjectCard
 *
 * - Props: id, summary (DTO mínimo de lista), categories, onUpdated, onDeleted
 * - fetchDetail() on-demand solo al abrir View/Edit
 * - toApiPayload() interno para mapeo en update
 * - handleEdit: getById → modal EDIT → tagService.update → onUpdated
 * - handleDelete: confirm → tagService.softDelete → onDeleted
 */

import React from "react";
import Icon         from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
import tagService   from "@/services/tagService";
import TagsModal, { TAGS_MODAL_MODES } from "@/pages/tags/TagsModal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";
const tagLog = logger.scope("tags-card");

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY  = "text-gray-700 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getStatusColor = (isActive) =>
  isActive
    ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200"
    : "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200";

/**
 * Mapea datos del detalle (API) al formData del modal (camelCase)
 */
const toModalData = (detail) => ({
  tagName:        detail?.name        ?? "",
  tagDescription: detail?.description ?? "",
  tagStatus:      detail?.status      ?? "activo",
  categoryId:     String(detail?.categoryId ?? detail?.category_id ?? ""),
});

/**
 * Mapea el payload del modal al payload snake_case para el backend (Update)
 */
const toApiPayload = (formData) => ({
  category_id: Number(formData.categoryId),
  name:        formData.tagName?.trim()        ?? "",
  description: formData.tagDescription?.trim() || null,
  status:      formData.tagStatus              ?? "activo",
  is_active:   formData.tagStatus !== "inactivo",
});

// ─── Componente ───────────────────────────────────────────────────────────────

const TagsCard = ({ id, summary, categories = [], onUpdated, onDeleted }) => {
  // summary es el DTO mínimo de la lista (TagResponse)
  const tag = summary;

  const isActive  = tag?.isActive ?? true;
  const title     = String(tag?.name ?? "");
  const titleUi   = title.length > 25 ? `${title.slice(0, 28)}...` : title;

  const categoryName =
    categories.find((c) => String(c.id) === String(tag?.categoryId))?.name ?? "—";

  // ─── Fetch on-demand ────────────────────────────────────────────────────

  const fetchDetail = async () => {
    return await tagService.getById(id);
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleView = async () => {
    try {
      const detail = await fetchDetail();
      ModalManager.show({
        type:       "custom",
        title:      "Detalle de Tag",
        size:       "large",
        showFooter: false,
        content: (
          <TagsModal
            mode={TAGS_MODAL_MODES.VIEW}
            data={toModalData(detail)}
            categories={categories}
            onSubmit={() => {}}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (err) {
      tagLog.error("fetchDetail error:", err);
      toastError("No se pudo cargar el detalle del tag");
    }
  };

  const handleEdit = async () => {
    try {
      const detail = await fetchDetail();

      const handleSubmit = async (payload) => {
        const apiPayload = toApiPayload(payload);
        tagLog.log("Updating tag:", id, apiPayload);
        const updated = await tagService.update(id, apiPayload);
        toastSuccess("Tag actualizado exitosamente");
        ModalManager.closeAll();
        onUpdated?.(updated);
      };

      ModalManager.show({
        type:       "custom",
        title:      "Editar Tag",
        size:       "large",
        showFooter: false,
        content: (
          <TagsModal
            mode={TAGS_MODAL_MODES.EDIT}
            data={toModalData(detail)}
            categories={categories}
            onSubmit={handleSubmit}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (err) {
      tagLog.error("handleEdit error:", err);
      toastError("No se pudo cargar el tag para editar");
    }
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title:       "Eliminar Tag",
        message:     `¿Eliminar el tag "${title}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText:  "Cancelar",
        variant:     "danger",
      });

      if (!confirmed) return;

      await tagService.softDelete(id);
      toastSuccess("Tag eliminado");
      onDeleted?.(id);
    } catch (err) {
      if (err === false || err === undefined) return; // cancelado
      tagLog.error("handleDelete error:", err);
      toastError("No se pudo eliminar el tag");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-900 border border-secondary-200 dark:border-secondary-700/60 rounded-xl shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">

      {/* HEADER */}
      <div className="p-6 pb-4 border-b border-secondary-100 dark:border-secondary-700/40 min-h-[88px]">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`text-base font-semibold ${TXT_TITLE} transition-theme leading-snug`}
            title={title}
          >
            {titleUi}
          </h3>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(isActive)}`}
          >
            {isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
        {categoryName !== "—" && (
          <p className={`text-xs ${TXT_META} mt-1`}>{categoryName}</p>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 p-6">
        <p className={`text-sm ${TXT_BODY} line-clamp-3 transition-theme`}>
          {tag?.description || "Sin descripción"}
        </p>

        <div className="flex items-center gap-2 mt-4">
          <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
            <Icon
              name="FaTag"
              className="text-primary-600 dark:text-primary-400 w-4 h-4"
            />
          </div>
          <span className={`text-xs ${TXT_META}`}>Fuente: {tag?.source ?? "user"}</span>
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[70px] flex flex-col">
        <div className="grid grid-cols-3 gap-2 mt-auto w-full place-items-center">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaEye" />}
            tooltip="Ver detalle"
            onClick={handleView}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaPenToSquare" />}
            tooltip="Editar tag"
            onClick={handleEdit}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaTrash" />}
            tooltip="Eliminar tag"
            onClick={handleDelete}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default TagsCard;