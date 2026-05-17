import React, { useMemo, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import smtpConfigService from "@/services/smtpConfigService";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";

export const SMTP_MODAL_MODES = {
  CREATE: "create",
  EDIT: "edit",
};

const INPUT_BASE =
  "w-full rounded-xl border px-3.5 py-2.5 text-sm " +
  "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 " +
  "focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800";

const INPUT_OK = "border-gray-300 dark:border-gray-700";
const INPUT_ERROR = "border-red-500 dark:border-red-400";
const LABEL = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
const ERR = "mt-1 text-xs text-red-500";

const TEST_STATUS_STYLES = {
  idle: {
    tone: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
    icon: "FaEnvelope",
  },
  loading: {
    tone: "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300",
    icon: "spinner",
  },
  success: {
    tone: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
    icon: "FaCheckCircle",
  },
  error: {
    tone: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
    icon: "triangleExclamation",
  },
};

export const SMTP_TEST_IDLE_MESSAGE = "Presiona Enviar prueba para validar esta configuración con un correo real.";

const TEST_SENSITIVE_FIELDS = new Set([
  "host",
  "port",
  "username",
  "password",
  "fromName",
  "fromEmail",
  "useTls",
  "useSsl",
  "timeoutSeconds",
]);

const toFormData = (config) => ({
  id: config?.id ?? "",
  name: config?.name ?? "",
  host: config?.host ?? "",
  port: String(config?.port ?? 587),
  username: config?.username ?? "",
  password: "",
  fromName: config?.fromName ?? "",
  fromEmail: config?.fromEmail ?? "",
  useTls: Boolean(config?.useTls ?? false),
  useSsl: Boolean(config?.useSsl ?? false),
  timeoutSeconds: String(config?.timeoutSeconds ?? 10),
  isActive: Boolean(config?.isActive ?? false),
  hasPassword: Boolean(config?.hasPassword ?? false),
});

const validate = (formData) => {
  const errors = {};
  if (!String(formData.name || "").trim()) errors.name = "El nombre es obligatorio";
  if (!String(formData.host || "").trim()) errors.host = "El host es obligatorio";
  if (!String(formData.fromName || "").trim()) errors.fromName = "El remitente es obligatorio";
  if (!String(formData.fromEmail || "").trim()) errors.fromEmail = "El correo remitente es obligatorio";

  const port = Number(formData.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = "Puerto inválido";

  const timeout = Number(formData.timeoutSeconds);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120) {
    errors.timeoutSeconds = "Timeout entre 1 y 120 segundos";
  }

  if (formData.useTls && formData.useSsl) {
    errors.security = "No puedes habilitar TLS y SSL al mismo tiempo";
  }

  return errors;
};

const Field = ({ label, required = false, error, hint, children }) => (
  <div>
    <label className={LABEL}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    {error ? <p className={ERR}>{error}</p> : null}
  </div>
);

const CheckboxField = ({ label, checked, onChange, disabled = false }) => (
  <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/60 px-4 py-3 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
    />
    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
  </label>
);

const TestStatusPanel = ({ status, message }) => {
  const style = TEST_STATUS_STYLES[status] ?? TEST_STATUS_STYLES.idle;

  return (
    <div className={`rounded-2xl border px-4 py-4 ${style.tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon
            name={style.icon}
            className={`h-5 w-5 ${status === "loading" ? "animate-spin" : ""}`}
          />
        </div>
        <div>
          <p className="text-sm font-semibold">
            {status === "loading"
              ? "Probando configuración"
              : status === "success"
                ? "Prueba aprobada"
                : status === "error"
                  ? "La prueba falló"
                  : "Prueba requerida"}
          </p>
          <p className="mt-1 text-sm">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export const SmtpTestDialogPanel = ({
  email,
  onEmailChange,
  onClose,
  onRunTest,
  isTesting,
  status,
  message,
  submitLabel = "Enviar prueba",
  submittingLabel = "Validando SMTP...",
  title = "Test SMTP",
  description = "Envía una prueba real y valida el resultado antes de guardar esta configuración.",
}) => {
  return (
    <div className="w-full max-w-md rounded-[28px] border border-white/50 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <Icon name="flask" className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            {title}
          </h4>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          Cerrar
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Correo del usuario" required>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={`${INPUT_BASE} ${INPUT_OK}`}
            placeholder="usuario@empresa.cl"
          />
        </Field>

        <TestStatusPanel status={status} message={message} />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <ActionButton
          label={isTesting ? submittingLabel : submitLabel}
          onClick={onRunTest}
          variant="primary"
          size="sm"
          disabled={isTesting}
          icon={<Icon name={isTesting ? "spinner" : "paperPlane"} className={isTesting ? "animate-spin" : ""} />}
        />
      </div>
    </div>
  );
};

const TestMiniModal = ({
  isOpen,
  ...props
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-[2px]">
      <SmtpTestDialogPanel {...props} />
    </div>
  );
};

const SmtpConfigModal = ({
  mode = SMTP_MODAL_MODES.CREATE,
  config = null,
  onSubmit,
  onDelete,
  onClose,
}) => {
  const isEdit = mode === SMTP_MODAL_MODES.EDIT;
  const [formData, setFormData] = useState(() => toFormData(config));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState("idle");
  const [testMessage, setTestMessage] = useState(SMTP_TEST_IDLE_MESSAGE);

  const title = useMemo(
    () => (isEdit ? "Editar configuración SMTP" : "Nueva configuración SMTP"),
    [isEdit]
  );

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, security: undefined }));
    if (TEST_SENSITIVE_FIELDS.has(field)) {
      setTestResult(null);
      setTestStatus("idle");
      setTestMessage(SMTP_TEST_IDLE_MESSAGE);
    }
  };

  const buildTestPayload = () => ({
    config_id: isEdit ? formData.id : undefined,
    name: formData.name.trim(),
    host: formData.host.trim(),
    port: Number(formData.port),
    username: String(formData.username || "").trim() || null,
    password: String(formData.password || "").trim() || null,
    from_name: formData.fromName.trim(),
    from_email: formData.fromEmail.trim(),
    use_tls: Boolean(formData.useTls),
    use_ssl: Boolean(formData.useSsl),
    timeout_seconds: Number(formData.timeoutSeconds),
    test_email: String(testEmail || "").trim(),
  });

  const buildSavePayload = () => ({
    name: formData.name.trim(),
    host: formData.host.trim(),
    port: Number(formData.port),
    username: String(formData.username || "").trim() || null,
    password: String(formData.password || "").trim() || null,
    from_name: formData.fromName.trim(),
    from_email: formData.fromEmail.trim(),
    use_tls: Boolean(formData.useTls),
    use_ssl: Boolean(formData.useSsl),
    timeout_seconds: Number(formData.timeoutSeconds),
    is_active: Boolean(formData.isActive),
    test_token: testResult?.testToken,
  });

  const handleOpenTestDialog = () => {
    const nextErrors = validate(formData);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toastError("Completa la configuración primero", "Antes de probar, corrige los campos técnicos obligatorios.");
      return;
    }

    setTestStatus("idle");
    setTestMessage(SMTP_TEST_IDLE_MESSAGE);
    setIsTesting(false);
    setIsTestDialogOpen(true);
    setTestEmail(String(formData.fromEmail || "").trim());
  };

  const handleRunTest = async () => {
    const nextErrors = validate(formData);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setTestResult(null);
      setTestStatus("error");
      setTestMessage("Hay campos técnicos inválidos en la configuración. Corrígelos antes de probar.");
      return;
    }

    if (!String(testEmail || "").trim()) {
      setTestResult(null);
      setTestStatus("error");
      setTestMessage("Debes indicar un correo de usuario para ejecutar la prueba.");
      return;
    }

    setIsTesting(true);
    setTestStatus("loading");
    setTestMessage("Probando conexión, autenticación y entrega del correo HTML...");

    try {
      const result = await smtpConfigService.test(buildTestPayload());
      setTestResult(result);
      setTestStatus("success");
      const successMessage = result?.message ?? "La prueba fue exitosa y ya puedes guardar.";
      setTestMessage(successMessage);
      toastSuccess("Prueba SMTP aprobada", successMessage);
    } catch (error) {
      setTestResult(null);
      setTestStatus("error");
      const errorMessage = error?.message ?? "No fue posible validar esta configuración SMTP.";
      setTestMessage(errorMessage);
      toastError("No se pudo validar SMTP", errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const nextErrors = validate(formData);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (!testResult?.testToken) {
      toastError("Debes probar la configuración", "No puedes guardar hasta que el testing sea exitoso.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.(buildSavePayload());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(formData.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative w-full rounded-[26px] bg-white/8 p-[2px] shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:bg-white/[0.06] dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
      <div className="flex max-h-[78vh] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
          <div>
            <h3 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
              <Icon name="FaEnvelope" className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              {title}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Edita la conexión, valida con una prueba real y deja vigente solo la configuración que quieres usar.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto px-8 py-5">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre" required error={errors.name}>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={`${INPUT_BASE} ${errors.name ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="Ej: SMTP corporativo"
                />
              </Field>

              <Field label="Host" required error={errors.host}>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => handleChange("host", e.target.value)}
                  className={`${INPUT_BASE} ${errors.host ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="smtp.tu-dominio.com"
                />
              </Field>

              <Field label="Puerto" required error={errors.port}>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => handleChange("port", e.target.value)}
                  className={`${INPUT_BASE} ${errors.port ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="587"
                />
              </Field>

              <Field label="Timeout (segundos)" required error={errors.timeoutSeconds}>
                <input
                  type="number"
                  value={formData.timeoutSeconds}
                  onChange={(e) => handleChange("timeoutSeconds", e.target.value)}
                  className={`${INPUT_BASE} ${errors.timeoutSeconds ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="10"
                />
              </Field>

              <Field label="Usuario">
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  className={`${INPUT_BASE} ${INPUT_OK}`}
                  placeholder="mailer.service"
                />
              </Field>

              <Field
                label="Contraseña"
                hint={isEdit && formData.hasPassword ? "Si la dejas vacía, se mantiene la contraseña actual." : null}
              >
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={`${INPUT_BASE} ${INPUT_OK}`}
                  placeholder={isEdit && formData.hasPassword ? "Mantener actual" : "Ingresa la contraseña"}
                />
              </Field>

              <Field label="Nombre remitente" required error={errors.fromName}>
                <input
                  type="text"
                  value={formData.fromName}
                  onChange={(e) => handleChange("fromName", e.target.value)}
                  className={`${INPUT_BASE} ${errors.fromName ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="MinuetAItor"
                />
              </Field>

              <Field label="Email remitente" required error={errors.fromEmail}>
                <input
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) => handleChange("fromEmail", e.target.value)}
                  className={`${INPUT_BASE} ${errors.fromEmail ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="no-reply@tu-dominio.com"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <CheckboxField
                label="SMTP activo"
                checked={formData.isActive}
                onChange={(value) => handleChange("isActive", value)}
              />
              <CheckboxField
                label="Usar TLS"
                checked={formData.useTls}
                onChange={(value) => handleChange("useTls", value)}
              />
              <CheckboxField
                label="Usar SSL"
                checked={formData.useSsl}
                onChange={(value) => handleChange("useSsl", value)}
              />
            </div>

            {errors.security ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {errors.security}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-slate-200/80 px-8 py-4 dark:border-slate-700/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton
                label="Test"
                onClick={handleOpenTestDialog}
                variant="soft"
                size="sm"
                icon={<Icon name="flask" />}
              />
              {isEdit ? (
                <ActionButton
                  label={isDeleting ? "Eliminando..." : "Eliminar"}
                  onClick={handleDelete}
                  variant="danger"
                  size="sm"
                  disabled={isDeleting || isSubmitting}
                  icon={<Icon name={isDeleting ? "spinner" : "FaTrash"} className={isDeleting ? "animate-spin" : ""} />}
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <ActionButton
                label="Cancelar"
                onClick={onClose}
                variant="neutral"
                size="sm"
              />
              <ActionButton
                label={isSubmitting ? "Guardando..." : "Guardar configuración"}
                onClick={handleSave}
                variant="primary"
                size="sm"
                disabled={isSubmitting || !testResult?.testToken}
                icon={<Icon name="save" />}
              />
            </div>
          </div>
        </div>
      </div>

      <TestMiniModal
        isOpen={isTestDialogOpen}
        email={testEmail}
        onEmailChange={setTestEmail}
        onClose={() => setIsTestDialogOpen(false)}
        onRunTest={handleRunTest}
        isTesting={isTesting}
        status={testStatus}
        message={testMessage}
      />
    </div>
  );
};

export default SmtpConfigModal;
