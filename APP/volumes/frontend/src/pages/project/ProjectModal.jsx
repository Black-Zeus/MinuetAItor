/**
 * ProjectModal.jsx
 * Wizard consistente con ClientModal (paso a paso + confirmación)
 *
 * mode:
 * - "createNewProject"  (sin data)
 * - "viewDetailProject" (requiere data)
 * - "editCurrentProject" (requiere data)
 *
 * onSubmit(payload):
 * {
 *   id, projectName, projectDescription, projectStatus,
 *   projectTags, clientId, clientName, isConfidential
 * }
 *
 * Clientes: se cargan desde clientService.list() al montar el modal.
 * Ya no depende de ningún JSON estático.
 */

import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";
import clientService from "@/services/clientService";

import logger from "@/utils/logger";
const modalLog = logger.scope("projectModal");

const cn = (...classes) => classes.filter(Boolean).join(" ");

// ─── Modos ───────────────────────────────────────────────────────────────────

const MODES = {
  CREATE: "createNewProject",
  VIEW:   "viewDetailProject",
  EDIT:   "editCurrentProject",
};

// ─── Normalizar datos del proyecto ────────────────────────────────────────────

const normalizeProject = (data = {}) => ({
  id:                 data.id ?? data.projectId ?? "",
  projectName:        data.projectName        ?? data.name        ?? "",
  projectDescription: data.projectDescription ?? data.description ?? "",
  projectStatus:      data.projectStatus      ?? data.status      ?? "activo",
  projectTags:        data.projectTags        ?? data.tags        ?? "",
  projectCode:        data.projectCode        ?? data.code        ?? "",
  clientId:           (data.clientId ?? data.client?.id ?? "")?.toString?.() ?? "",
  clientName:         data.clientName ?? data.client ?? data.client?.name ?? "",
  isConfidential:     Boolean(data.isConfidential ?? data.is_confidential ?? data.confidential ?? false),
  autoSendOnPreview:  Boolean(data.autoSendOnPreview ?? data.auto_send_on_preview ?? false),
  autoSendOnCompleted:Boolean(data.autoSendOnCompleted ?? data.auto_send_on_completed ?? false),
  minutas:            Number.isFinite(Number(data.minutas)) ? Number(data.minutas) : 0,
  createdAt:          data.createdAt ?? "",
});

// ─── Componente ───────────────────────────────────────────────────────────────

const ProjectModal = ({ mode, data, onSubmit, onClose }) => {
  const isCreate = mode === MODES.CREATE;
  const isView   = mode === MODES.VIEW;
  const isEdit   = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeProject(data), [data]);

  const [formData,     setFormData]     = useState(() => isCreate ? normalizeProject({}) : initial);
  const [errors,       setErrors]       = useState({});
  const [currentStep,  setCurrentStep]  = useState(0);

  // Catálogo de clientes cargado desde API
  const [clientCatalog,    setClientCatalog]    = useState([]);
  const [loadingClients,   setLoadingClients]   = useState(false);

  // ─── Carga de clientes desde API ─────────────────────────────────────────

  useEffect(() => {
    // En modo VIEW no necesitamos el catálogo para seleccionar,
    // pero lo cargamos igual por si quiere mostrarse el nombre
    let cancelled = false;

    const load = async () => {
      setLoadingClients(true);
      try {
        const result = await clientService.list({ isActive: true, limit: 200 });
        if (!cancelled) setClientCatalog(result.items ?? []);
      } catch (err) {
        modalLog.error("[ProjectModal] Error cargando clientes:", err);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Steps ───────────────────────────────────────────────────────────────

  const steps = [
    { title: "Proyecto",     number: 1 },
    { title: "Cliente",      number: 2 },
    { title: "Notas",        number: 3 },
    { title: "Confirmación", number: 4 },
  ];

  // ─── Cierre modal ─────────────────────────────────────────────────────────

  const closeModal = () => {
    try { onClose?.();           } catch (_) {}
    try { ModalManager.closeAll?.(); } catch (_) {}
  };

  // ─── Cambio de campo ──────────────────────────────────────────────────────

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  // ─── Derivados ───────────────────────────────────────────────────────────

  // Opciones para el <select> de clientes, normalizadas
  const clientOptions = useMemo(() => {
    return clientCatalog
      .map((c) => ({
        id:      String(c.id ?? ""),
        company: c.name ?? c.companyName ?? c.company ?? "",
        isConfidential: Boolean(c.isConfidential ?? c.is_confidential ?? false),
      }))
      .filter((c) => c.id && c.company)
      .sort((a, b) => a.company.localeCompare(b.company, "es"));
  }, [clientCatalog]);

  const selectedClient = useMemo(() => {
    if (!formData.clientId) return null;
    return clientOptions.find((c) => c.id === String(formData.clientId)) || null;
  }, [clientOptions, formData.clientId]);

  const tagsPreview = useMemo(() => {
    return (formData.projectTags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [formData.projectTags]);

  // ─── Validación por paso ──────────────────────────────────────────────────

  const validateStep = (step) => {
    const newErrors = {};
    if (isView) { setErrors({}); return true; }

    switch (step) {
      case 0:
        if (!formData.projectName.trim())
          newErrors.projectName = "Nombre del proyecto es requerido";
        break;
      case 1:
        if (!String(formData.clientId || "").trim())
          newErrors.clientId = "Debe seleccionar un cliente";
        break;
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
      else handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (isView) { closeModal(); return; }

    try {
      await onSubmit?.({
        id:                 formData.id || undefined,
        projectName:        formData.projectName?.trim()        || "",
        projectDescription: formData.projectDescription?.trim() || "",
        projectStatus:      formData.projectStatus              || "activo",
        projectCode:        formData.projectCode?.trim()        || "",
        projectTags:        formData.projectTags                || "",
        clientId:           String(formData.clientId || "").trim(),
        clientName:         selectedClient?.company || formData.clientName || "",
        isConfidential:     Boolean(formData.isConfidential),
        autoSendOnPreview:  Boolean(formData.autoSendOnPreview),
        autoSendOnCompleted:Boolean(formData.autoSendOnCompleted),
      });

      toastSuccess(
        "Guardado",
        isCreate ? "Proyecto creado correctamente." : "Proyecto actualizado correctamente.",
        { autoClose: 3000 }
      );

      ModalManager.closeAll?.();

    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "No fue posible completar la operación.";

      toastError("Error", msg, { autoClose: 3000 });
    }
  };

  // ─── Helpers UI ───────────────────────────────────────────────────────────

  const FieldRow = ({ label, value }) => {
    const v = (value ?? "").toString().trim();
    return (
      <div className="flex">
        <span className="font-medium text-gray-700 dark:text-gray-300 w-44 flex-shrink-0">
          {label}:
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {v || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
        </span>
      </div>
    );
  };

  const inputCls = (field) => `
    w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors
    bg-white dark:bg-slate-800
    text-gray-900 dark:text-gray-100
    focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800
    ${errors[field]
      ? "border-red-500 dark:border-red-400"
      : "border-gray-300 dark:border-slate-700"}
  `;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full rounded-[26px] bg-white/8 p-[2px] shadow-[0_0_24px_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-[3px] dark:bg-white/[0.06] dark:shadow-[0_0_28px_rgba(255,255,255,0.06),0_24px_70px_rgba(2,6,23,0.52)]">
    <div className="flex h-[78vh] min-h-[620px] w-full flex-col rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">

      {/* ── Stepper ── */}
      <div className="flex-shrink-0 border-b border-slate-200/80 px-8 py-6 dark:border-slate-700/80">
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                ${idx === currentStep  ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900"
                : idx < currentStep   ? "bg-sky-700 text-white dark:bg-sky-300 dark:text-slate-900"
                : "bg-white border border-gray-300 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400"}
              `}>
                {idx < currentStep ? "✓" : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 rounded ${idx < currentStep ? "bg-sky-700 dark:bg-sky-300" : "bg-gray-300 dark:bg-slate-700"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="FaFolderOpen" className="w-5 h-5" />
            {isCreate && `Crear Proyecto — ${steps[currentStep].title}`}
            {isEdit   && `Editar Proyecto — ${steps[currentStep].title}`}
            {isView   && `Detalle del Proyecto — ${steps[currentStep].title}`}
          </h3>
          {formData.isConfidential && (
            <span className="rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-800/80 dark:bg-sky-900/20 dark:text-sky-300 flex items-center gap-1">
              <Icon name="FaLock" className="w-3 h-3" /> Confidencial
            </span>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">

        {/* Paso 0: Proyecto */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingrese la información base del proyecto.
            </p>

            {/* Código — solo visible en EDIT y VIEW, generado por el backend */}
            {(isEdit || isView) && formData.projectCode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código del proyecto
                  <span className="ml-2 text-xs text-gray-400 font-normal">generado automáticamente)</span>
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                  {formData.projectCode}
                </p>
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del proyecto <span className="text-red-500">*</span>
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{formData.projectName || "—"}</p>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => handleChange("projectName", e.target.value)}
                    placeholder="Ej: Implementación ERP Q1 2025"
                    className={inputCls("projectName")}
                  />
                  {errors.projectName && (
                    <p className="mt-1 text-xs text-red-500">{errors.projectName}</p>
                  )}
                </>
              )}
            </div>
            

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{formData.projectDescription || "—"}</p>
              ) : (
                <textarea
                  value={formData.projectDescription}
                  onChange={(e) => handleChange("projectDescription", e.target.value)}
                  placeholder="Breve descripción del proyecto..."
                  rows={3}
                  className={inputCls("projectDescription")}
                />
              )}
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{formData.projectStatus}</p>
              ) : (
                <select
                  value={formData.projectStatus}
                  onChange={(e) => handleChange("projectStatus", e.target.value)}
                  className={inputCls("projectStatus")}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              )}
            </div>

            {/* Confidencial */}
            <div className="flex items-center gap-3 pt-1">
              {isView ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Icon
                    name={formData.isConfidential ? "FaLock" : "FaLockOpen"}
                    className={`w-4 h-4 ${formData.isConfidential ? "text-amber-500" : "text-gray-400"}`}
                  />
                  {formData.isConfidential ? "Proyecto confidencial" : "Proyecto estándar"}
                </div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => handleChange("isConfidential", !formData.isConfidential)}
                    className={`
                      relative w-11 h-6 rounded-full transition-colors
                      ${formData.isConfidential ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                      ${formData.isConfidential ? "translate-x-5" : "translate-x-0"}
                    `} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Marcar como confidencial
                  </span>
                </label>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-slate-700/80 dark:bg-slate-800/60">
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Envío automático de minutas
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Estos switches pertenecen al proyecto y sólo afectan envíos automáticos por transición. El envío manual sigue disponible.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: "autoSendOnPreview",
                    label: "Enviar automáticamente al pasar a revisión",
                    hint: "Usa esta regla en la transición de edición a preview.",
                  },
                  {
                    key: "autoSendOnCompleted",
                    label: "Enviar automáticamente al publicar la minuta",
                    hint: "Usa esta regla en la transición a completed.",
                  },
                ].map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200/80 bg-white px-3 py-3 dark:border-slate-700/80 dark:bg-slate-900/50">
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.label}</div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.hint}</div>
                    </div>
                    {isView ? (
                      <span className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        formData[item.key]
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                      }`}>
                        {formData[item.key] ? "Activo" : "Inactivo"}
                      </span>
                    ) : (
                      <label className="cursor-pointer select-none">
                        <div
                          onClick={() => handleChange(item.key, !formData[item.key])}
                          className={cn(
                            "relative h-6 w-11 rounded-full transition-colors",
                            formData[item.key] ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                              formData[item.key] ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </div>
                      </label>
                    )}
                  </div>
                ))}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.clientName || selectedClient?.company || (
                    <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>
                  )}
                </p>
              ) : loadingClients ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                  <Icon name="FaSpinner" className="w-4 h-4 animate-spin" />
                  Cargando clientes...
                </div>
              ) : (
                <>
                  <select
                    value={formData.clientId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const c  = clientOptions.find((x) => x.id === id) || null;
                      handleChange("clientId",   id);
                      handleChange("clientName", c?.company || "");
                    }}
                    className={inputCls("clientId")}
                  >
                    <option value="">— Seleccionar cliente —</option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}{c.isConfidential ? " 🔒" : ""}
                      </option>
                    ))}
                  </select>
                  {errors.clientId && (
                    <p className="mt-1 text-xs text-red-500">{errors.clientId}</p>
                  )}
                </>
              )}
            </div>

            {/* Info del cliente seleccionado */}
            {selectedClient && !isView && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Icon name="FaBuilding" className="w-4 h-4 flex-shrink-0" />
                <span>
                  Cliente seleccionado: <strong>{selectedClient.company}</strong>
                  {selectedClient.isConfidential && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">· Confidencial</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: Notas / Tags */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Información adicional y etiquetas del proyecto.
            </p>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Etiquetas
                <span className="ml-1 text-xs text-gray-400">(separadas por coma)</span>
              </label>
              {isView ? (
                tagsPreview.length ? (
                  <div className="flex flex-wrap gap-2">
                    {tagsPreview.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-gray-500 dark:text-gray-500">Sin etiquetas</p>
                )
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.projectTags}
                    onChange={(e) => handleChange("projectTags", e.target.value)}
                    placeholder="Ej: estratégico, 2025, cliente-vip"
                    className={inputCls("projectTags")}
                  />
                  {tagsPreview.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tagsPreview.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Vista: métricas de solo lectura */}
            {isView && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">{formData.minutas}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formData.minutas === 1 ? "minuta" : "minutas"}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
                  <div className="text-2xl font-bold text-gray-800 dark:text-white capitalize">{formData.projectStatus}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">estado actual</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paso 3: Confirmación */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {isView ? "Resumen del proyecto." : "Revise los datos antes de confirmar."}
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3 text-sm">
              <FieldRow label="Nombre"       value={formData.projectName} />
              {(isEdit || isView) && formData.projectCode && (
                <FieldRow label="Código" value={formData.projectCode} />
              )}
              <FieldRow label="Cliente"      value={selectedClient?.company || formData.clientName} />
              <FieldRow label="Estado"       value={formData.projectStatus} />
              <FieldRow label="Descripción"  value={formData.projectDescription} />
              <FieldRow label="Etiquetas"    value={formData.projectTags} />
              <div className="flex">
                <span className="font-medium text-gray-700 dark:text-gray-300 w-44 flex-shrink-0">
                  Confidencial:
                </span>
                <span className={`flex items-center gap-1 ${formData.isConfidential ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"}`}>
                  <Icon name={formData.isConfidential ? "FaLock" : "FaLockOpen"} className="w-3 h-3" />
                  {formData.isConfidential ? "Sí" : "No"}
                </span>
              </div>
              <FieldRow label="Auto envío al pasar a revisión" value={formData.autoSendOnPreview ? "Sí" : "No"} />
              <FieldRow label="Auto envío al publicar" value={formData.autoSendOnCompleted ? "Sí" : "No"} />
              {isView && formData.createdAt && (
                <FieldRow label="Creado" value={new Date(formData.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} />
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 border-t border-slate-200/80 px-8 py-5 dark:border-slate-700/80 flex justify-between">
        <button
          type="button"
          onClick={currentStep === 0 ? closeModal : handlePrevious}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
        >
          {currentStep === 0 ? "Cancelar" : "Anterior"}
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200"
        >
          {currentStep === steps.length - 1
            ? isView ? "Cerrar" : isCreate ? "Crear" : "Guardar"
            : "Siguiente"}
        </button>
      </div>

    </div>
    </div>
  );
};

export default ProjectModal;
export { MODES as PROJECT_MODAL_MODES };
