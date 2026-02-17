/**
 * ProfilesCatalogCard.jsx
 * Card individual para mostrar un perfil de análisis
 *
 * Fix:
 * - status normalizado a "activo" | "inactivo"
 * - se pasa categories al modal (VIEW/EDIT) para llenar combo de categoría
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";

import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from "./ProfilesCatalogModal";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const safeText = (v) => String(v ?? "").trim();

const normalizeStatus = (v) => {
  // soporta boolean, "activo/inactivo", "active/inactive"
  if (typeof v === "boolean") return v ? "activo" : "inactivo";
  const s = safeText(v).toLowerCase();
  if (s === "activo" || s === "active") return "activo";
  if (s === "inactivo" || s === "inactive") return "inactivo";
  return "inactivo";
};

const getStatusColor = (status) => {
  const colors = {
    activo:
      "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
    inactivo:
      "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200",
  };
  return colors[status] || colors.inactivo;
};

const getStatusText = (status) => {
  const texts = { activo: "Activo", inactivo: "Inactivo" };
  return texts[status] || "Inactivo";
};

const truncateUi = (text, base = 25) => {
  const t = safeText(text);
  return t.length > base ? `${t.slice(0, base + 3)}...` : t;
};

/**
 * props:
 * - profile: objeto perfil (modelo UI)
 * - categories: string[] (catálogo cerrado)
 * - onEdit(id, payload)
 * - onDelete(id)
 */
const ProfilesCatalogCard = ({ profile, categories = [], onEdit, onDelete }) => {
  // ============================================================
  // NORMALIZACIÓN UI
  // ============================================================
  const status = normalizeStatus(profile?.status);
  const isActive = status === "activo";

  const nombre = safeText(profile?.nombre) || "Sin nombre";
  const categoria = safeText(profile?.categoria) || "Sin categoría";
  const descripcion = safeText(profile?.descripcion) || "Sin descripción";

  const prompt = safeText(profile?.prompt);
  const hasPrompt = Boolean(prompt);

  const titleUi = truncateUi(nombre, 25);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleView = () => {
    ModalManager.show({
      type: "custom",
      title: "Ver Perfil de Análisis",
      size: "large",
      showFooter: false,
      content: (
        <ProfilesCatalogModal
          mode={PROFILE_MODAL_MODES.VIEW}
          profile={profile}
          categories={categories} // ✅ NECESARIO
          onClose={() => ModalManager.close?.()}
        />
      ),
    });
  };

  const handleEdit = () => {
    ModalManager.show({
      type: "custom",
      title: "Editar Perfil de Análisis",
      size: "large",
      showFooter: false,
      content: (
        <ProfilesCatalogModal
          mode={PROFILE_MODAL_MODES.EDIT}
          profile={profile}
          categories={categories} // ✅ NECESARIO
          onSubmit={(data) => {
            onEdit?.(profile.id, data);
            ModalManager.close?.();
          }}
          onClose={() => ModalManager.close?.()}
        />
      ),
    });
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar el perfil "${nombre}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (confirmed) onDelete?.(profile.id);
    } catch (e) {
      console.log("[ProfilesCatalogCard] Eliminación cancelada");
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400 h-full flex flex-col">
      {/* HEADER */}
      <div className="p-6 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[120px]">
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="col-span-2 flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <Icon
                name="FaLayerGroup"
                className="text-primary-600 dark:text-primary-400 w-5 h-5"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className={`text-lg font-semibold ${TXT_TITLE} leading-snug transition-theme text-center`}
                title={nombre}
              >
                {titleUi}
              </h3>

              {hasPrompt ? (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <Icon
                    name="FaTerminal"
                    className="text-purple-600 dark:text-purple-400 w-3.5 h-3.5"
                    title="Tiene prompt configurado"
                  />
                  <span className={`text-xs ${TXT_META} transition-theme`}>
                    Prompt configurado
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Categoría */}
          <div className={`flex flex-col gap-2 text-xs ${TXT_META} transition-theme`}>
            <span className="flex items-center gap-1.5 min-w-0">
              <Icon name="FaTag" className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{categoria}</span>
            </span>
          </div>

          {/* Estado */}
          <div className="flex justify-end">
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-theme ${getStatusColor(
                status
              )}`}
              title={`Estado: ${getStatusText(status)}`}
            >
              <Icon name={isActive ? "checkCircle" : "ban"} />
              {getStatusText(status)}
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col">
        <div className="p-6">
          <div className="mb-4">
            <p className={`text-sm ${TXT_BODY} transition-theme line-clamp-3`}>
              {descripcion}
            </p>
          </div>

          {hasPrompt ? (
            <div className="mt-4">
              <div className="flex items-center gap-3 pt-4">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                  <Icon
                    name="FaCode"
                    className="text-primary-600 dark:text-primary-400 w-4 h-4"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold ${TXT_META} transition-theme`}>
                    Prompt
                  </div>
                  <p className={`text-xs ${TXT_BODY} transition-theme font-mono line-clamp-2`}>
                    {prompt}
                  </p>
                </div>
              </div>

              <div className={`text-xs ${TXT_META} transition-theme mt-2`}>
                Vista previa del prompt configurado
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[70px] flex flex-col">
        <div className="grid grid-cols-3 gap-2 mt-auto w-full place-items-center">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            tooltip="Ver detalles del perfil"
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