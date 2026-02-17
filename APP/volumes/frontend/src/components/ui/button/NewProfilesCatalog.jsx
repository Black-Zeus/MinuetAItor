/**
 * NewProfilesCatalog.jsx
 * Botón que abre el modal para crear perfil usando ProfilesCatalogModal
 *
 * Fix:
 * - se pasa categories al modal (CREATE) para llenar combo de categoría
 */

import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import { FaPlus } from "react-icons/fa";
import ModalManager from "@/components/ui/modal";

import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from "@/pages/profiles/ProfilesCatalogModal";

/**
 * props:
 * - categories: string[] (catálogo cerrado)
 * - onCreate(payload) opcional: si quieres que el padre inserte el perfil
 */
const NewProfilesCatalog = ({ categories = [], onCreate }) => {
  const showProfileWizard = () => {
    ModalManager.show({
      type: "custom",
      title: "Crear Nuevo Perfil",
      size: "large",
      showFooter: false,
      content: (
        <ProfilesCatalogModal
          mode={PROFILE_MODAL_MODES.CREATE}
          categories={categories} // ✅ NECESARIO
          onSubmit={(data) => {
            // data normalizado desde ProfilesCatalogModal
            // { id?, nombre, categoria, descripcion, prompt, status(boolean) }
            onCreate?.(data);

            ModalManager.success({
              title: "Perfil Creado",
              message: `El perfil "${data.nombre}" ha sido creado exitosamente.`,
            });

            ModalManager.close?.();
          }}
          onClose={() => {
            ModalManager.close?.();
          }}
        />
      ),
    });
  };

  return (
    <ActionButton
      label="Nuevo Perfil"
      onClick={showProfileWizard}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewProfilesCatalog;