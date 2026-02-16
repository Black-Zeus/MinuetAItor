/**
 * ProjectModal.jsx
 * Wizard consistente con ClientModal / NewMinuteForm (paso a paso + confirmación)
 *
 * mode:
 * - "createNewProject"  (sin data)
 * - "viewDetailProject" (requiere data JSON)
 * - "editCurrentProject" (requiere data JSON)
 *
 * onSubmit(payload) => payload normalizado:
 * {
 *   id,
 *   projectName,
 *   projectDescription,
 *   projectStatus,
 *   projectTags,
 *   clientId,
 *   clientName,
 *   isConfidential
 * }
 *
 * Nota arquitectura:
 * - Este modal NO asume origen de datos. Recibe `data` (proyecto) y `clients` (catálogo) por props.
 * - Fallback local: JSONs estáticos (para dev). En producción: reemplazar `clients` por service.
 */

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";

// Fallback local (dev). En producción, preferir props `clients` desde service.
import clientsData from "@/data/dataClientes.json";

const MODES = {
  CREATE: "createNewProject",
  VIEW: "viewDetailProject",
  EDIT: "editCurrentProject",
};

const normalizeProject = (data = {}) => ({
  // Identidad
  id: data.id ?? data.projectId ?? "",

  // Proyecto
  projectName: data.projectName ?? data.name ?? "",
  projectDescription: data.projectDescription ?? data.description ?? "",
  projectStatus: data.projectStatus ?? data.status ?? "activo",
  projectTags: data.projectTags ?? data.tags ?? "",

  // Cliente
  clientId: (data.clientId ?? data.client?.id ?? "")?.toString?.() ?? "",
  clientName: data.clientName ?? data.client ?? data.client?.name ?? "",

  // Gobernanza (opcional / futuro)
  isConfidential: Boolean(data.isConfidential ?? data.confidential ?? false),

  // Métricas / solo lectura
  minutas: Number.isFinite(Number(data.minutas)) ? Number(data.minutas) : 0,
  createdAt: data.createdAt ?? "",
});

const ProjectModal = ({ mode, data, clients, onSubmit, onClose }) => {
  const isCreate = mode === MODES.CREATE;
  const isView = mode === MODES.VIEW;
  const isEdit = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeProject(data), [data]);

  const [formData, setFormData] = useState(() =>
    isCreate ? normalizeProject({}) : initial
  );
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  // Wizard steps (mismo patrón)
  const steps = [
    { title: "Proyecto", number: 1 },
    { title: "Cliente", number: 2 },
    { title: "Notas", number: 3 },
    { title: "Confirmación", number: 4 },
  ];

  const closeModal = () => {
    // 1) callback del padre
    try {
      onClose?.();
    } catch (_) {}

    // 2) fallback robusto
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

  // Fuente de clientes: props -> fallback JSON local
  const clientCatalog = useMemo(() => {
    const raw = Array.isArray(clients) ? clients : clientsData?.clients || [];
    return raw
      .map((c) => ({
        id: (c.id ?? "").toString(),
        company: c.company ?? c.companyName ?? c.name ?? "",
        contactName: c.name ?? c.contactName ?? "",
        email: c.email ?? c.companyEmail ?? "",
        isConfidential: Boolean(c.isConfidential ?? c.confidential ?? false),
      }))
      .filter((c) => c.id && c.company);
  }, [clients]);

  const clientOptions = useMemo(() => {
    return clientCatalog
      .slice()
      .sort((a, b) => a.company.localeCompare(b.company))
      .map((c) => ({
        value: c.id,
        label: c.company,
      }));
  }, [clientCatalog]);

  const selectedClient = useMemo(() => {
    if (!formData.clientId) return null;
    return clientCatalog.find((c) => c.id === String(formData.clientId)) || null;
  }, [clientCatalog, formData.clientId]);

  const tagsPreview = useMemo(() => {
    return (formData.projectTags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [formData.projectTags]);

  // Validación por paso (idéntico enfoque)
  const validateStep = (step) => {
    const newErrors = {};

    if (isView) {
      setErrors({});
      return true;
    }

    switch (step) {
      case 0: // Proyecto
        if (!formData.projectName.trim())
          newErrors.projectName = "Nombre del proyecto es requerido";
        break;

      case 1: // Cliente
        if (!String(formData.clientId || "").trim())
          newErrors.clientId = "Debe seleccionar un cliente";
        break;

      // case 2 (Notas) sin obligatorios
      // case 3 (Confirmación) sin obligatorios
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (isView) return;

    const payload = {
      id: formData.id || undefined,
      projectName: formData.projectName?.trim() || "",
      projectDescription: formData.projectDescription?.trim() || "",
      projectStatus: formData.projectStatus || "activo",
      projectTags: formData.projectTags || "",

      clientId: String(formData.clientId || "").trim(),
      clientName: selectedClient?.company || formData.clientName || "",

      isConfidential: Boolean(formData.isConfidential),
    };

    onSubmit?.(payload);
  };

  // Helpers UI para confirmación
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

  return (
    <div className="flex flex-col w-full h-[600px]">
      {/* Header con indicador de pasos (MISMO markup/estilo) */}
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
                    idx < currentStep
                      ? "bg-green-600"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="FaFolderOpen" className="w-5 h-5" />
            {isCreate && `Crear Proyecto — ${steps[currentStep].title}`}
            {isEdit && `Editar Proyecto — ${steps[currentStep].title}`}
            {isView && `Detalles del Proyecto — ${steps[currentStep].title}`}
          </h3>

          {formData.isConfidential && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Confidencial
            </span>
          )}
        </div>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {/* Paso 0: Proyecto */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingrese la información base del proyecto.
            </p>

            {/* Confidencial (opcional) */}
            {!isView && (
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isConfidential}
                    onChange={(e) =>
                      handleChange("isConfidential", e.target.checked)
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Proyecto Confidencial
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Aplica restricciones de visibilidad/roles en módulos
                      posteriores.
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Nombre del proyecto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del Proyecto <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.projectName || (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Sin información
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => handleChange("projectName", e.target.value)}
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${
                        errors.projectName
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.projectName && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.projectName}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción (opcional)
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {formData.projectDescription?.trim() ? (
                    formData.projectDescription
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Sin información
                    </span>
                  )}
                </div>
              ) : (
                <textarea
                  value={formData.projectDescription}
                  onChange={(e) =>
                    handleChange("projectDescription", e.target.value)
                  }
                  rows={5}
                  className="
                    w-full px-3 py-2 border rounded-lg
                    bg-white dark:bg-gray-800
                    text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    resize-none
                  "
                />
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
                    {formData.projectStatus === "inactivo"
                      ? "Inactivo"
                      : "Activo"}
                  </div>
                ) : (
                  <select
                    value={formData.projectStatus}
                    onChange={(e) =>
                      handleChange("projectStatus", e.target.value)
                    }
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

              {/* Métrica: minutas (solo lectura) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minutas (solo lectura)
                </label>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Number.isFinite(Number(formData.minutas))
                    ? formData.minutas
                    : 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paso 1: Cliente */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Seleccione el cliente asociado al proyecto.
            </p>

            {/* Cliente (select por clientId) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.clientName || selectedClient?.company || (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Sin información
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <select
                    value={formData.clientId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const c =
                        clientCatalog.find((x) => x.id === String(id)) || null;

                      handleChange("clientId", id);
                      handleChange("clientName", c?.company || "");
                      // Si el cliente viene marcado como confidencial, puedes propagarlo (opcional)
                      // handleChange("isConfidential", Boolean(c?.isConfidential));
                    }}
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${
                        errors.clientId
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      }
                      focus:outline-none focus:ring-2
                    `}
                  >
                    <option value="">Seleccione un cliente...</option>
                    {clientOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {errors.clientId && (
                    <p className="mt-1 text-sm text-red-500">{errors.clientId}</p>
                  )}
                </>
              )}
            </div>

            {/* Resumen del cliente seleccionado (view + edit/create) */}
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="FaBuilding" className="w-4 h-4 text-gray-500" />
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Detalle Cliente
                </div>
              </div>

              {selectedClient ? (
                <div className="space-y-2 text-sm">
                  <FieldRow label="Empresa" value={selectedClient.company} />
                  <FieldRow label="Contacto" value={selectedClient.contactName} />
                  <FieldRow label="Email" value={selectedClient.email} />
                </div>
              ) : (
                <div className="text-sm italic text-gray-500 dark:text-gray-500">
                  Seleccione un cliente para visualizar el detalle.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Notas */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Agregue etiquetas para facilitar el filtrado. (Notas extendidas pueden
              incorporarse cuando exista backend/service).
            </p>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Etiquetas (opcional)
              </label>

              {isView ? (
                <>
                  {tagsPreview.length ? (
                    <div className="flex flex-wrap gap-2">
                      {tagsPreview.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm italic text-gray-500 dark:text-gray-500">
                      Sin etiquetas
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.projectTags}
                    onChange={(e) =>
                      handleChange("projectTags", e.target.value)
                    }
                    placeholder="Ej: Web, CMS, Backend (separadas por coma)"
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />

                  {tagsPreview.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tagsPreview.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Metadatos (solo lectura) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ID Proyecto
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200 break-words">
                  {formData.id || (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Se asignará al guardar (backend)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Creación
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200 break-words">
                  {formData.createdAt || (
                    <span className="italic text-gray-500 dark:text-gray-500">
                      Se asignará al guardar (backend)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3: Confirmación */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Revise la información antes de{" "}
              {isCreate ? "crear" : isEdit ? "guardar" : "cerrar"} el proyecto.
            </p>

            <div className="space-y-6">
              {/* 1: Proyecto */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">
                    1
                  </span>
                  Proyecto
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow label="Nombre" value={formData.projectName} />
                  <FieldRow
                    label="Descripción"
                    value={formData.projectDescription}
                  />
                  <FieldRow
                    label="Estado"
                    value={formData.projectStatus === "inactivo" ? "Inactivo" : "Activo"}
                  />
                  <FieldRow label="Confidencial" value={formData.isConfidential ? "Sí" : "No"} />
                  <FieldRow label="Minutas" value={String(formData.minutas ?? 0)} />
                </div>
              </div>

              {/* 2: Cliente */}
              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs mr-2">
                    2
                  </span>
                  Cliente
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow
                    label="Empresa"
                    value={selectedClient?.company || formData.clientName}
                  />
                  <FieldRow label="Client ID" value={formData.clientId} />
                  <FieldRow label="Contacto" value={selectedClient?.contactName} />
                  <FieldRow label="Email" value={selectedClient?.email} />
                </div>
              </div>

              {/* 3: Tags */}
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">
                    3
                  </span>
                  Etiquetas
                </h4>

                <div className="mt-2">
                  {tagsPreview.length ? (
                    <div className="flex flex-wrap gap-2">
                      {tagsPreview.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm italic text-gray-500 dark:text-gray-500">
                      Sin etiquetas
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer con botones (MISMO estilo) */}
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
  );
};

export default ProjectModal;
export { MODES as PROJECT_MODAL_MODES };