import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import profileService from "@/services/profileService";
import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from "./ProfilesCatalogModal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";

const profileLog = logger.scope("profiles-card");

const safeText = (value) => String(value ?? "").trim();

const toModalData = (detail) => ({
  id: detail?.id ?? "",
  nombre: detail?.name ?? "",
  categoria: detail?.category?.name ?? String(detail?.categoryId ?? ""),
  descripcion: detail?.description ?? "",
  prompt: detail?.prompt ?? "",
  status: Boolean(detail?.isActive ?? true),
  _categoryId: detail?.categoryId ?? detail?.category_id ?? null,
});

const toApiPayload = (formData, categories = []) => {
  const category = categories.find(
    (item) => (item.name ?? "").toLowerCase() === (formData.categoria ?? "").toLowerCase()
  );
  const categoryId = category?.id ?? formData._categoryId ?? null;

  return {
    category_id: categoryId ? Number(categoryId) : undefined,
    name: safeText(formData.nombre) || undefined,
    description: safeText(formData.descripcion) || null,
    prompt: safeText(formData.prompt) || undefined,
    is_active: Boolean(formData.status),
  };
};

const ProfilesCatalogViewActions = ({
  id,
  summary,
  categories = [],
  onUpdated,
  onDeleted,
  buttonClassName = "w-full",
}) => {
  const nombre = safeText(summary?.name);

  const fetchDetail = async () => profileService.getById(id);

  const handleView = async () => {
    try {
      const detail = await fetchDetail();
      ModalManager.show({
        type: "custom",
        title: "Detalle de Perfil",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <ProfilesCatalogModal
            mode={PROFILE_MODAL_MODES.VIEW}
            profile={toModalData(detail)}
            categories={categories}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      profileLog.error("fetchDetail error:", error);
      toastError("No se pudo cargar el detalle del perfil");
    }
  };

  const handleEdit = async () => {
    try {
      const detail = await fetchDetail();

      ModalManager.show({
        type: "custom",
        title: "Editar Perfil",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <ProfilesCatalogModal
            mode={PROFILE_MODAL_MODES.EDIT}
            profile={toModalData(detail)}
            categories={categories}
            onSubmit={async (payload) => {
              const updated = await profileService.update(id, toApiPayload(payload, categories));
              toastSuccess("Perfil actualizado exitosamente");
              ModalManager.closeAll();
              onUpdated?.(updated);
            }}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      profileLog.error("handleEdit error:", error);
      toastError("No se pudo cargar el perfil para editar");
    }
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Eliminar Perfil",
        message: `¿Eliminar el perfil "${nombre}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (!confirmed) return;

      await profileService.softDelete(id);
      toastSuccess("Perfil eliminado");
      onDeleted?.(id);
    } catch (error) {
      profileLog.error("handleDelete error:", error);
      toastError("No se pudo eliminar el perfil");
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="eye" />}
        tooltip="Ver detalles"
        onClick={handleView}
        className={buttonClassName}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaEdit" />}
        tooltip="Editar perfil"
        onClick={handleEdit}
        className={buttonClassName}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaTrash" />}
        tooltip="Eliminar perfil"
        onClick={handleDelete}
        className={buttonClassName}
      />
    </div>
  );
};

export default ProfilesCatalogViewActions;
