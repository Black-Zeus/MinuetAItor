/**
 * NewTag.jsx
 * Botón para crear un nuevo Tag via TagsModal + tagService.create
 * Patrón: NewProject.jsx / NewClient.jsx
 */

import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon         from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import tagService   from "@/services/tagService";
import TagsModal, { TAGS_MODAL_MODES } from "@/pages/tags/TagsModal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";
const tagLog = logger.scope("new-tag");

/**
 * Mapea el formData del modal (camelCase) al payload snake_case del backend.
 * Campos auto-generados por el backend (id, created_at, etc.) → NUNCA incluir.
 */
const toApiPayload = (formData) => ({
  category_id: Number(formData.categoryId),
  name:        formData.tagName?.trim() ?? "",
  description: formData.tagDescription?.trim() || null,
  source:      "user",
  status:      formData.tagStatus ?? "activo",
  is_active:   formData.tagStatus !== "inactivo",
});

const NewTag = ({ onCreated, categories = [] }) => {

  const handleSubmit = async (payload) => {
    const apiPayload = toApiPayload(payload);
    tagLog.log("Creating tag:", apiPayload);

    const created = await tagService.create(apiPayload);
    toastSuccess("Tag creado exitosamente");
    ModalManager.closeAll();
    onCreated?.(created);
  };

  const handleClick = () => {
    ModalManager.show({
      type:        "custom",
      title:       "Nuevo Tag",
      size:        "large",
      showFooter:  false,
      content: (
        <TagsModal
          mode={TAGS_MODAL_MODES.CREATE}
          data={null}
          categories={categories}
          onSubmit={handleSubmit}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  return (
    <ActionButton
      label="Nuevo Tag"
      onClick={handleClick}
      variant="primary"
      icon={<Icon name="FaPlus" />}
    />
  );
};

export default NewTag;