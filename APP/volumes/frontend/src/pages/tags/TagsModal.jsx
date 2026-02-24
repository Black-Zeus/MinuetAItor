/**
 * TagsModal.jsx
 * Wizard para Create / Edit / View de Tags
 * Patrón: ProjectModal / ClientModal
 *
 * Cambios respecto a versión anterior:
 *  - handleSubmit: async con await onSubmit(payload) — el padre gestiona el service
 *  - toastSuccess / toastError en lugar de ModalManager.success
 *  - ModalManager.closeAll() al éxito
 *  - Agrega selector de Categoría (requerido para el backend)
 *  - Pasos: Etiqueta (name + category) → Descripción → Confirmación
 *  - formData camelCase:
 *      tagName, tagDescription, tagStatus, categoryId
 */

import React, { useMemo, useState, useEffect } from "react";
import Icon         from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError } from "@/components/common/toast/toastHelpers";

// ─── Modos ────────────────────────────────────────────────────────────────────

export const TAGS_MODAL_MODES = {
  CREATE: "createNewTag",
  VIEW:   "viewDetailTag",
  EDIT:   "editCurrentTag",
};

// ─── Normalizar datos entrantes ───────────────────────────────────────────────

const normalizeTag = (data) => {
  const d = data ?? {};
  return {
    tagName:        d.tagName  ?? d.name        ?? "",
    tagDescription: d.tagDescription ?? d.description ?? "",
    tagStatus:      d.tagStatus ?? d.status     ?? "activo",
    categoryId:     String(d.categoryId ?? d.category_id ?? ""),
  };
};

// ─── Componente ───────────────────────────────────────────────────────────────

const TagsModal = ({ mode, data, categories = [], onSubmit, onClose }) => {
  const isCreate = mode === TAGS_MODAL_MODES.CREATE;
  const isView   = mode === TAGS_MODAL_MODES.VIEW;
  const isEdit   = mode === TAGS_MODAL_MODES.EDIT;

  const initial = useMemo(() => normalizeTag(data), [data]);

  const [formData, setFormData]     = useState(() => isCreate ? normalizeTag(null) : initial);
  const [errors,   setErrors]       = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronizar cuando cambian props
  useEffect(() => {
    setFormData(isCreate ? normalizeTag(null) : normalizeTag(data));
    setErrors({});
    setCurrentStep(0);
  }, [isCreate, data]);

  const steps = [
    { title: "Etiqueta",     number: 1 },
    { title: "Descripción",  number: 2 },
    { title: "Confirmación", number: 3 },
  ];

  const closeModal = () => {
    try { onClose?.(); } catch (_) {}
    try { ModalManager.closeAll?.(); } catch (_) {}
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  // ─── Validación por paso ──────────────────────────────────────────────────

  const validateStep = (step) => {
    if (isView) return true;

    const newErrors = {};

    if (step === 0) {
      if (!formData.tagName.trim())
        newErrors.tagName = "Nombre es obligatorio";
      else if (formData.tagName.trim().length < 2)
        newErrors.tagName = "Nombre debe tener al menos 2 caracteres";

      if (!formData.categoryId)
        newErrors.categoryId = "Categoría es obligatoria";
    }

    if (step === 1) {
      if (!formData.tagDescription.trim())
        newErrors.tagDescription = "Descripción es obligatoria";
      else if (formData.tagDescription.trim().length < 10)
        newErrors.tagDescription = "Descripción debe tener al menos 10 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Navegación ──────────────────────────────────────────────────────────

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
      else handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (isView)       return closeModal();
    if (isSubmitting) return;

    const payload = {
      tagName:        formData.tagName?.trim()        ?? "",
      tagDescription: formData.tagDescription?.trim() ?? "",
      tagStatus:      formData.tagStatus               ?? "activo",
      categoryId:     formData.categoryId,
    };

    setIsSubmitting(true);
    try {
      await onSubmit?.(payload);
      // El padre hace ModalManager.closeAll() + toastSuccess
    } catch (err) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.error  ??
        err?.message                ??
        "Error al guardar el tag";
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Helpers UI ──────────────────────────────────────────────────────────

  const statusLabel =
    formData.tagStatus === "inactivo" ? "Inactivo" : "Activo";

  const categoryName =
    categories.find((c) => String(c.id) === String(formData.categoryId))?.name ?? "—";

  const FieldRow = ({ label, value }) => (
    <div className="flex gap-2">
      <span className="font-medium text-gray-700 dark:text-gray-300 w-36 shrink-0">
        {label}:
      </span>
      <span className="text-gray-600 dark:text-gray-400">
        {String(value ?? "").trim() || (
          <span className="italic text-gray-500">Sin información</span>
        )}
      </span>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-[580px]">

      {/* Header con stepper */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  idx === currentStep
                    ? "bg-blue-600 text-white"
                    : idx < currentStep
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                }`}
              >
                {idx < currentStep ? "✓" : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    idx < currentStep ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="FaTags" className="w-5 h-5" />
            {isCreate && `Crear Tag — ${steps[currentStep].title}`}
            {isEdit   && `Editar Tag — ${steps[currentStep].title}`}
            {isView   && `Detalle Tag — ${steps[currentStep].title}`}
          </h3>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">

        {/* ── Paso 0: Etiqueta ──────────────────────────────────────────── */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Define el nombre del tag y su categoría.
            </p>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.tagName || <span className="italic text-gray-500">Sin información</span>}
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.tagName}
                    onChange={(e) => handleChange("tagName", e.target.value)}
                    placeholder="Ej: Firewall"
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.tagName
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  />
                  {errors.tagName && (
                    <p className="text-red-500 text-xs mt-1">{errors.tagName}</p>
                  )}
                </>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría <span className="text-red-500">*</span>
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{categoryName}</p>
              ) : (
                <>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleChange("categoryId", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.categoryId
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <option value="">— Seleccionar categoría —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="text-red-500 text-xs mt-1">{errors.categoryId}</p>
                  )}
                </>
              )}
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{statusLabel}</p>
              ) : (
                <select
                  value={formData.tagStatus}
                  onChange={(e) => handleChange("tagStatus", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              )}
            </div>
          </div>
        )}

        {/* ── Paso 1: Descripción ───────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Proporciona una descripción clara del propósito de este tag.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción <span className="text-red-500">*</span>
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {formData.tagDescription || (
                    <span className="italic text-gray-500">Sin información</span>
                  )}
                </p>
              ) : (
                <>
                  <textarea
                    value={formData.tagDescription}
                    onChange={(e) => handleChange("tagDescription", e.target.value)}
                    placeholder="Describe el propósito y uso de este tag..."
                    rows={5}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                      errors.tagDescription
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  />
                  {errors.tagDescription && (
                    <p className="text-red-500 text-xs mt-1">{errors.tagDescription}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Paso 2: Confirmación ─────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {isView
                ? "Información completa del tag."
                : "Revisa los datos antes de confirmar."}
            </p>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3 text-sm">
              <FieldRow label="Nombre"      value={formData.tagName} />
              <FieldRow label="Categoría"   value={categoryName} />
              <FieldRow label="Estado"      value={statusLabel} />
              <FieldRow label="Descripción" value={formData.tagDescription} />
            </div>
          </div>
        )}
      </div>

      {/* Footer con botones */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <button
          onClick={closeModal}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {isView ? "Cerrar" : "Cancelar"}
        </button>

        <div className="flex items-center gap-2">
          {currentStep > 0 && !isView && (
            <button
              onClick={handlePrevious}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Anterior
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Siguiente
            </button>
          ) : (
            !isView && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <Icon name="FaSpinner" className="w-3 h-3 animate-spin" />
                )}
                {isSubmitting
                  ? "Guardando..."
                  : isCreate
                  ? "Crear Tag"
                  : "Guardar Cambios"}
              </button>
            )
          )}

          {isView && currentStep === steps.length - 1 && (
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagsModal;