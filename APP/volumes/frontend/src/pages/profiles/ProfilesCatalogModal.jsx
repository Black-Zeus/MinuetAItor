import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";

export const PROFILE_MODAL_MODES = {
  CREATE: "create",
  VIEW: "view",
  EDIT: "edit",
};

const STEP_ITEMS = [
  { key: "info", label: "Perfil", number: 1 },
  { key: "prompt", label: "Prompt AI", number: 2 },
  { key: "summary", label: "Confirmación", number: 3 },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

const INPUT_BASE =
  "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600/80 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-300/70 dark:focus:border-sky-400 dark:focus:ring-sky-400/25";
const INPUT_ERROR = "border-rose-400 focus:border-rose-400 focus:ring-rose-400/25";
const LABEL = "mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-100";
const HELP = "mt-1 text-xs text-gray-500 dark:text-slate-400";

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "activo" || normalized === "active" || normalized === "true") return true;
  if (normalized === "inactivo" || normalized === "inactive" || normalized === "false") return false;
  return fallback;
};

const normalizeProfile = (data = {}) => {
  const source = data ?? {};
  return {
    id: source.id ?? "",
    nombre: source.nombre ?? source.name ?? "",
    categoria: source.categoria ?? source.category?.name ?? source.categoryName ?? "",
    descripcion: source.descripcion ?? source.description ?? "",
    prompt: source.prompt ?? "",
    status: normalizeBoolean(source.status ?? source.isActive ?? source.is_active, true),
    _categoryId: source._categoryId ?? source.categoryId ?? source.category_id ?? source.category?.id ?? "",
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

const StaticValue = ({ value, multiline = false, mono = false }) => {
  const hasValue = String(value ?? "").trim().length > 0;
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-gray-800 dark:border-slate-700/80 dark:bg-transparent dark:text-slate-100 ${
        multiline ? "min-h-[124px] whitespace-pre-wrap" : ""
      } ${mono ? "font-mono text-xs" : ""}`}
    >
      {hasValue ? value : <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}
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

const validateStep = (formData, stepIndex) => {
  const errors = {};

  if (stepIndex === 0) {
    const nombre = String(formData.nombre ?? "").trim();
    if (!nombre) errors.nombre = "El nombre es obligatorio.";
    else if (nombre.length < 3) errors.nombre = "El nombre debe tener al menos 3 caracteres.";

    if (!String(formData._categoryId ?? "").trim()) {
      errors.categoria = "Debes seleccionar una categoría.";
    }

    const descripcion = String(formData.descripcion ?? "").trim();
    if (descripcion.length < 10) {
      errors.descripcion = "La descripción debe tener al menos 10 caracteres.";
    }
  }

  if (stepIndex === 1) {
    const prompt = String(formData.prompt ?? "").trim();
    if (prompt.length < 30) {
      errors.prompt = "El prompt debe tener al menos 30 caracteres.";
    }
  }

  return errors;
};

const ProfilesCatalogModal = ({
  mode = PROFILE_MODAL_MODES.CREATE,
  profile,
  categories = [],
  onSubmit,
  onClose,
}) => {
  const isCreate = mode === PROFILE_MODAL_MODES.CREATE;
  const isView = mode === PROFILE_MODAL_MODES.VIEW;
  const isEdit = mode === PROFILE_MODAL_MODES.EDIT;

  const initial = useMemo(() => normalizeProfile(profile), [profile]);
  const [formData, setFormData] = useState(initial);
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(normalizeProfile(profile));
    setErrors({});
    setCurrentStep(0);
  }, [profile, mode]);

  const categoryOptions = useMemo(
    () => (Array.isArray(categories) ? categories.filter((item) => item?.name) : []),
    [categories]
  );

  const categoryName = useMemo(() => {
    const selected = categoryOptions.find((item) => String(item.id) === String(formData._categoryId));
    return selected?.name ?? formData.categoria ?? "Sin categoría";
  }, [categoryOptions, formData._categoryId, formData.categoria]);

  const statusLabel = formData.status ? "Activo" : "Inactivo";
  const titleText = String(formData.nombre ?? "").trim() || (isCreate ? "Nuevo perfil" : "Perfil sin nombre");
  const subtitleText = isCreate ? "NUEVO PERFIL IA" : isEdit ? "EDITAR PERFIL IA" : "DETALLE DE PERFIL IA";

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleCategoryChange = (categoryId) => {
    const selected = categoryOptions.find((item) => String(item.id) === String(categoryId));
    setFormData((prev) => ({
      ...prev,
      _categoryId: String(categoryId),
      categoria: selected?.name ?? "",
    }));
    if (errors.categoria) {
      setErrors((prev) => ({ ...prev, categoria: null }));
    }
  };

  const handleNext = async () => {
    if (isView) {
      if (currentStep < STEP_ITEMS.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        onClose?.();
      }
      return;
    }

    const nextErrors = validateStep(formData, currentStep);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (currentStep < STEP_ITEMS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        ...formData,
        categoria: categoryName,
        _categoryId: formData._categoryId,
      });
    } catch (_) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      return;
    }
    onClose?.();
  };

  return (
    <div className="w-full">
      <div className="flex h-[78vh] min-h-[620px] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#050b1f] dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
        <div className="flex-shrink-0 px-8 py-7">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-slate-800 dark:text-sky-300">
                <Icon name="FaBrain" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400 dark:text-slate-500">{subtitleText}</div>
                <h2 className="truncate text-[2rem] font-semibold leading-tight text-gray-900 dark:text-white">{titleText}</h2>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                formData.status ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200"
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
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Define el nombre, la categoría, el estado y la descripción del perfil.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FieldShell label="Nombre" required error={errors.nombre}>
                  {isView ? (
                    <StaticValue value={formData.nombre} />
                  ) : (
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(event) => handleChange("nombre", event.target.value)}
                      placeholder="Ej: Seguimiento de proyecto"
                      className={`${INPUT_BASE} ${errors.nombre ? INPUT_ERROR : ""}`}
                    />
                  )}
                </FieldShell>

                <FieldShell label="Categoría" required error={errors.categoria}>
                  {isView ? (
                    <StaticValue value={categoryName} />
                  ) : (
                    <select
                      value={formData._categoryId}
                      onChange={(event) => handleCategoryChange(event.target.value)}
                      className={`${INPUT_BASE} ${errors.categoria ? INPUT_ERROR : ""}`}
                    >
                      <option value="">Seleccionar categoría...</option>
                      {categoryOptions.map((category) => (
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
                      value={formData.status ? "activo" : "inactivo"}
                      onChange={(event) => handleChange("status", event.target.value === "activo")}
                      className={INPUT_BASE}
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  )}
                </FieldShell>

                <FieldShell label="Descripción" required error={errors.descripcion}>
                  {isView ? (
                    <StaticValue value={formData.descripcion} multiline />
                  ) : (
                    <textarea
                      value={formData.descripcion}
                      onChange={(event) => handleChange("descripcion", event.target.value)}
                      rows={5}
                      placeholder="Describe el alcance y propósito del perfil..."
                      className={`${INPUT_BASE} min-h-[160px] resize-y ${errors.descripcion ? INPUT_ERROR : ""}`}
                    />
                  )}
                </FieldShell>
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Prompt AI</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Define cómo la IA debe interpretar y sintetizar las minutas para este perfil.</p>
              </div>

              <FieldShell
                label="Prompt"
                required
                error={errors.prompt}
                helper={!isView ? "Mantén instrucciones precisas, trazables y alineadas al objetivo del análisis." : undefined}
              >
                {isView ? (
                  <StaticValue value={formData.prompt} multiline mono />
                ) : (
                  <textarea
                    value={formData.prompt}
                    onChange={(event) => handleChange("prompt", event.target.value)}
                    rows={14}
                    placeholder="Escribe el prompt que utilizará la IA para este perfil..."
                    className={`${INPUT_BASE} min-h-[300px] resize-y font-mono text-xs ${errors.prompt ? INPUT_ERROR : ""}`}
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
                  {isView ? "Información consolidada del perfil." : "Revisa los datos antes de confirmar la operación."}
                </p>
              </div>

              <div className="grid gap-x-10 gap-y-2 md:grid-cols-2">
                <SummaryItem label="Nombre">{formData.nombre || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}</SummaryItem>
                <SummaryItem label="Categoría">{categoryName || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}</SummaryItem>
                <SummaryItem label="Estado">{statusLabel}</SummaryItem>
                <div className="md:col-span-2">
                  <SummaryItem label="Descripción">
                    {formData.descripcion || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}
                  </SummaryItem>
                </div>
                <div className="md:col-span-2">
                  <SummaryItem label="Prompt AI">
                    <div className="whitespace-pre-wrap font-mono text-xs leading-6 text-gray-700 dark:text-slate-200">
                      {formData.prompt || <span className="italic text-gray-400 dark:text-slate-500">Sin información</span>}
                    </div>
                  </SummaryItem>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 px-8 py-5 dark:border-slate-800/90">
          <button
            type="button"
            onClick={currentStep === 0 ? onClose : handlePrevious}
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
                ? "Crear perfil AI"
                : "Guardar cambios"
              : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilesCatalogModal;
