import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import tagService from "@/services/tagService";
import TagsModal, { TAGS_MODAL_MODES } from "@/pages/tags/TagsModal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";

const tagLog = logger.scope("tags-card");

const toModalData = (detail) => ({
  tagName: detail?.name ?? "",
  tagDescription: detail?.description ?? "",
  tagStatus: detail?.status ?? "activo",
  categoryId: String(detail?.categoryId ?? detail?.category_id ?? ""),
});

const toApiPayload = (formData) => ({
  category_id: Number(formData.categoryId),
  name: formData.tagName?.trim() ?? "",
  description: formData.tagDescription?.trim() || null,
  status: formData.tagStatus ?? "activo",
  is_active: formData.tagStatus !== "inactivo",
});

const TagsViewActions = ({ id, summary, categories = [], onUpdated, onDeleted, buttonClassName = "w-full" }) => {
  const title = String(summary?.name ?? "");

  const fetchDetail = async () => tagService.getById(id);

  const handleView = async () => {
    try {
      const detail = await fetchDetail();
      ModalManager.show({
        type: "custom",
        title: "Detalle de Tag",
        size: "clientWide",
        showHeader: false,
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
    } catch (error) {
      tagLog.error("fetchDetail error:", error);
      toastError("No se pudo cargar el detalle del tag");
    }
  };

  const handleEdit = async () => {
    try {
      const detail = await fetchDetail();

      ModalManager.show({
        type: "custom",
        title: "Editar Tag",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <TagsModal
            mode={TAGS_MODAL_MODES.EDIT}
            data={toModalData(detail)}
            categories={categories}
            onSubmit={async (payload) => {
              const updated = await tagService.update(id, toApiPayload(payload));
              toastSuccess("Tag actualizado exitosamente");
              ModalManager.closeAll();
              onUpdated?.(updated);
            }}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      tagLog.error("handleEdit error:", error);
      toastError("No se pudo cargar el tag para editar");
    }
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Eliminar Tag",
        message: `¿Eliminar el tag "${title}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (!confirmed) return;

      await tagService.softDelete(id);
      toastSuccess("Tag eliminado");
      onDeleted?.(id);
    } catch (error) {
      if (error === false || error === undefined) return;
      tagLog.error("handleDelete error:", error);
      toastError("No se pudo eliminar el tag");
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaEye" />}
        tooltip="Ver detalle"
        onClick={handleView}
        className={buttonClassName}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaPenToSquare" />}
        tooltip="Editar tag"
        onClick={handleEdit}
        className={buttonClassName}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaTrash" />}
        tooltip="Eliminar tag"
        onClick={handleDelete}
        className={buttonClassName}
      />
    </div>
  );
};

export default TagsViewActions;
