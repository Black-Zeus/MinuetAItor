/**
 * TagsModal.jsx
 * Wizard consistente con ProjectModal / ClientModal / NewMinuteForm
 *
 * mode:
 * - "createNewTag"   (sin data)
 * - "viewDetailTag"  (requiere data JSON)
 * - "editCurrentTag" (requiere data JSON)
 *
 * onSubmit(payload) => payload normalizado:
 * {
 *   id,          // opcional
 *   tagName,
 *   tagDescription,
 *   tagStatus    // "active" | "inactive"
 * }
 *
 * Nota:
 * - Este modal no asume storage. Recibe `data` (tag) por props.
 * - Cierre robusto: onClose + fallbacks ModalManager.
 */

import React, { useMemo, useState, useEffect } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";

const MODES = {
  CREATE: "createNewTag",
  VIEW: "viewDetailTag",
  EDIT: "editCurrentTag",
};

// ✅ FIX: tolera null/undefined y evita crash al leer propiedades
const normalizeTag = (data) => {
  const d = data ?? {};
  return {
    id: d.id ?? d.tagId ?? d.name ?? "",
    tagName: d.tagName ?? d.name ?? "",
    tagDescription: d.tagDescription ?? d.description ?? "",
    tagStatus: d.tagStatus ?? d.status ?? "active",
  };
};

const TagsModal = ({ mode, data, onSubmit, onClose, onDelete }) => {
  const isCreate = mode === MODES.CREATE;
  const isView = mode === MODES.VIEW;
  const isEdit = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeTag(data), [data]);

  const [formData, setFormData] = useState(() =>
    isCreate ? normalizeTag(null) : initial
  );
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  // ✅ FIX recomendado: sincroniza el estado cuando cambie data/mode (evita estado “pegado”)
  useEffect(() => {
    const next = isCreate ? normalizeTag(null) : normalizeTag(data);
    setFormData(next);
    setErrors({});
    setCurrentStep(0);
  }, [isCreate, data]);

  const steps = [
    { title: "Etiqueta", number: 1 },
    { title: "Contenido", number: 2 },
    { title: "Confirmación", number: 3 },
  ];

  const closeModal = () => {
    try {
      onClose?.();
    } catch (_) {}

    try {
      ModalManager.hide?.();
    } catch (_) {}
    try {
      ModalManager.close?.();
    } catch (_) {}
    try {
      ModalManager.dismiss?.();
    } catch (_) {}
    try {
      ModalManager.closeAll?.();
    } catch (_) {}
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (isView) {
      setErrors({});
      return true;
    }

    switch (step) {
      case 0: // Etiqueta
        if (!formData.tagName.trim()) newErrors.tagName = "Nombre es obligatorio";
        else if (formData.tagName.trim().length < 2)
          newErrors.tagName = "Nombre debe tener al menos 2 caracteres";
        break;

      case 1: // Contenido
        if (!formData.tagDescription.trim())
          newErrors.tagDescription = "Descripción es obligatoria";
        else if (formData.tagDescription.trim().length < 20)
          newErrors.tagDescription =
            "Descripción debe tener al menos 20 caracteres (glosa útil)";
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
      else handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleSubmit = () => {
    if (isView) return closeModal();

    const payload = {
      id: formData.id || undefined,
      tagName: formData.tagName?.trim() || "",
      tagDescription: formData.tagDescription?.trim() || "",
      tagStatus: formData.tagStatus || "active",
    };

    onSubmit?.(payload);
  };

  const handleDelete = async () => {
    if (!data) return;

    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar el tag "${formData.tagName}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (confirmed) onDelete?.(data);
    } catch (_) {
      // cancelado
    }
  };

  const FieldRow = ({ label, value }) => {
    const v = (value ?? "").toString().trim();
    return (
      <div className="flex">
        <span className="font-medium text-gray-700 dark:text-gray-300 w-40">
          {label}:
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {v || (
            <span className="italic text-gray-500 dark:text-gray-500">
              Sin información
            </span>
          )}
        </span>
      </div>
    );
  };

  const statusLabel = formData.tagStatus === "inactive" ? "Inactivo" : "Activo";

  return (
    <div className="flex flex-col w-full h-[560px]">
      {/* Header con indicador de pasos */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                  ${
                    idx === currentStep
                      ? "bg-blue-600 text-white"
                      : idx < currentStep
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  }
                `}
              >
                {idx < currentStep ? "✓" : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-12 h-1 mx-2 ${
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
            {isEdit && `Editar Tag — ${steps[currentStep].title}`}
            {isView && `Detalle Tag — ${steps[currentStep].title}`}
          </h3>

          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {/* Paso 0: Etiqueta */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Defina el nombre del tag y su estado operativo.
            </p>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.tagName || (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Sin información
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.tagName}
                    onChange={(e) => handleChange("tagName", e.target.value)}
                    placeholder="Ej: Firewall"
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${
                        errors.tagName
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.tagName && (
                    <p className="mt-1 text-sm text-red-500">{errors.tagName}</p>
                  )}
                </>
              )}
            </div>

            {/* Estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estado <span className="text-red-500">*</span>
                </label>

                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {statusLabel}
                  </div>
                ) : (
                  <select
                    value={formData.tagStatus}
                    onChange={(e) => handleChange("tagStatus", e.target.value)}
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                )}
              </div>

              {/* Campo auxiliar (solo lectura / UX) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Clave (referencia)
                </label>
                <div className="text-sm text-gray-600 dark:text-gray-400 break-words">
                  {formData.id ? (
                    formData.id
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Se asignará al guardar (backend)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paso 1: Contenido */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Describa el alcance del tag. Esta glosa se usa para clasificación y análisis.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción (glosa) <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {formData.tagDescription?.trim() ? (
                    formData.tagDescription
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Sin información
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={formData.tagDescription}
                    onChange={(e) => handleChange("tagDescription", e.target.value)}
                    rows={6}
                    placeholder="Breve descripción del alcance del tag..."
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${
                        errors.tagDescription
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2 resize-none
                    `}
                  />
                  {errors.tagDescription && (
                    <p className="mt-1 text-sm text-red-500">{errors.tagDescription}</p>
                  )}
                </>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Recomendado: 80–140 caracteres, descriptivo y operativo.
              </p>
            </div>
          </div>
        )}

        {/* Paso 2: Confirmación */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Revise la información antes de{" "}
              {isCreate ? "crear" : isEdit ? "guardar" : "cerrar"} el tag.
            </p>

            <div className="space-y-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">
                    1
                  </span>
                  Etiqueta
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow label="Nombre" value={formData.tagName} />
                  <FieldRow label="Estado" value={statusLabel} />
                  <FieldRow label="ID" value={formData.id} />
                </div>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">
                    2
                  </span>
                  Glosa
                </h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {formData.tagDescription?.trim() ? (
                    formData.tagDescription
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Sin información
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer con botones */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          {/* Izquierda: eliminar */}
          <div>
            {!isCreate && (
              <button
                type="button"
                onClick={handleDelete}
                className="
                  px-4 py-2 text-sm font-medium
                  text-white
                  bg-red-600
                  rounded-lg
                  hover:bg-red-700
                  focus:outline-none focus:ring-2 focus:ring-red-500
                  transition-colors
                "
              >
                Eliminar
              </button>
            )}
          </div>

          {/* Derecha: navegación */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={currentStep === 0 ? closeModal : handlePrevious}
              className="
                px-4 py-2 text-sm font-medium
                text-gray-700 dark:text-gray-300
                bg-white dark:bg-gray-800
                border border-gray-300 dark:border-gray-600
                rounded-lg
                hover:bg-gray-50 dark:hover:bg-gray-700
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
            >
              {currentStep === 0 ? "Cancelar" : "Anterior"}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="
                px-4 py-2 text-sm font-medium
                text-white
                bg-blue-600
                rounded-lg
                hover:bg-blue-700
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
            >
              {currentStep === steps.length - 1
                ? isView
                  ? "Cerrar"
                  : isCreate
                  ? "Crear"
                  : "Guardar"
                : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagsModal;
export { MODES as TAGS_MODAL_MODES };