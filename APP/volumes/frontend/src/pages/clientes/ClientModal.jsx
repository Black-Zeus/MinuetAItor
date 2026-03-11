import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";

const MODES = {
  CREATE: "createNewClient",
  VIEW: "viewDetailClient",
  EDIT: "editCurrentClient",
};

const STEPS = [
  { title: "Empresa", description: "Información principal del cliente." },
  { title: "Contacto", description: "Responsable principal y canal de contacto." },
  { title: "Notas", description: "Contexto interno y etiquetas." },
  { title: "Confirmación", description: "Revisión final antes de confirmar." },
];

const normalizeClient = (data = {}) => ({
  companyName: data.companyName ?? data.name ?? "",
  companyLegalName: data.companyLegalName ?? data.legalName ?? "",
  description: data.description ?? "",
  industry: data.industry ?? "",
  companyEmail: data.companyEmail ?? data.email ?? "",
  companyPhone: data.companyPhone ?? data.phone ?? "",
  companyWebsite: data.companyWebsite ?? data.website ?? "",
  address: data.address ?? "",
  isConfidential: Boolean(data.isConfidential ?? data.is_confidential ?? false),
  contactName: data.contactName ?? data.contact_name ?? "",
  contactEmail: data.contactEmail ?? data.contact_email ?? "",
  contactPhone: data.contactPhone ?? data.contact_phone ?? "",
  contactPosition: data.contactPosition ?? data.contact_position ?? "",
  contactDepartment: data.contactDepartment ?? data.contact_department ?? "",
  notes: data.notes ?? "",
  tags: data.tags ?? "",
});

const cn = (...classes) => classes.filter(Boolean).join(" ");

const EMPTY_VALUE = (
  <span className="italic text-gray-400 dark:text-gray-500">Sin información</span>
);

const fieldClass = (hasError = false) =>
  cn(
    "w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
    "bg-white dark:bg-slate-800",
    "text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
    "focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800",
    hasError
      ? "border-red-400 dark:border-red-500"
      : "border-gray-300 dark:border-slate-700/80"
  );

const Section = ({ title, description, children }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm dark:border-slate-700/80 dark:bg-slate-800">
    <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/80">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      {description ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const Field = ({ label, hint, error, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {hint ? <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span> : null}
    </div>
    {children}
    {error ? <p className="text-sm text-red-500">{error}</p> : null}
  </div>
);

const ReadValue = ({ value, multiline = false }) => {
  const normalized = typeof value === "string" ? value.trim() : value;
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-gray-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-gray-200",
        multiline ? "whitespace-pre-line" : "break-words"
      )}
    >
      {normalized || EMPTY_VALUE}
    </div>
  );
};

const SummaryItem = ({ label, value }) => {
  const normalized = typeof value === "string" ? value.trim() : value;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-800">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{normalized || EMPTY_VALUE}</div>
    </div>
  );
};

const StepItem = ({ index, currentStep, title }) => {
  const isActive = index === currentStep;
  const isDone = index < currentStep;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
          isDone
            ? "border-sky-700 bg-sky-700 text-white dark:border-sky-300 dark:bg-sky-300 dark:text-slate-900"
            : isActive
              ? "border-slate-500 bg-slate-500 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900"
              : "border-gray-300 bg-white/80 text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-gray-400"
        )}
      >
        {isDone ? <Icon name="FaCheckCircle" className="h-3.5 w-3.5" /> : index + 1}
      </div>
      <span
        className={cn(
          "text-sm",
          isActive ? "font-semibold text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
        )}
      >
        {title}
      </span>
    </div>
  );
};

const ClientModal = ({ mode, data, onSubmit, onClose }) => {
  const isCreate = mode === MODES.CREATE;
  const isView = mode === MODES.VIEW;
  const isEdit = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeClient(data), [data]);
  const [formData, setFormData] = useState(() => (isCreate ? normalizeClient({}) : initial));
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setFormData(isCreate ? normalizeClient({}) : initial);
    setErrors({});
    setCurrentStep(0);
  }, [initial, isCreate]);

  const currentMeta = STEPS[currentStep];

  const tagsPreview = useMemo(
    () =>
      (formData.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [formData.tags]
  );

  const closeModal = () => {
    try {
      onClose?.();
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
    if (isView) {
      setErrors({});
      return true;
    }

    const nextErrors = {};

    if (step === 0) {
      if (!formData.companyName.trim()) nextErrors.companyName = "Nombre comercial es requerido";
      if (!formData.industry.trim()) nextErrors.industry = "Industria es requerido";
    }

    if (step === 1) {
      if (!formData.contactName.trim()) nextErrors.contactName = "Nombre del contacto es requerido";
      if (!formData.contactEmail.trim()) nextErrors.contactEmail = "Email del contacto es requerido";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isView) return;

    try {
      await onSubmit?.({ ...formData });
      toastSuccess(
        "Guardado",
        isCreate ? "Cliente creado correctamente." : "Cliente actualizado correctamente.",
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

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    handleSubmit();
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  return (
    <div className="w-full rounded-[26px] bg-white/8 p-[2px] shadow-[0_0_24px_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-[3px] dark:bg-white/[0.06] dark:shadow-[0_0_28px_rgba(255,255,255,0.06),0_24px_70px_rgba(2,6,23,0.52)]">
      <div className="flex h-[78vh] min-h-[620px] w-full flex-col rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
      <div className="border-b border-slate-200/80 px-8 py-6 dark:border-slate-700/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
              {isCreate ? "Nuevo cliente" : isEdit ? "Editar cliente" : "Detalle de cliente"}
            </div>
            <h3 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {currentMeta.title}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{currentMeta.description}</p>
          </div>

          <div className="flex items-center gap-3">
            {formData.isConfidential ? (
              <span className="rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-800/80 dark:bg-sky-900/20 dark:text-sky-300">
                Confidencial
              </span>
            ) : null}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Paso {currentStep + 1} de {STEPS.length}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {STEPS.map((step, index) => (
            <StepItem key={step.title} index={index} currentStep={currentStep} title={step.title} />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {currentStep === 0 ? (
          <div className="space-y-6">
            {!isView ? (
              <Section title="Visibilidad" description="Controla si el cliente debe quedar restringido dentro del sistema.">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isConfidential}
                    onChange={(e) => handleChange("isConfidential", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Cliente confidencial</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Restringe su visibilidad según roles y permisos.
                    </div>
                  </div>
                </label>
              </Section>
            ) : null}

            <Section title="Información corporativa" description="Datos principales del cliente dentro del sistema.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nombre comercial" hint="Obligatorio" error={errors.companyName}>
                  {isView ? (
                    <ReadValue value={formData.companyName} />
                  ) : (
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleChange("companyName", e.target.value)}
                      className={fieldClass(Boolean(errors.companyName))}
                    />
                  )}
                </Field>

                <Field label="Industria" hint="Obligatorio" error={errors.industry}>
                  {isView ? (
                    <ReadValue value={formData.industry} />
                  ) : (
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => handleChange("industry", e.target.value)}
                      className={fieldClass(Boolean(errors.industry))}
                    />
                  )}
                </Field>

                <div className="md:col-span-2">
                  <Field label="Razón social" hint="Opcional">
                    {isView ? (
                      <ReadValue value={formData.companyLegalName} />
                    ) : (
                      <input
                        type="text"
                        value={formData.companyLegalName}
                        onChange={(e) => handleChange("companyLegalName", e.target.value)}
                        className={fieldClass()}
                      />
                    )}
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Descripción" hint="Opcional">
                    {isView ? (
                      <ReadValue value={formData.description} multiline />
                    ) : (
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleChange("description", e.target.value)}
                        rows={4}
                        className={cn(fieldClass(), "resize-none")}
                      />
                    )}
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Datos de contacto corporativo" description="Canales institucionales del cliente.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Email corporativo" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.companyEmail} />
                  ) : (
                    <input
                      type="email"
                      value={formData.companyEmail}
                      onChange={(e) => handleChange("companyEmail", e.target.value)}
                      className={fieldClass()}
                    />
                  )}
                </Field>

                <Field label="Teléfono" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.companyPhone} />
                  ) : (
                    <input
                      type="tel"
                      value={formData.companyPhone}
                      onChange={(e) => handleChange("companyPhone", e.target.value)}
                      className={fieldClass()}
                    />
                  )}
                </Field>

                <Field label="Sitio web" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.companyWebsite} />
                  ) : (
                    <input
                      type="url"
                      value={formData.companyWebsite}
                      onChange={(e) => handleChange("companyWebsite", e.target.value)}
                      className={fieldClass()}
                    />
                  )}
                </Field>

                <Field label="Dirección" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.address} />
                  ) : (
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      className={fieldClass()}
                    />
                  )}
                </Field>
              </div>
            </Section>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <Section title="Contacto principal" description="Responsable de referencia para la cuenta.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre completo" hint="Obligatorio" error={errors.contactName}>
                {isView ? (
                  <ReadValue value={formData.contactName} />
                ) : (
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => handleChange("contactName", e.target.value)}
                    className={fieldClass(Boolean(errors.contactName))}
                  />
                )}
              </Field>

              <Field label="Email" hint="Obligatorio" error={errors.contactEmail}>
                {isView ? (
                  <ReadValue value={formData.contactEmail} />
                ) : (
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleChange("contactEmail", e.target.value)}
                    className={fieldClass(Boolean(errors.contactEmail))}
                  />
                )}
              </Field>

              <Field label="Teléfono" hint="Opcional">
                {isView ? (
                  <ReadValue value={formData.contactPhone} />
                ) : (
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => handleChange("contactPhone", e.target.value)}
                    className={fieldClass()}
                  />
                )}
              </Field>

              <Field label="Cargo" hint="Opcional">
                {isView ? (
                  <ReadValue value={formData.contactPosition} />
                ) : (
                  <input
                    type="text"
                    value={formData.contactPosition}
                    onChange={(e) => handleChange("contactPosition", e.target.value)}
                    className={fieldClass()}
                  />
                )}
              </Field>

              <div className="md:col-span-2">
                <Field label="Área o departamento" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.contactDepartment} />
                  ) : (
                    <input
                      type="text"
                      value={formData.contactDepartment}
                      onChange={(e) => handleChange("contactDepartment", e.target.value)}
                      className={fieldClass()}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Section>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-6">
            <Section title="Notas internas" description="Contexto útil para el equipo.">
              <Field label="Notas" hint="Opcional">
                {isView ? (
                  <ReadValue value={formData.notes} multiline />
                ) : (
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    rows={7}
                    className={cn(fieldClass(), "resize-none")}
                  />
                )}
              </Field>
            </Section>

            <Section title="Etiquetas" description="Separadas por coma para búsqueda y clasificación.">
              <Field label="Tags" hint="Opcional">
                {isView ? (
                  <div className="flex flex-wrap gap-2">
                    {tagsPreview.length
                      ? tagsPreview.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 dark:border-slate-700 dark:text-gray-300"
                          >
                            {tag}
                          </span>
                        ))
                      : EMPTY_VALUE}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => handleChange("tags", e.target.value)}
                      className={fieldClass()}
                    />
                    {tagsPreview.length ? (
                      <div className="flex flex-wrap gap-2">
                        {tagsPreview.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 dark:border-slate-700 dark:text-gray-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </Field>
            </Section>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-6">
            <Section title="Resumen" description="Verifique los datos antes de confirmar.">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SummaryItem label="Nombre comercial" value={formData.companyName} />
                <SummaryItem label="Industria" value={formData.industry} />
                <SummaryItem label="Razón social" value={formData.companyLegalName} />
                <SummaryItem label="Email corporativo" value={formData.companyEmail} />
                <SummaryItem label="Teléfono empresa" value={formData.companyPhone} />
                <SummaryItem label="Sitio web" value={formData.companyWebsite} />
                <SummaryItem label="Dirección" value={formData.address} />
                <SummaryItem label="Confidencial" value={formData.isConfidential ? "Sí" : "No"} />
                <SummaryItem label="Contacto principal" value={formData.contactName} />
                <SummaryItem label="Email contacto" value={formData.contactEmail} />
                <SummaryItem label="Teléfono contacto" value={formData.contactPhone} />
                <SummaryItem label="Cargo" value={formData.contactPosition} />
                <SummaryItem label="Departamento" value={formData.contactDepartment} />
              </div>
            </Section>

            <Section title="Notas y etiquetas" description="Información interna adicional.">
              <div className="space-y-4">
                <SummaryItem label="Notas" value={formData.notes} />
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    Etiquetas
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tagsPreview.length
                      ? tagsPreview.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 dark:border-slate-700 dark:text-gray-300"
                          >
                            {tag}
                          </span>
                        ))
                      : EMPTY_VALUE}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={currentStep === 0 ? closeModal : handlePrevious}
            className="rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-gray-300 dark:hover:bg-slate-800"
          >
            {currentStep === 0 ? "Cancelar" : "Anterior"}
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200"
            >
              Siguiente
            </button>
          ) : isView ? (
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200"
            >
              Cerrar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200"
            >
              {isCreate ? "Crear cliente" : "Guardar cambios"}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ClientModal;
export { MODES as CLIENT_MODAL_MODES };
