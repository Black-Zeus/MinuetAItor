/**
 * NewTag.jsx
 * Botón que abre el modal para crear tag usando TagsModal (modo createNewTag)
 */

import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import { FaPlus } from "react-icons/fa";
import ModalManager from "@/components/ui/modal";

// Import del componente único
import TagsModal, { TAGS_MODAL_MODES } from "@/pages/tags/TagsModal";


// Botón que abre el modal
const showTagWizard = () => {
  ModalManager.show({
    type: "custom",
    title: "Crear Nuevo Tag",
    size: "large",
    showFooter: false,
    content: (
      <TagsModal
        mode={TAGS_MODAL_MODES.CREATE}
        data={null}
        onSubmit={(payload) => {
          // payload normalizado desde TagsModal:
          // { tagName, tagDescription, tagStatus, id? }
          console.log("✅ Nuevo tag:", payload);

          // Ejemplo DEV (opcional): agregar a catálogo local en memoria (no persistente)
          // En PROD: TagsService.create(payload)

          ModalManager.success({
            title: "Tag Creado",
            message: "El tag ha sido creado exitosamente.",
          });
        }}
        onDelete={() => {}}
        onClose={() => {
          // cierre automático por ModalManager
        }}
      />
    ),
  });
};

const NewTag = () => {
  return (
    <ActionButton
      label="Nuevo Tag"
      onClick={showTagWizard}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewTag;