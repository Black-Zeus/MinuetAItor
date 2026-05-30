import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import { DEFAULT_PDF_TEMPLATE, PDF_TEMPLATE_OPTIONS, getPdfTemplateLabel } from "@/constants/pdfTemplates";
import clientService from "@/services/clientService";
import projectService from "@/services/projectService";
import { formatDateMedium } from "@/utils/formats";

const MODES = {
  CREATE: "createNewProject",
  VIEW: "viewDetailProject",
  EDIT: "editCurrentProject",
};

const STEPS = [
  { title: "Proyecto" },
  { title: "Cliente" },
  { title: "Notas" },
  { title: "Automatización" },
  { title: "Confirmación" },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

const EMPTY_VALUE = (
  <span className="italic text-gray-400 dark:text-gray-500">Sin información</span>
);

const normalizeProject = (data = {}) => {
  const isActive = Boolean(
    data.isActive ?? data.is_active ?? ((data.status ?? "activo") !== "inactivo")
  );

  return {
    id: data.id ?? data.projectId ?? "",
    logoUrl: data.logoUrl ?? data.logo_url ?? "",
    projectName: data.projectName ?? data.name ?? "",
    projectDescription: data.projectDescription ?? data.description ?? "",
    projectNotes: data.projectNotes ?? data.notes ?? "",
    projectTags: data.projectTags ?? data.tags ?? "",
    projectStatus: data.projectStatus ?? data.status ?? (isActive ? "activo" : "inactivo"),
    projectCode: data.projectCode ?? data.code ?? "",
    clientId: (data.clientId ?? data.client_id ?? data.client?.id ?? "")?.toString?.() ?? "",
    clientName: data.clientName ?? data.client_name ?? data.client?.name ?? data.client ?? "",
    isConfidential: Boolean(data.isConfidential ?? data.is_confidential ?? false),
    autoSendOnPreview: Boolean(data.autoSendOnPreview ?? data.auto_send_on_preview ?? false),
    autoSendOnCompleted: Boolean(data.autoSendOnCompleted ?? data.auto_send_on_completed ?? false),
    pdfTemplateOverride: data.pdfTemplateOverride ?? data.pdf_template_override ?? "",
    resolvedPdfTemplate: data.resolvedPdfTemplate ?? data.resolved_pdf_template ?? DEFAULT_PDF_TEMPLATE,
    createdAt: data.createdAt ?? data.created_at ?? "",
  };
};

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
  <section className="space-y-4">
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      {description ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
    </div>
    <div>{children}</div>
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

const SummaryItem = ({ label, value, multiline = false, className = "" }) => {
  const normalized = typeof value === "string" ? value.trim() : value;
  return (
    <div
      className={cn(
        "border-b border-slate-200/70 pb-4 dark:border-slate-800/90",
        multiline ? "min-h-[96px]" : "min-h-[72px]",
        className
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-[15px] text-gray-800 dark:text-gray-200",
          multiline ? "whitespace-pre-line break-words" : "break-words"
        )}
      >
        {normalized || EMPTY_VALUE}
      </div>
    </div>
  );
};

const ProjectLogoBadge = ({
  logoUrl,
  projectName,
  logoFailed,
  onLogoError,
  className = "h-14 w-14 rounded-2xl",
  iconClassName = "h-6 w-6",
}) => (
  <div
    className={cn(
      "flex items-center justify-center overflow-hidden bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300",
      className
    )}
  >
    {logoUrl && !logoFailed ? (
      <img
        src={logoUrl}
        alt={projectName || "Logo del proyecto"}
        className="h-full w-full object-cover"
        onError={onLogoError}
      />
    ) : (
      <Icon name="FaFolderOpen" className={iconClassName} />
    )}
  </div>
);

const SummaryLogoItem = ({ logoUrl, projectName, logoFailed, onLogoError }) => (
  <div className="min-h-[72px] border-b border-slate-200/70 pb-4 dark:border-slate-800/90">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
      Logo
    </div>
    <div className="mt-3">
      <ProjectLogoBadge
        logoUrl={logoUrl}
        projectName={projectName}
        logoFailed={logoFailed}
        onLogoError={onLogoError}
        className="h-12 w-12 rounded-xl"
        iconClassName="h-5 w-5"
      />
    </div>
  </div>
);

const StepItem = ({ index, currentStep, title, onClick }) => {
  const isActive = index === currentStep;
  const isDone = index < currentStep;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
    >
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
    </button>
  );
};

const ToggleCard = ({ title, description, checked, isView, onToggle }) => (
  <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-4 dark:border-slate-700/80 dark:bg-slate-900/50">
    <div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{title}</div>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</div>
    </div>

    {isView ? (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          checked
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
        )}
      >
        {checked ? "Activo" : "Inactivo"}
      </span>
    ) : (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
        )}
      >
        <div
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    )}
  </div>
);

const ProjectModal = ({
  mode,
  data,
  onSubmit,
  onClose,
  onSaved,
  clientCatalog = [],
}) => {
  const isCreate = mode === MODES.CREATE;
  const isView = mode === MODES.VIEW;
  const isEdit = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeProject(data), [data]);
  const [formData, setFormData] = useState(() => (isCreate ? normalizeProject({}) : initial));
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [localLogoUrl, setLocalLogoUrl] = useState("");
  const [removeLogoRequested, setRemoveLogoRequested] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [clientCatalogState, setClientCatalogState] = useState(
    Array.isArray(clientCatalog) ? clientCatalog : []
  );
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    setFormData(isCreate ? normalizeProject({}) : initial);
    setErrors({});
    setCurrentStep(0);
    setPendingLogoFile(null);
    setLocalLogoUrl("");
    setRemoveLogoRequested(false);
    setLogoFailed(false);
  }, [initial, isCreate]);

  useEffect(() => {
    setClientCatalogState(Array.isArray(clientCatalog) ? clientCatalog : []);
  }, [clientCatalog]);

  useEffect(() => () => {
    if (localLogoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(localLogoUrl);
    }
  }, [localLogoUrl]);

  useEffect(() => {
    if (Array.isArray(clientCatalog) && clientCatalog.length > 0) return;

    let cancelled = false;
    const loadClients = async () => {
      setLoadingClients(true);
      try {
        const result = await clientService.list({ isActive: true, limit: 200 });
        if (!cancelled) {
          setClientCatalogState(result.items ?? []);
        }
      } catch (_) {
        if (!cancelled) {
          setClientCatalogState([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingClients(false);
        }
      }
    };

    loadClients();
    return () => {
      cancelled = true;
    };
  }, [clientCatalog]);

  const currentLogoUrl = removeLogoRequested ? "" : localLogoUrl || formData.logoUrl || "";
  const headerTitle = isCreate
    ? formData.projectName?.trim() || "Proyecto"
    : formData.projectName?.trim() || "Proyecto sin nombre";
  const tagsPreview = useMemo(
    () =>
      (formData.projectTags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [formData.projectTags]
  );

  const clientOptions = useMemo(() => {
    const entries = [];
    const seen = new Set();

    (Array.isArray(clientCatalogState) ? clientCatalogState : []).forEach((client) => {
      const id = String(client?.id ?? "");
      const name = client?.name ?? client?.companyName ?? client?.company ?? "";
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      entries.push({
        id,
        company: name,
        isConfidential: Boolean(client?.isConfidential ?? client?.is_confidential ?? false),
        defaultPdfTemplate:
          client?.defaultPdfTemplate ?? client?.default_pdf_template ?? DEFAULT_PDF_TEMPLATE,
      });
    });

    if (formData.clientId && !seen.has(String(formData.clientId))) {
      entries.push({
        id: String(formData.clientId),
        company: formData.clientName || "Cliente actual",
        isConfidential: false,
        defaultPdfTemplate: DEFAULT_PDF_TEMPLATE,
      });
    }

    return entries.sort((a, b) => a.company.localeCompare(b.company, "es"));
  }, [clientCatalogState, formData.clientId, formData.clientName]);

  const selectedClient = useMemo(() => {
    if (!formData.clientId) return null;
    return clientOptions.find((client) => client.id === String(formData.clientId)) || null;
  }, [clientOptions, formData.clientId]);
  const inheritedPdfTemplate = selectedClient?.defaultPdfTemplate || DEFAULT_PDF_TEMPLATE;
  const effectivePdfTemplate = formData.pdfTemplateOverride || inheritedPdfTemplate;

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
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const getStepErrors = (step) => {
    const nextErrors = {};

    if (step === 0) {
      if (!formData.projectName.trim()) {
        nextErrors.projectName = "Nombre del proyecto es requerido";
      }
    }

    if (step === 1) {
      if (!String(formData.clientId || "").trim()) {
        nextErrors.clientId = "Debe seleccionar un cliente";
      }
    }

    return nextErrors;
  };

  const validateStep = (step) => {
    if (isView) {
      setErrors({});
      return true;
    }

    const nextErrors = getStepErrors(step);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateBeforeSubmit = () => {
    if (isView) return true;

    for (const step of [0, 1]) {
      const nextErrors = getStepErrors(step);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setCurrentStep(step);
        return false;
      }
    }

    setErrors({});
    return true;
  };

  const handleSelectLogo = (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toastError("Archivo no permitido", "Usa JPEG o PNG.", { autoClose: 3000 });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toastError("Archivo demasiado grande", "El logo no puede superar 2 MB.", { autoClose: 3000 });
      return;
    }

    if (localLogoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(localLogoUrl);
    }

    setPendingLogoFile(file);
    setLocalLogoUrl(URL.createObjectURL(file));
    setRemoveLogoRequested(false);
    setLogoFailed(false);
  };

  const handleRemoveLogo = () => {
    if (localLogoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(localLogoUrl);
    }

    setPendingLogoFile(null);
    setLocalLogoUrl("");
    setRemoveLogoRequested(true);
    setLogoFailed(false);
  };

  const handleSubmit = async () => {
    if (isView) return;
    if (!validateBeforeSubmit()) return;

    try {
      const persisted = await onSubmit?.({ ...formData });
      let finalEntity = persisted ?? null;
      const projectId = persisted?.id ?? data?.id ?? formData.id;

      if (projectId) {
        if (removeLogoRequested && formData.logoUrl) {
          await projectService.deleteLogo(projectId);
          finalEntity = await projectService.getById(projectId);
        } else if (pendingLogoFile) {
          await projectService.uploadLogo(projectId, pendingLogoFile);
          finalEntity = await projectService.getById(projectId);
        } else if (!finalEntity) {
          finalEntity = await projectService.getById(projectId);
        }
      }

      await onSaved?.(
        finalEntity ??
          persisted ?? {
            ...formData,
            logoUrl: currentLogoUrl,
          }
      );

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

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    handleSubmit();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="w-full rounded-[26px] bg-white/8 p-[2px] shadow-[0_0_24px_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-[3px] dark:bg-white/[0.06] dark:shadow-[0_0_28px_rgba(255,255,255,0.06),0_24px_70px_rgba(2,6,23,0.52)]">
      <div className="flex h-[78vh] min-h-[620px] w-full flex-col rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200/80 px-8 py-6 dark:border-slate-700/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <ProjectLogoBadge
                logoUrl={currentLogoUrl}
                projectName={formData.projectName}
                logoFailed={logoFailed}
                onLogoError={() => setLogoFailed(true)}
              />
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                  {isCreate ? "Nuevo proyecto" : isEdit ? "Editar proyecto" : "Detalle de proyecto"}
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {headerTitle}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {formData.isConfidential ? (
                <span className="rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-800/80 dark:bg-sky-900/20 dark:text-sky-300">
                  Confidencial
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  formData.projectStatus === "activo"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                )}
              >
                {formData.projectStatus === "activo" ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {STEPS.map((step, index) => (
              <StepItem
                key={step.title}
                index={index}
                currentStep={currentStep}
                title={step.title}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {currentStep === 0 ? (
            <div className="space-y-6">
              <Section
                title="Visibilidad"
                description="Controla si el proyecto debe quedar restringido dentro del sistema."
              >
                {isView ? (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/50">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Proyecto confidencial
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Restringe su visibilidad según roles y permisos.
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        formData.isConfidential
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                      )}
                    >
                      {formData.isConfidential ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                ) : (
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isConfidential}
                      onChange={(e) => handleChange("isConfidential", e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Proyecto confidencial
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Restringe su visibilidad según roles y permisos.
                      </div>
                    </div>
                  </label>
                )}
              </Section>

              <Section
                title="Información principal"
                description="Datos base del proyecto dentro del sistema."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Nombre del proyecto" hint="Obligatorio" error={errors.projectName}>
                    {isView ? (
                      <ReadValue value={formData.projectName} />
                    ) : (
                      <input
                        type="text"
                        value={formData.projectName}
                        onChange={(e) => handleChange("projectName", e.target.value)}
                        className={fieldClass(Boolean(errors.projectName))}
                      />
                    )}
                  </Field>

                  {(isEdit || isView) && formData.projectCode ? (
                    <Field label="Código del proyecto" hint={isView ? "Generado" : "Editable"}>
                      {isView ? (
                        <ReadValue value={formData.projectCode} />
                      ) : (
                        <input
                          type="text"
                          value={formData.projectCode}
                          onChange={(e) => handleChange("projectCode", e.target.value)}
                          className={fieldClass()}
                        />
                      )}
                    </Field>
                  ) : null}

                  <div className="md:col-span-2">
                    <Field label="Descripción" hint="Opcional">
                      {isView ? (
                        <ReadValue value={formData.projectDescription} multiline />
                      ) : (
                        <textarea
                          value={formData.projectDescription}
                          onChange={(e) => handleChange("projectDescription", e.target.value)}
                          rows={5}
                          className={cn(fieldClass(), "resize-none")}
                        />
                      )}
                    </Field>
                  </div>

                  <Field label="Estado" hint="Obligatorio">
                    {isView ? (
                      <ReadValue
                        value={formData.projectStatus === "activo" ? "Activo" : "Inactivo"}
                      />
                    ) : (
                      <select
                        value={formData.projectStatus}
                        onChange={(e) => handleChange("projectStatus", e.target.value)}
                        className={fieldClass()}
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    )}
                  </Field>
                </div>
              </Section>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-6">
              {!isView ? (
                <Section
                  title="Logo / Avatar"
                  description="Imagen representativa del proyecto usada en listados y fichas."
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <ProjectLogoBadge
                        logoUrl={currentLogoUrl}
                        projectName={formData.projectName}
                        logoFailed={logoFailed}
                        onLogoError={() => setLogoFailed(true)}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLogoUrl ? "Logo cargado" : "Sin logo cargado"}
                        </div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Formatos permitidos: JPEG o PNG. Máximo 2 MB. Los cambios se aplican solo al guardar.
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700">
                        {currentLogoUrl ? "Cambiar logo" : "Cargar logo"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={(e) => {
                            handleSelectLogo(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {(currentLogoUrl || formData.logoUrl) ? (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          Quitar logo
                        </button>
                      ) : null}
                    </div>
                  </div>
                </Section>
              ) : null}

              <Section
                title="Cliente asociado"
                description="Define la organización dueña del proyecto."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="Cliente" hint="Obligatorio" error={errors.clientId}>
                      {isView ? (
                        <ReadValue value={formData.clientName || selectedClient?.company} />
                      ) : loadingClients ? (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-gray-500 dark:border-slate-700/80 dark:bg-slate-800 dark:text-gray-400">
                          <Icon name="FaSpinner" className="h-4 w-4 animate-spin" />
                          Cargando clientes...
                        </div>
                      ) : (
                        <>
                          <select
                            value={formData.clientId}
                            onChange={(e) => {
                              const id = e.target.value;
                              const client =
                                clientOptions.find((item) => item.id === id) || null;
                              handleChange("clientId", id);
                              handleChange("clientName", client?.company || "");
                            }}
                            className={fieldClass(Boolean(errors.clientId))}
                          >
                            <option value="">Seleccionar cliente...</option>
                            {clientOptions.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.company}
                                {client.isConfidential ? " 🔒" : ""}
                              </option>
                            ))}
                          </select>
                          {errors.clientId ? (
                            <p className="text-sm text-red-500">{errors.clientId}</p>
                          ) : null}
                        </>
                      )}
                    </Field>
                  </div>

                  <div className="md:col-span-2">
                    <Field label="Template PDF del proyecto" hint="Hereda o sobrescribe">
                      {isView ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <ReadValue
                            value={
                              formData.pdfTemplateOverride
                                ? "Propio del proyecto"
                                : selectedClient
                                  ? "Heredado del cliente"
                                  : "Heredado del sistema"
                            }
                          />
                          <ReadValue value={getPdfTemplateLabel(effectivePdfTemplate)} />
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white px-4 py-4 dark:border-slate-700/80 dark:bg-slate-900/50">
                          <label className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="pdf-template-mode"
                              checked={!formData.pdfTemplateOverride}
                              onChange={() => handleChange("pdfTemplateOverride", "")}
                              className="mt-1 h-4 w-4 border-gray-300"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                Heredar template
                              </div>
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Usará {getPdfTemplateLabel(inheritedPdfTemplate)} desde{" "}
                                {selectedClient ? `el cliente ${selectedClient.company}` : "el estándar del sistema"}.
                              </div>
                            </div>
                          </label>

                          <label className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="pdf-template-mode"
                              checked={Boolean(formData.pdfTemplateOverride)}
                              onChange={() =>
                                handleChange("pdfTemplateOverride", formData.pdfTemplateOverride || DEFAULT_PDF_TEMPLATE)
                              }
                              className="mt-1 h-4 w-4 border-gray-300"
                            />
                            <div className="w-full">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                Usar template propio
                              </div>
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Sobrescribe la configuración heredada solo para este proyecto.
                              </div>
                              {formData.pdfTemplateOverride ? (
                                <select
                                  value={formData.pdfTemplateOverride}
                                  onChange={(e) => handleChange("pdfTemplateOverride", e.target.value)}
                                  className={cn(fieldClass(), "mt-3")}
                                >
                                  {PDF_TEMPLATE_OPTIONS.map((template) => (
                                    <option key={template.id} value={template.id}>
                                      {template.name}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                            </div>
                          </label>
                        </div>
                      )}
                    </Field>
                  </div>
                </div>

                {selectedClient && !isView ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                      <Icon name="FaBuilding" className="h-4 w-4 flex-shrink-0" />
                      <span>
                        Cliente seleccionado: <strong>{selectedClient.company}</strong>
                        {selectedClient.isConfidential ? (
                          <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
                            · Confidencial
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                ) : null}
              </Section>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <Section title="Notas internas" description="Contexto adicional útil para el equipo del proyecto.">
                <Field label="Notas" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.projectNotes} multiline />
                  ) : (
                    <textarea
                      value={formData.projectNotes}
                      onChange={(e) => handleChange("projectNotes", e.target.value)}
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
                        value={formData.projectTags}
                        onChange={(e) => handleChange("projectTags", e.target.value)}
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
              <Section
                title="Automatización"
                description="Controla los envíos automáticos de minutas asociados al proyecto."
              >
                <div className="space-y-4">
                  <ToggleCard
                    title="Enviar automáticamente al pasar a revisión"
                    description="Usa esta regla en la transición desde edición hacia preview."
                    checked={formData.autoSendOnPreview}
                    isView={isView}
                    onToggle={() =>
                      handleChange("autoSendOnPreview", !formData.autoSendOnPreview)
                    }
                  />

                  <ToggleCard
                    title="Enviar automáticamente al publicar la minuta"
                    description="Usa esta regla en la transición a estado completed."
                    checked={formData.autoSendOnCompleted}
                    isView={isView}
                    onToggle={() =>
                      handleChange("autoSendOnCompleted", !formData.autoSendOnCompleted)
                    }
                  />
                </div>
              </Section>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="space-y-6">
              <Section title="Resumen" description="Verifique los datos antes de confirmar.">
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                  <SummaryItem label="Nombre del proyecto" value={formData.projectName} />
                  <SummaryLogoItem
                    logoUrl={currentLogoUrl}
                    projectName={formData.projectName}
                    logoFailed={logoFailed}
                    onLogoError={() => setLogoFailed(true)}
                  />
                  <SummaryItem label="Código" value={formData.projectCode} />
                  <SummaryItem
                    label="Estado"
                    value={formData.projectStatus === "activo" ? "Activo" : "Inactivo"}
                  />
                  <SummaryItem label="Cliente" value={selectedClient?.company || formData.clientName} />
                  <SummaryItem
                    label="Template PDF efectivo"
                    value={getPdfTemplateLabel(effectivePdfTemplate)}
                  />
                  <SummaryItem
                    label="Origen del template"
                    value={
                      formData.pdfTemplateOverride
                        ? "Propio del proyecto"
                        : selectedClient
                          ? "Heredado del cliente"
                          : "Heredado del sistema"
                    }
                  />
                  <SummaryItem
                    label="Confidencial"
                    value={formData.isConfidential ? "Sí" : "No"}
                  />
                  <SummaryItem label="Descripción" value={formData.projectDescription} multiline />
                  <SummaryItem label="Notas" value={formData.projectNotes} multiline />
                  <div className="border-b border-slate-200/70 pb-4 dark:border-slate-800/90 min-h-[72px]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                      Etiquetas
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tagsPreview.length ? (
                        tagsPreview.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-300/80 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <div className="text-sm text-gray-800 dark:text-gray-200">{EMPTY_VALUE}</div>
                      )}
                    </div>
                  </div>
                  <SummaryItem
                    label="Auto envío a revisión"
                    value={formData.autoSendOnPreview ? "Sí" : "No"}
                  />
                  <SummaryItem
                    label="Auto envío al publicar"
                    value={formData.autoSendOnCompleted ? "Sí" : "No"}
                  />
                  {isView && formData.createdAt ? (
                    <SummaryItem
                      label="Creado"
                      value={formatDateMedium(formData.createdAt)}
                    />
                  ) : null}
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
                {isCreate ? "Crear proyecto" : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal;
export { MODES as PROJECT_MODAL_MODES };
