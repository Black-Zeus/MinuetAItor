/**
 * NewProfilesCatalog.jsx
 * Botón para crear un nuevo Perfil via ProfilesCatalogModal + profileService.create
 * Patrón: NewTag.jsx
 */

import React from "react";
import ActionButton   from "@/components/ui/button/ActionButton";
import Icon           from "@/components/ui/icon/iconManager";
import ModalManager   from "@/components/ui/modal";
import profileService from "@/services/profileService";
import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from "@/pages/profiles/ProfilesCatalogModal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";
const profileLog = logger.scope("new-profile");

/**
 * Mapea formData del modal al payload snake_case del backend.
 * categories: array { id, name } para resolver categoryId por nombre.
 */
const toApiPayload = (formData, categories = []) => {
  const cat = categories.find(
    (c) => (c.name ?? "").toLowerCase() === (formData.categoria ?? "").toLowerCase()
  );
  const categoryId = cat?.id ?? formData._categoryId ?? null;

  return {
    category_id: categoryId ? Number(categoryId) : undefined,
    name:        (formData.nombre       ?? "").trim() || undefined,
    description: (formData.descripcion  ?? "").trim() || null,
    prompt:      (formData.prompt       ?? "").trim() || undefined,
    is_active:   Boolean(formData.status ?? true),
  };
};

/**
 * Props:
 * - categories: array { id, name } — catálogo de categorías del backend
 * - onCreated(profile): callback cuando se crea exitosamente
 */
const NewProfilesCatalog = ({ categories = [], onCreated }) => {

  const handleSubmit = async (payload) => {
    const apiPayload = toApiPayload(payload, categories);
    profileLog.log("Creating profile:", apiPayload);

    const created = await profileService.create(apiPayload);
    toastSuccess("Perfil creado exitosamente");
    ModalManager.closeAll();
    onCreated?.(created);
  };

  const handleClick = () => {
    ModalManager.show({
      type:       "custom",
      title:      "Nuevo Perfil de Análisis",
      size:       "large",
      showFooter: false,
      content: (
        <ProfilesCatalogModal
          mode={PROFILE_MODAL_MODES.CREATE}
          profile={null}
          categories={categories}
          onSubmit={handleSubmit}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  return (
    <ActionButton
      label="Nuevo Perfil"
      onClick={handleClick}
      variant="primary"
      icon={<Icon name="FaPlus" />}
    />
  );
};

export default NewProfilesCatalog;