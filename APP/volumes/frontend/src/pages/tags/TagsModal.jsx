import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError } from "@/components/common/toast/toastHelpers";

export const TAGS_MODAL_MODES = {
  CREATE: "createNewTag",
  VIEW: "viewDetailTag",
  EDIT: "editCurrentTag",
};

const STEP_ITEMS = [
  { key: "tag", label: "Etiqueta", number: 1 },
  { key: "description", label: "Descripción", number: 2 },
  { key: "summary", label: "Confirmación", number: 3 },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

const INPUT_BASE =
  "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600/80 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-300/70 dark:focus:border-sky-400 dark:focus:ring-sky-400/25";
const INPUT_ERROR = "border-rose-400 focus:border-rose-400 focus:ring-rose-400/25";
const LABEL = "mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-100";
const HELP = "mt-1 text-xs text-gray-500 dark:text-slate-400";

const normalizeStatus = (status, isActive = true) => {
  if (status === "inactivo" || status === "inactive") return "inactivo";
  if (status === "activo" || status === "active") return "activo";
  return isActive ? "activo" : "inactivo";
};

const normalizeTag = (data = {}) => {
  const source = data ?? {};
  return {
    tagName: source.tagName ?? source.name ?? "",
    tagDescription: source.tagDescription ?? source.description ?? "",
    tagStatus: normalizeStatus(source.tagStatus ?? source.status, source.isActive ?? source.is_active ?? true),
    categoryId: String(source.categoryId ?? source.category_id ?? source.category?.id ?? ""),
    categoryName: source.categoryName ?? source.category?.name ?? source.category ?? "",
    source: source.source ?? "user",
  };
};

const FieldShell = ({ label, required, error, children, helper }) => (
  <div>
    <label className={LABEL}>
      {label} {required ? <span className="text-rose-400">*</span> : null}
    </label>
    {children}
    {error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : null}
    {!error && helper ? <p className={HELP}>{helper}</p> : null}
  </div>
);

const StaticValue = ({ value, muted = false, multiline = false }) => {
  const hasValue = String(value ?? "").trim().length > 0;
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm dark:border-slate-700/80 dark:bg-transparent ${
        multiline ? "min-h-[124px] whitespace-pre-wrap" : ""
      } ${muted ? "text-gray-400 italic dark:text-slate-400" : "text-gray-800 dark:text-slate-100"}`}
    >
      {hasValue ? value : "Sin información"}
    </div>
  );
};

const SummaryItem = ({ label, children }) => (
  <div className="border-b border-slate-200/70 py-3 last:border-b-0 dark:border-slate-800/70">
    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-500">{label}</div>
    <div className="text-sm text-gray-800 dark:text-slate-100">{children}</div>
  </div>
);

const StepItem = ({ index, currentStep, title, onClick }) => {
  const isActive = index === currentStep;
  const isDone = index < currentStep;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-100/10"
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
          isDone
            ? "border-sky-700 bg-sky-700 text-white dark:border-sky-300 dark:bg-sky-300 dark:text-slate-900"
            : isActive
              ? "border-slate-500 bg-slate-500 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900"
              : "border-gray-300 bg-white/80 text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
        )}
      >
        {isDone ? <Icon name="FaCheckCircle" className="h-3.5 w-3.5" /> : index + 1}
      </div>
      <span
        className={cn(
          "text-sm",
          isActive ? "font-semibold text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
        )}
      >
        {title}
      </span>
    </button>
  );
};

const TagsModal = ({ mode, data, categories = [], onSubmit, onClose }) => {
  const isCreate = mode === TAGS_MODAL_MODES.CREATE;
  const isView = mode === TAGS_MODAL_MODES.VIEW;
  const isEdit = mode === TAGS_MODAL_MODES.EDIT;

  const initial = useMemo(() => normalizeTag(data), [data]);
  const [formData, setFormData] = useState(() => (isCreate ? normalizeTag(null) : initial));
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(isCreate ? normalizeTag(null) : normalizeTag(data));
    setErrors({});
    setCurrentStep(0);
  }, [data, isCreate]);

  const categoryName = useMemo(() => {
    const fromCatalog = categories.find((item) => String(item.id) === String(formData.categoryId))?.name;
    return fromCatalog ?? formData.categoryName ?? "Sin categoría";
  }, [categories, formData.categoryId, formData.categoryName]);

  const statusLabel = formData.tagStatus === "inactivo" ? "Inactivo" : "Activo";
  const titleText = formData.tagName?.trim() || (isCreate ? "Nueva etiqueta" : "Etiqueta sin nombre");
  const subtitleText = isCreate ? "NUEVA ETIQUETA" : isEdit ? "EDITAR ETIQUETA" : "DETALLE DE ETIQUETA";

  const closeModal = () => {
    try {
      onClose?.();
    } catch (_) {}
    try {
      ModalManager.closeAll?.();
    } catch (_) {}
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleCategoryChange = (value) => {
    const selected = categories.find((item) => String(item.id) === String(value));
    setFormData((prev) => ({
      ...prev,
      categoryId: String(value),
      categoryName: selected?.name ?? "",
    }));
    if (errors.categoryId) {
      setErrors((prev) => ({ ...prev, categoryId: null }));
    }
  };

  const validateStep = (stepIndex) => {
    if (isView) return true;

    const nextErrors = {};

    if (stepIndex === 0) {
      const name = String(formData.tagName ?? "").trim();
      if (!name) nextErrors.tagName = "El nombre es obligatorio.";
      else if (name.length < 2) nextErrors.tagName = "El nombre debe tener al menos 2 caracteres.";

      if (!String(formData.categoryId ?? "").trim()) {
        nextErrors.categoryId = "Debes seleccionar una categoría.";
      }
    }

    if (stepIndex === 1) {
      const description = String(formData.tagDescription ?? "").trim();
      if (!description) nextErrors.tagDescription = "La descripción es obligatoria.";
      else if (description.length < 10) nextErrors.tagDescription = "La descripción debe tener al menos 10 caracteres.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = async () => {
    if (isView) {
      if (currentStep < STEP_ITEMS.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        closeModal();
      }
      return;
    }

    if (!validateStep(currentStep)) return;

    if (currentStep < STEP_ITEMS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        tagName: formData.tagName?.trim() ?? "",
        tagDescription: formData.tagDescription?.trim() ?? "",
        tagStatus: formData.tagStatus ?? "activo",
        categoryId: formData.categoryId,
        categoryName,
        source: formData.source ?? "user",
      });
    } catch (err) {
      const message =
        err?.response?.data?.detail ??
        err?.response?.data?.error ??
        err?.message ??
        "No se pudo guardar la etiqueta.";
      toastError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      closeModal();
    }
  };

  return (
    <div className="w-full">
      <div className="flex h-[78vh] min-h-[620px] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#050b1f] dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
        <div className="flex-shrink-0 px-8 py-7">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-slate-800 dark:text-sky-300">
                <Icon name="FaTags" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400 dark:text-slate-500">{subtitleText}</div>
                <h2 className="truncate text-[2rem] font-semibold leading-tight text-gray-900 dark:text-white">{titleText}</h2>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                formData.tagStatus === "inactivo"
                  ? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {STEP_ITEMS.map((step, index) => (
              <StepItem
                key={step.key}
                index={index}
                currentStep={currentStep}
                title={step.label}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-slate-200/80 px-8 py-6 dark:border-slate-800/90">
          {currentStep === 0 ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Información general</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Define el nombre, la categoría y el estado de la etiqueta.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FieldShell label="Nombre" required error={errors.tagName}>
                  {isView ? (
                    <StaticValue value={formData.tagName} />
                  ) : (
                    <input
                      type="text"
                      value={formData.tagName}
                      onChange={(event) => handleChange("tagName", event.target.value)}
                      placeholder="Ej: Firewall"
                      className={`${INPUT_BASE} ${errors.tagName ? INPUT_ERROR : ""}`}
                    />
                  )}
                </FieldShell>

                <FieldShell label="Categoría" required error={errors.categoryId}>
                  {isView ? (
                    <StaticValue value={categoryName} />
                  ) : (
                    <select
                      value={formData.categoryId}
                      onChange={(event) => handleCategoryChange(event.target.value)}
                      className={`${INPUT_BASE} ${errors.categoryId ? INPUT_ERROR : ""}`}
                    >
                      <option value="">Seleccionar categoría...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  )}
                </FieldShell>

                <FieldShell label="Estado">
                  {isView ? (
                    <StaticValue value={statusLabel} />
                  ) : (
                    <select
                      value={formData.tagStatus}
                      onChange={(event) => handleChange("tagStatus", event.target.value)}
                      className={INPUT_BASE}
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  )}
                </FieldShell>

                <FieldShell label="Origen" helper="Referencial, para trazabilidad interna del catálogo.">
                  <StaticValue value={formData.source === "system" ? "Sistema" : "Usuario"} />
                </FieldShell>
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Descripción</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Resume el propósito de esta etiqueta y cómo debe usarse dentro del sistema.</p>
              </div>

              <FieldShell label="Descripción" required error={errors.tagDescription}>
                {isView ? (
                  <StaticValue value={formData.tagDescription} multiline />
                ) : (
                  <textarea
                    value={formData.tagDescription}
                    onChange={(event) => handleChange("tagDescription", event.target.value)}
                    rows={8}
                    placeholder="Describe el propósito y uso de esta etiqueta..."
                    className={`${INPUT_BASE} min-h-[220px] resize-y ${errors.tagDescription ? INPUT_ERROR : ""}`}
                  />
                )}
              </FieldShell>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Resumen</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  {isView ? "Información consolidada de la etiqueta." : "Verifica los datos antes de confirmar los cambios."}
                </p>
              </div>

              <div className="grid gap-x-10 gap-y-2 md:grid-cols-2">
                <SummaryItem label="Nombre">{formData.tagName || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}</SummaryItem>
                <SummaryItem label="Categoría">{categoryName || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}</SummaryItem>
                <SummaryItem label="Estado">{statusLabel}</SummaryItem>
                <SummaryItem label="Origen">{formData.source === "system" ? "Sistema" : "Usuario"}</SummaryItem>
                <div className="md:col-span-2">
                  <SummaryItem label="Descripción">
                    {formData.tagDescription || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}
                  </SummaryItem>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 px-8 py-5 dark:border-slate-800/90">
          <button
            type="button"
            onClick={currentStep === 0 ? closeModal : handlePrevious}
            className="rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/70"
          >
            {currentStep === 0 ? (isView ? "Cerrar" : "Cancelar") : "Anterior"}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
          >
            {isSubmitting ? <Icon name="FaSpinner" className="h-3.5 w-3.5 animate-spin" /> : null}
            {isView
              ? currentStep === STEP_ITEMS.length - 1
                ? "Cerrar"
                : "Siguiente"
              : currentStep === STEP_ITEMS.length - 1
              ? isCreate
                ? "Crear etiqueta"
                : "Guardar cambios"
              : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagsModal;
