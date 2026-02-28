/**
 * ProfilesCatalogModal.jsx
 * Modal de Perfiles de Análisis (CREATE / VIEW / EDIT)
 *
 * CAMBIO: ya no importa analysisProfilesCatalog.json para derivar categorías.
 * Las categorías llegan como prop desde el backend: Array<{ id: number, name: string }>
 *
 * formData interno (modelo UI):
 *  { nombre, categoria (string=name), descripcion, prompt, status (boolean) }
 *
 * onSubmit recibe ese mismo formData — el llamador (NewProfilesCatalog / ProfilesCatalogCard)
 * es responsable de mapearlo al payload snake_case del backend.
 */

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";

// ============================================================
// MODOS
// ============================================================
export const PROFILE_MODAL_MODES = {
  CREATE: "create",
  VIEW:   "view",
  EDIT:   "edit",
};

// ============================================================
// HELPERS
// ============================================================

const normalizeText = (v) => String(v ?? "").trim();

const normalizeBoolean = (v, fallback = true) => {
  if (typeof v === "boolean") return v;
  const s = normalizeText(v).toLowerCase();
  if (s === "activo" || s === "active")     return true;
  if (s === "inactivo" || s === "inactive") return false;
  return fallback;
};

const normalizeProfile = (data = {}) => ({
  id:          data.id          ?? "",
  nombre:      data.nombre      ?? "",
  categoria:   data.categoria   ?? "",
  descripcion: data.descripcion ?? "",
  prompt:      data.prompt      ?? "",
  status:      normalizeBoolean(data.status, true),
});

// Validación básica
const validate = (formData, isCreate) => {
  const errors = {};
  if (!normalizeText(formData.nombre))
    errors.nombre = "El nombre es obligatorio";
  if (normalizeText(formData.nombre).length < 3)
    errors.nombre = "Mínimo 3 caracteres";
  if (!normalizeText(formData.categoria))
    errors.categoria = "Seleccione una categoría";
  if (normalizeText(formData.descripcion).length < 10)
    errors.descripcion = "La descripción debe tener al menos 10 caracteres";
  if (normalizeText(formData.prompt).length < 30)
    errors.prompt = "El prompt debe tener al menos 30 caracteres";
  return errors;
};

// ============================================================
// ESTILOS
// ============================================================
const INPUT_BASE =
  "w-full px-3 py-2 rounded-lg border text-sm " +
  "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 " +
  "focus:outline-none focus:ring-2 focus:ring-primary-500/40 ";

const INPUT_OK    = "border-gray-300 dark:border-gray-600 ";
const INPUT_ERROR = "border-red-500 dark:border-red-400 ";

const LABEL = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
const ERR   = "mt-1 text-xs text-red-500";

const SECTION_HEADER = "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3";

// ============================================================
// SUB-COMPONENTES
// ============================================================

const Field = ({ label, required, error, children }) => (
  <div>
    <label className={LABEL}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className={ERR}>{error}</p>}
  </div>
);

const ReadonlyValue = ({ value }) => (
  <div className="text-sm text-gray-700 dark:text-gray-300 py-1">
    {value || <span className="italic text-gray-400">Sin información</span>}
  </div>
);

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

const ProfilesCatalogModal = ({
  mode       = PROFILE_MODAL_MODES.CREATE,
  profile,
  categories = [],   // Array<{ id: number, name: string }> del backend
  onSubmit,
  onClose,
}) => {
  const isCreate = mode === PROFILE_MODAL_MODES.CREATE;
  const isView   = mode === PROFILE_MODAL_MODES.VIEW;
  const isEdit   = mode === PROFILE_MODAL_MODES.EDIT;
  const canEdit  = isCreate || isEdit;

  const initial = useMemo(() => normalizeProfile(profile || {}), [profile]);

  const [formData,    setFormData]    = useState(initial);
  const [errors,      setErrors]      = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab,   setActiveTab]   = useState("info"); // "info" | "prompt"

  // Opciones del select — objetos {id, name} del backend
  const categoryOptions = useMemo(
    () => (Array.isArray(categories) ? categories : []).filter((c) => c?.name),
    [categories]
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    if (!canEdit) return;
    const errs = validate(formData, isCreate);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
    } catch (err) {
      // El llamador maneja el toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const statusLabel = formData.status ? "Activo" : "Inactivo";

  return (
    <div className="flex flex-col gap-0 min-w-0">

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-5">
        {[
          { key: "info",   label: "Información",   icon: "FaInfoCircle" },
          { key: "prompt", label: "Prompt AI",      icon: "FaCode"       },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Icon name={tab.icon} className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Información ── */}
      {activeTab === "info" && (
        <div className="space-y-4 px-1">
          <p className={SECTION_HEADER}>Datos generales</p>

          {/* Nombre */}
          <Field label="Nombre" required error={errors.nombre}>
            {isView ? (
              <ReadonlyValue value={formData.nombre} />
            ) : (
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleChange("nombre", e.target.value)}
                placeholder="Ej: Análisis de Infraestructura"
                className={`${INPUT_BASE} ${errors.nombre ? INPUT_ERROR : INPUT_OK}`}
              />
            )}
          </Field>

          {/* Categoría */}
          <Field label="Categoría" required error={errors.categoria}>
            {isView ? (
              <ReadonlyValue value={formData.categoria} />
            ) : (
              <select
                value={formData.categoria}
                onChange={(e) => handleChange("categoria", e.target.value)}
                className={`${INPUT_BASE} ${errors.categoria ? INPUT_ERROR : INPUT_OK}`}
              >
                <option value="" disabled>Seleccione una categoría</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Estado */}
          <Field label="Estado" required>
            {isView ? (
              <ReadonlyValue value={statusLabel} />
            ) : (
              <select
                value={formData.status ? "activo" : "inactivo"}
                onChange={(e) => handleChange("status", e.target.value === "activo")}
                className={`${INPUT_BASE} ${INPUT_OK}`}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            )}
          </Field>

          {/* Descripción */}
          <Field label="Descripción" required error={errors.descripcion}>
            {isView ? (
              <ReadonlyValue value={formData.descripcion} />
            ) : (
              <textarea
                value={formData.descripcion}
                onChange={(e) => handleChange("descripcion", e.target.value)}
                rows={3}
                placeholder="Describe el alcance y propósito del perfil..."
                className={`${INPUT_BASE} resize-none ${errors.descripcion ? INPUT_ERROR : INPUT_OK}`}
              />
            )}
          </Field>
        </div>
      )}

      {/* ── TAB: Prompt ── */}
      {activeTab === "prompt" && (
        <div className="space-y-4 px-1">
          <p className={SECTION_HEADER}>Prompt para análisis AI</p>

          <Field label="Prompt" required error={errors.prompt}>
            {isView ? (
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 font-mono max-h-72 overflow-y-auto">
                {formData.prompt || "Sin prompt configurado"}
              </pre>
            ) : (
              <textarea
                value={formData.prompt}
                onChange={(e) => handleChange("prompt", e.target.value)}
                rows={10}
                placeholder="Escribe el prompt que usará la IA para analizar las minutas con este perfil..."
                className={`${INPUT_BASE} resize-y font-mono text-xs ${errors.prompt ? INPUT_ERROR : INPUT_OK}`}
              />
            )}
          </Field>

          {!isView && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              El prompt define cómo la IA interpretará y resumirá el contenido de la minuta.
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      {canEdit && (
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting && <Icon name="FaSpinner" className="w-3.5 h-3.5 animate-spin" />}
            {isCreate ? "Crear Perfil" : "Guardar Cambios"}
          </button>
        </div>
      )}

      {isView && (
        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilesCatalogModal;