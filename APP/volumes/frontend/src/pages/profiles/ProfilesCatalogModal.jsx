/**
 * ProfilesCatalogModal.jsx
 * Wizard consistente con ProjectModal / ClientModal (paso a paso + confirmación)
 *
 * REQ:
 * - En CREATE/EDIT: SIEMPRE consulta al JSON (estructura: array de objetos) y pobla el combo
 * - Catálogo cerrado: NO se aceptan categorías fuera de las existentes
 *
 * JSON esperado (ejemplo):
 * [
 *   { id, nombre, categoria, status, descripcion, prompt },
 *   ...
 * ]
 */

import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";

// ✅ Este JSON contiene objetos (perfiles) y de ahí derivamos categorías únicas
import profilesCatalogJSON from "@/data/analysisProfilesCatalog.json";

// ============================================================
// MODOS DEL MODAL
// ============================================================
export const PROFILE_MODAL_MODES = {
  CREATE: "create",
  VIEW: "view",
  EDIT: "edit",
};

// ============================================================
// HELPERS
// ============================================================
const normalizeText = (v) => String(v ?? "").trim();

const normalizeBoolean = (v, fallback = true) => {
  if (typeof v === "boolean") return v;
  const s = normalizeText(v).toLowerCase();
  if (s === "activo" || s === "active") return true;
  if (s === "inactivo" || s === "inactive") return false;
  return fallback;
};

const uniqueStrings = (arr) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach((v) => {
    const s = normalizeText(v);
    if (!s) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
};

const normalizeProfile = (data = {}) => ({
  id: data.id ?? "",
  nombre: data.nombre ?? "",
  categoria: data.categoria ?? "",
  descripcion: data.descripcion ?? "",
  prompt: data.prompt ?? "",
  status: normalizeBoolean(data.status, true),
});

const ProfilesCatalogModal = ({
  mode = PROFILE_MODAL_MODES.CREATE,
  profile,
  // opcional (compatibilidad). Si te pasan string[] también lo integraremos
  categories = [],
  onSubmit,
  onClose,
}) => {
  const isCreate = mode === PROFILE_MODAL_MODES.CREATE;
  const isView = mode === PROFILE_MODAL_MODES.VIEW;
  const isEdit = mode === PROFILE_MODAL_MODES.EDIT;

  const initial = useMemo(() => normalizeProfile(profile || {}), [profile]);

  // ============================================================
  // CATEGORÍAS (FUENTE DE VERDAD: JSON DE OBJETOS)
  // - Deriva categorías desde `item.categoria`
  // - Por defecto filtra status:true (cámbialo si quieres incluir inactivos)
  // - Fusiona con prop categories (fallback) si viene algo
  // ============================================================
  const categoryOptions = useMemo(() => {
    const src = Array.isArray(profilesCatalogJSON) ? profilesCatalogJSON : [];

    // si quieres incluir categorías de perfiles inactivos, elimina este filtro
    const activeOnly = src.filter((x) => x?.status === true);

    const fromJson = activeOnly.map((x) => x?.categoria);
    const fromProps = Array.isArray(categories) ? categories : [];

    return uniqueStrings([...fromJson, ...fromProps]).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  // ============================================================
  // STATE
  // ============================================================
  const [formData, setFormData] = useState(() => (isCreate ? normalizeProfile({}) : initial));
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  // ✅ Si cambia profile (EDIT/VIEW), sincroniza formData
  useEffect(() => {
    if (isCreate) return;
    setFormData(initial);
    setErrors({});
    setCurrentStep(0);
  }, [initial, isCreate]);

  // ✅ En CREATE: setear categoría por defecto si no existe (y hay catálogo)
  useEffect(() => {
    if (!isCreate) return;
    if (normalizeText(formData.categoria)) return;
    if (categoryOptions.length === 0) return;
    setFormData((prev) => ({ ...prev, categoria: categoryOptions[0] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate, categoryOptions]);

  const steps = [
    { title: "Perfil", number: 1 },
    { title: "Descripción", number: 2 },
    { title: "Prompt", number: 3 },
    { title: "Confirmación", number: 4 },
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

    // catálogo cerrado obligatorio en CREATE/EDIT
    if ((isCreate || isEdit) && categoryOptions.length === 0) {
      newErrors.categoria =
        "No hay categorías disponibles en el catálogo (JSON). Verifique analysisProfilesCategories.json.";
      setErrors(newErrors);
      return false;
    }

    switch (step) {
      case 0: {
        if (!normalizeText(formData.nombre)) newErrors.nombre = "El nombre es obligatorio";

        const cat = normalizeText(formData.categoria);
        if (!cat) newErrors.categoria = "La categoría es obligatoria";
        else if ((isCreate || isEdit) && !categoryOptions.includes(cat)) {
          newErrors.categoria = "La categoría debe ser una de las existentes";
        }
        break;
      }

      case 1:
        if (!normalizeText(formData.descripcion)) newErrors.descripcion = "La descripción es obligatoria";
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
    if (isView) return;

    const payload = {
      id: normalizeText(formData.id) ? normalizeText(formData.id) : undefined,
      nombre: normalizeText(formData.nombre),
      categoria: normalizeText(formData.categoria),
      descripcion: normalizeText(formData.descripcion),
      prompt: normalizeText(formData.prompt),
      status: Boolean(formData.status),
    };

    // defensivo: catálogo cerrado
    if ((isCreate || isEdit) && categoryOptions.length > 0 && !categoryOptions.includes(payload.categoria)) {
      setErrors((prev) => ({ ...prev, categoria: "La categoría debe ser una de las existentes" }));
      setCurrentStep(0);
      return;
    }

    onSubmit?.(payload);
  };

  const FieldRow = ({ label, value, mono = false }) => {
    const v = (value ?? "").toString().trim();
    return (
      <div className="flex gap-3">
        <span className="font-medium text-gray-700 dark:text-gray-300 w-40 shrink-0">{label}:</span>
        <span className={`text-gray-600 dark:text-gray-400 break-words whitespace-pre-line ${mono ? "font-mono" : ""}`}>
          {v || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
        </span>
      </div>
    );
  };

  const titlePrefix = isCreate ? "Crear Perfil" : isEdit ? "Editar Perfil" : "Detalles del Perfil";
  const statusLabel = formData.status === false ? "Inactivo" : "Activo";

  return (
    <div className="flex flex-col w-full h-[600px]">
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
                <div className={`w-12 h-1 mx-2 ${idx < currentStep ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="FaBrain" className="w-5 h-5" />
            {titlePrefix} — {steps[currentStep].title}
          </h3>

          <span
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              formData.status === false
                ? "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200"
                : "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200"
            }`}
            title={`Estado: ${statusLabel}`}
          >
            <Icon name={formData.status === false ? "ban" : "checkCircle"} />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {/* Paso 0: Perfil */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Ingrese la información base del perfil.</p>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {normalizeText(formData.nombre) || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => handleChange("nombre", e.target.value)}
                    placeholder="Ej: Análisis de Redes"
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${
                        errors.nombre
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.nombre && <p className="mt-1 text-sm text-red-500">{errors.nombre}</p>}
                </>
              )}
            </div>

            {/* Categoría (select cerrado desde JSON de objetos) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {normalizeText(formData.categoria) || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <>
                  <select
                    value={formData.categoria}
                    onChange={(e) => handleChange("categoria", e.target.value)}
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${
                        errors.categoria
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2
                    `}
                  >
                    <option value="" disabled>
                      Seleccione una categoría
                    </option>

                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {errors.categoria && <p className="mt-1 text-sm text-red-500">{errors.categoria}</p>}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Catálogo cerrado: categorías derivadas desde JSON (campo <span className="font-mono">categoria</span>).
                  </p>
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
                  <div className="text-sm text-gray-600 dark:text-gray-400">{statusLabel}</div>
                ) : (
                  <select
                    value={formData.status ? "activo" : "inactivo"}
                    onChange={(e) => handleChange("status", e.target.value === "activo")}
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Paso 1: Descripción */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Defina el enfoque y alcance del perfil.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {normalizeText(formData.descripcion) ? (
                    formData.descripcion
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => handleChange("descripcion", e.target.value)}
                    rows={8}
                    placeholder="Enfocado en decisiones y acciones técnicas sobre..."
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      resize-none
                      ${
                        errors.descripcion
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.descripcion && <p className="mt-1 text-sm text-red-500">{errors.descripcion}</p>}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    {String(formData.descripcion || "").length} caracteres
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Prompt */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure instrucciones específicas (opcional) para análisis AI.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prompt (opcional)
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line font-mono">
                  {normalizeText(formData.prompt) ? (
                    formData.prompt
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-500">Sin prompt</span>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={formData.prompt}
                    onChange={(e) => handleChange("prompt", e.target.value)}
                    rows={12}
                    placeholder="Analiza la minuta con enfoque de..."
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      resize-none font-mono
                    "
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    {String(formData.prompt || "").length} caracteres
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Paso 3: Confirmación */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Revise la información antes de {isCreate ? "crear" : isEdit ? "guardar" : "cerrar"} el perfil.
            </p>

            <div className="space-y-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">
                    1
                  </span>
                  Perfil
                </h4>
                <div className="space-y-2 text-sm">
                  {!isCreate && <FieldRow label="ID" value={formData.id} mono />}
                  <FieldRow label="Nombre" value={formData.nombre} />
                  <FieldRow label="Categoría" value={formData.categoria} />
                  <FieldRow label="Estado" value={statusLabel} />
                </div>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs mr-2">
                    2
                  </span>
                  Descripción
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow label="Descripción" value={formData.descripcion} />
                </div>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">
                    3
                  </span>
                  Prompt
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow label="Prompt" value={normalizeText(formData.prompt) ? formData.prompt : "Sin prompt"} mono />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between">
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
            {currentStep === 0 ? (isView ? "Cerrar" : "Cancelar") : "Anterior"}
          </button>

          <button
            type="button"
            onClick={isView && currentStep === steps.length - 1 ? closeModal : handleNext}
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
            {currentStep === steps.length - 1 ? (isView ? "Cerrar" : isCreate ? "Crear" : "Guardar") : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilesCatalogModal;