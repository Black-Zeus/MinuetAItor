import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import ActionButton from "@/components/ui/button/ActionButton";
import participantsService from "@/services/participantsService";

export const PARTICIPANTS_MODAL_MODES = {
  CREATE: "createParticipant",
  VIEW: "viewParticipant",
  EDIT: "editParticipant",
};

const STEPS = [
  { title: "Participante" },
  { title: "Correos" },
  { title: "Notas" },
  { title: "Confirmación" },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

const EMPTY_VALUE = (
  <span className="italic text-gray-400 dark:text-gray-500">Sin información</span>
);

const normalizeEmails = (emails = []) => {
  const items = Array.isArray(emails) ? emails : [];
  if (items.length === 0) {
    return [{ id: null, email: "", isPrimary: true, isActive: true }];
  }

  return items.map((item, index) => ({
    id: item.id ?? null,
    email: item.email ?? "",
    isPrimary: Boolean(item.isPrimary ?? item.is_primary ?? index === 0),
    isActive: Boolean(item.isActive ?? item.is_active ?? true),
  }));
};

const normalizeParticipant = (data = {}) => ({
  id: data.id ?? "",
  displayName: data.displayName ?? data.display_name ?? "",
  normalizedName: data.normalizedName ?? data.normalized_name ?? "",
  logoUrl: data.logoUrl ?? data.logo_url ?? "",
  organization: data.organization ?? "",
  title: data.title ?? "",
  notes: data.notes ?? "",
  isActive: data.isActive ?? data.is_active ?? true,
  emails: normalizeEmails(data.emails),
  createdAt: data.createdAt ?? data.created_at ?? "",
});

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

const ParticipantLogoBadge = ({
  logoUrl,
  displayName,
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
        alt={displayName || "Avatar del participante"}
        className="h-full w-full object-cover"
        onError={onLogoError}
      />
    ) : (
      <Icon name="FaUser" className={iconClassName} />
    )}
  </div>
);

const SummaryLogoItem = ({ logoUrl, displayName, logoFailed, onLogoError }) => (
  <div className="min-h-[72px] border-b border-slate-200/70 pb-4 dark:border-slate-800/90">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
      Logo / Avatar
    </div>
    <div className="mt-3">
      <ParticipantLogoBadge
        logoUrl={logoUrl}
        displayName={displayName}
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

const ParticipantsModal = ({ mode, data, onSubmit, onClose, onSaved }) => {
  const isCreate = mode === PARTICIPANTS_MODAL_MODES.CREATE;
  const isView = mode === PARTICIPANTS_MODAL_MODES.VIEW;
  const isEdit = mode === PARTICIPANTS_MODAL_MODES.EDIT;

  const initialState = useMemo(() => normalizeParticipant(data), [data]);
  const [formData, setFormData] = useState(() => initialState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [localLogoUrl, setLocalLogoUrl] = useState("");
  const [removeLogoRequested, setRemoveLogoRequested] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setFormData(normalizeParticipant(data));
    setErrors({});
    setCurrentStep(0);
    setPendingLogoFile(null);
    setLocalLogoUrl("");
    setRemoveLogoRequested(false);
    setLogoFailed(false);
  }, [data]);

  useEffect(() => () => {
    if (localLogoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(localLogoUrl);
    }
  }, [localLogoUrl]);

  const closeModal = () => {
    onClose?.();
    ModalManager.closeAll?.();
  };

  const currentLogoUrl = removeLogoRequested ? "" : localLogoUrl || formData.logoUrl || "";
  const headerTitle = isCreate
    ? formData.displayName?.trim() || "Participante"
    : formData.displayName?.trim() || "Participante sin nombre";

  const activeEmails = useMemo(
    () => (formData.emails ?? []).filter((item) => Boolean(item.isActive) && String(item.email ?? "").trim()),
    [formData.emails]
  );

  const primaryEmail = useMemo(
    () => activeEmails.find((item) => item.isPrimary) ?? activeEmails[0] ?? null,
    [activeEmails]
  );

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const setEmailField = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      emails: prev.emails.map((email, currentIndex) => {
        if (currentIndex !== index) return email;
        return { ...email, [field]: value };
      }),
    }));
    setErrors((prev) => ({ ...prev, emails: null }));
  };

  const addEmail = () => {
    setFormData((prev) => ({
      ...prev,
      emails: [...prev.emails, { id: null, email: "", isPrimary: prev.emails.length === 0, isActive: true }],
    }));
  };

  const removeEmail = (index) => {
    setFormData((prev) => {
      const next = prev.emails.filter((_, currentIndex) => currentIndex !== index);
      if (next.length > 0 && !next.some((item) => item.isPrimary && item.isActive)) {
        next[0] = { ...next[0], isPrimary: true, isActive: true };
      }
      return {
        ...prev,
        emails: next.length > 0 ? next : [{ id: null, email: "", isPrimary: true, isActive: true }],
      };
    });
    setErrors((prev) => ({ ...prev, emails: null }));
  };

  const markPrimaryEmail = (index) => {
    setFormData((prev) => ({
      ...prev,
      emails: prev.emails.map((item, currentIndex) => ({
        ...item,
        isPrimary: currentIndex === index,
        isActive: currentIndex === index ? true : item.isActive,
      })),
    }));
    setErrors((prev) => ({ ...prev, emails: null }));
  };

  const getStepErrors = (step) => {
    const nextErrors = {};

    if (step === 0 && !String(formData.displayName ?? "").trim()) {
      nextErrors.displayName = "El nombre es obligatorio.";
    }

    if (step === 1) {
      const normalizedActiveEmails = (formData.emails ?? [])
        .map((item) => ({
          ...item,
          email: String(item.email ?? "").trim().toLowerCase(),
        }))
        .filter((item) => item.email);

      const seen = new Set();
      for (const email of normalizedActiveEmails) {
        if (seen.has(email.email)) {
          nextErrors.emails = "No puedes repetir correos.";
          break;
        }
        seen.add(email.email);
      }

      const activeWithFlag = normalizedActiveEmails.filter((item) => item.isActive);
      const primaryActive = activeWithFlag.filter((item) => item.isPrimary);
      if (activeWithFlag.length > 0 && primaryActive.length !== 1) {
        nextErrors.emails = "Debes marcar un correo principal activo.";
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

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        emails: (formData.emails ?? []).map((item) => ({
          ...item,
          email: String(item.email ?? "").trim().toLowerCase(),
        })),
      };

      const persisted = await onSubmit?.(payload);
      let finalEntity = persisted ?? null;
      const participantId = persisted?.id ?? data?.id ?? formData.id;

      if (participantId) {
        if (removeLogoRequested && formData.logoUrl) {
          await participantsService.deleteLogo(participantId);
          finalEntity = await participantsService.getById(participantId);
        } else if (pendingLogoFile) {
          await participantsService.uploadLogo(participantId, pendingLogoFile);
          finalEntity = await participantsService.getById(participantId);
        } else if (!finalEntity) {
          finalEntity = await participantsService.getById(participantId);
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
        isCreate ? "Participante creado correctamente." : "Participante actualizado correctamente.",
        { autoClose: 3000 }
      );
      ModalManager.closeAll?.();
    } catch (error) {
      toastError(
        "Error",
        error?.response?.data?.error?.message ??
          error?.response?.data?.detail ??
          error?.message ??
          "No fue posible completar la operación."
      );
    } finally {
      setIsSubmitting(false);
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
              <ParticipantLogoBadge
                logoUrl={currentLogoUrl}
                displayName={formData.displayName}
                logoFailed={logoFailed}
                onLogoError={() => setLogoFailed(true)}
              />
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                  {isCreate ? "Nuevo participante" : isEdit ? "Editar participante" : "Detalle de participante"}
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {headerTitle}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  formData.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                )}
              >
                {formData.isActive ? "Activo" : "Inactivo"}
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
              {!isView ? (
                <Section title="Logo / Avatar" description="Imagen representativa usada en listados y fichas.">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <ParticipantLogoBadge
                        logoUrl={currentLogoUrl}
                        displayName={formData.displayName}
                        logoFailed={logoFailed}
                        onLogoError={() => setLogoFailed(true)}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLogoUrl ? "Logo cargado" : "Usando avatar por defecto"}
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

              <Section title="Perfil" description="Datos principales del participante dentro del catálogo.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="Nombre completo" hint="Obligatorio" error={errors.displayName}>
                      {isView ? (
                        <ReadValue value={formData.displayName} />
                      ) : (
                        <input
                          type="text"
                          value={formData.displayName}
                          onChange={(e) => setField("displayName", e.target.value)}
                          className={fieldClass(Boolean(errors.displayName))}
                        />
                      )}
                    </Field>
                  </div>

                  <Field label="Organización" hint="Opcional">
                    {isView ? (
                      <ReadValue value={formData.organization} />
                    ) : (
                      <input
                        type="text"
                        value={formData.organization}
                        onChange={(e) => setField("organization", e.target.value)}
                        className={fieldClass()}
                      />
                    )}
                  </Field>

                  <Field label="Cargo" hint="Opcional">
                    {isView ? (
                      <ReadValue value={formData.title} />
                    ) : (
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setField("title", e.target.value)}
                        className={fieldClass()}
                      />
                    )}
                  </Field>

                  <Field label="Estado" hint="Obligatorio">
                    {isView ? (
                      <ReadValue value={formData.isActive ? "Activo" : "Inactivo"} />
                    ) : (
                      <select
                        value={formData.isActive ? "active" : "inactive"}
                        onChange={(e) => setField("isActive", e.target.value === "active")}
                        className={fieldClass()}
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    )}
                  </Field>
                </div>
              </Section>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-6">
              <Section title="Correos" description="Direcciones activas del participante y correo principal.">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Correos registrados</h4>
                    {!isView ? (
                      <ActionButton
                        label="Agregar correo"
                        size="sm"
                        variant="soft"
                        icon={<Icon name="FaPlus" />}
                        onClick={addEmail}
                      />
                    ) : null}
                  </div>

                  {errors.emails ? <p className="text-sm text-red-500">{errors.emails}</p> : null}

                  <div className="space-y-3">
                    {(formData.emails ?? []).map((email, index) => (
                      <div
                        key={`${email.id ?? "new"}-${index}`}
                        className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900/50"
                      >
                        {isView ? (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm text-gray-900 dark:text-white">{email.email || "—"}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {email.isPrimary ? "Principal" : "Secundario"} · {email.isActive ? "Activo" : "Inactivo"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                            <input
                              type="email"
                              value={email.email}
                              onChange={(e) => setEmailField(index, "email", e.target.value)}
                              className={fieldClass()}
                              placeholder="correo@empresa.com"
                            />
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input
                                type="radio"
                                checked={Boolean(email.isPrimary)}
                                onChange={() => markPrimaryEmail(index)}
                              />
                              Principal
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={Boolean(email.isActive)}
                                onChange={(e) => setEmailField(index, "isActive", e.target.checked)}
                              />
                              Activo
                            </label>
                            <ActionButton
                              variant="soft"
                              size="xs"
                              icon={<Icon name="delete" />}
                              onClick={() => removeEmail(index)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <Section title="Notas internas" description="Contexto adicional útil para el equipo.">
                <Field label="Notas" hint="Opcional">
                  {isView ? (
                    <ReadValue value={formData.notes} multiline />
                  ) : (
                    <textarea
                      rows={7}
                      value={formData.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      className={cn(fieldClass(), "resize-none")}
                    />
                  )}
                </Field>
              </Section>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-6">
              <Section title="Resumen" description="Verifique los datos antes de confirmar.">
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                  <SummaryItem label="Nombre completo" value={formData.displayName} />
                  <SummaryLogoItem
                    logoUrl={currentLogoUrl}
                    displayName={formData.displayName}
                    logoFailed={logoFailed}
                    onLogoError={() => setLogoFailed(true)}
                  />
                  <SummaryItem label="Organización" value={formData.organization} />
                  <SummaryItem label="Cargo" value={formData.title} />
                  <SummaryItem label="Estado" value={formData.isActive ? "Activo" : "Inactivo"} />
                  <SummaryItem label="Correo principal" value={primaryEmail?.email} />
                  {isView && formData.createdAt ? (
                    <SummaryItem
                      label="Creado"
                      value={new Date(formData.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    />
                  ) : null}
                </div>
              </Section>

              <Section title="Correos y notas" description="Detalle complementario del participante.">
                <div className="space-y-4">
                  <div className="border-b border-slate-200/70 pb-4 dark:border-slate-800/90">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                      Correos
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeEmails.length ? (
                        activeEmails.map((email) => (
                          <span
                            key={`${email.id ?? email.email}-${email.email}`}
                            className="rounded-full border border-slate-300/80 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                          >
                            {email.email}
                            {email.isPrimary ? " · Principal" : ""}
                          </span>
                        ))
                      ) : (
                        <div className="text-sm text-gray-800 dark:text-gray-200">{EMPTY_VALUE}</div>
                      )}
                    </div>
                  </div>

                  <SummaryItem label="Notas" value={formData.notes} multiline />
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
                disabled={isSubmitting}
                className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:opacity-60 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200"
              >
                {isSubmitting
                  ? "Guardando..."
                  : isCreate
                    ? "Crear participante"
                    : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsModal;
