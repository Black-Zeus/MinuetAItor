/**
 * ProfilesCatalogCard.jsx
 * Card individual de Perfil de Análisis — patrón TagsCard
 *
 * - Props: id, summary (DTO mínimo de lista), categories, onUpdated, onDeleted
 * - fetchDetail() on-demand solo al abrir View/Edit
 * - toApiPayload() interno para mapeo en update
 * - handleEdit: getById → modal EDIT → profileService.update → onUpdated
 * - handleDelete: confirm → profileService.softDelete → onDeleted
 *
 * API shape (AiProfileResponse camelCase):
 *  id, name, description, prompt, isActive, categoryId, category:{id,name}
 */

import React from "react";
import Icon         from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
import profileService from "@/services/profileService";
import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from "./ProfilesCatalogModal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";
const profileLog = logger.scope("profiles-card");

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY  = "text-gray-700 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeText = (v) => String(v ?? "").trim();

const truncateUi = (text, base = 25) => {
  const t = safeText(text);
  return t.length > base ? `${t.slice(0, base + 3)}...` : t;
};

const getStatusColor = (isActive) =>
  isActive
    ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200"
    : "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200";

/**
 * Mapea datos del detalle (API camelCase) al formData del modal (modelo UI)
 * Modal espera: { nombre, categoria, descripcion, prompt, status(boolean) }
 */
const toModalData = (detail) => ({
  id:          detail?.id          ?? "",
  nombre:      detail?.name        ?? "",
  categoria:   detail?.category?.name ?? String(detail?.categoryId ?? ""),
  descripcion: detail?.description ?? "",
  prompt:      detail?.prompt      ?? "",
  status:      Boolean(detail?.isActive ?? true),
  // conservar categoryId para poder mapear de vuelta
  _categoryId: detail?.categoryId  ?? detail?.category_id ?? null,
});

/**
 * Mapea el payload del modal al payload snake_case para el backend (Update)
 * categories: array de objetos { id, name } del backend
 */
const toApiPayload = (formData, categories = []) => {
  // Buscar categoryId por nombre si no viene explícito
  const cat = categories.find(
    (c) => (c.name ?? "").toLowerCase() === (formData.categoria ?? "").toLowerCase()
  );
  const categoryId = cat?.id ?? formData._categoryId ?? null;

  return {
    category_id: categoryId ? Number(categoryId) : undefined,
    name:        safeText(formData.nombre) || undefined,
    description: safeText(formData.descripcion) || null,
    prompt:      safeText(formData.prompt)      || undefined,
    is_active:   Boolean(formData.status),
  };
};

// ─── Componente ───────────────────────────────────────────────────────────────

const ProfilesCatalogCard = ({ id, summary, categories = [], onUpdated, onDeleted }) => {
  const profile = summary;

  const isActive   = Boolean(profile?.isActive ?? true);
  const nombre     = safeText(profile?.name);
  const categoria  = profile?.category?.name ?? safeText(profile?.categoryId) ?? "—";
  const descripcion = safeText(profile?.description);
  const prompt      = safeText(profile?.prompt);
  const hasPrompt   = Boolean(prompt);
  const titleUi     = truncateUi(nombre, 25);

  // ─── Fetch on-demand ────────────────────────────────────────────────────────

  const fetchDetail = async () => profileService.getById(id);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleView = async () => {
    try {
      const detail = await fetchDetail();
      ModalManager.show({
        type:       "custom",
        title:      "Detalle de Perfil",
        size:       "large",
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
    } catch (err) {
      profileLog.error("fetchDetail error:", err);
      toastError("No se pudo cargar el detalle del perfil");
    }
  };

  const handleEdit = async () => {
    try {
      const detail = await fetchDetail();

      const handleSubmit = async (payload) => {
        const apiPayload = toApiPayload(payload, categories);
        profileLog.log("Updating profile:", id, apiPayload);
        const updated = await profileService.update(id, apiPayload);
        toastSuccess("Perfil actualizado exitosamente");
        ModalManager.closeAll();
        onUpdated?.(updated);
      };

      ModalManager.show({
        type:       "custom",
        title:      "Editar Perfil",
        size:       "large",
        showFooter: false,
        content: (
          <ProfilesCatalogModal
            mode={PROFILE_MODAL_MODES.EDIT}
            profile={toModalData(detail)}
            categories={categories}
            onSubmit={handleSubmit}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (err) {
      profileLog.error("handleEdit error:", err);
      toastError("No se pudo cargar el perfil para editar");
    }
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title:       "Eliminar Perfil",
        message:     `¿Eliminar el perfil "${nombre}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText:  "Cancelar",
        variant:     "danger",
      });

      if (!confirmed) return;

      await profileService.softDelete(id);
      toastSuccess("Perfil eliminado");
      onDeleted?.(id);
    } catch (err) {
      profileLog.error("handleDelete error:", err);
      toastError("No se pudo eliminar el perfil");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">

      {/* HEADER */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
              <Icon name="FaBrain" className="text-primary-600 dark:text-primary-400 w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm font-semibold ${TXT_TITLE} truncate transition-theme`}
                  title={nombre}>
                {titleUi || "Sin nombre"}
              </h3>
              <p className={`text-xs ${TXT_META} truncate transition-theme`}>
                {categoria}
              </p>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(isActive)}`}>
            <Icon name={isActive ? "checkCircle" : "ban"} />
            {isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col p-5">
        <p className={`text-sm ${TXT_BODY} transition-theme line-clamp-3`}>
          {descripcion || "Sin descripción"}
        </p>

        {hasPrompt && (
          <div className="mt-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-800 flex items-center justify-center shrink-0">
              <Icon name="FaCode" className={`${TXT_META} w-3.5 h-3.5`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-semibold ${TXT_META} mb-0.5 transition-theme`}>Prompt</div>
              <p className={`text-xs ${TXT_BODY} font-mono line-clamp-2 transition-theme`}>{prompt}</p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-2">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            tooltip="Ver detalles"
            onClick={handleView}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaEdit" />}
            tooltip="Editar perfil"
            onClick={handleEdit}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaTrash" />}
            tooltip="Eliminar perfil"
            onClick={handleDelete}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default ProfilesCatalogCard;