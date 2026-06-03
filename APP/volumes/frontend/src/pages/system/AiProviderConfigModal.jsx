import React, { useMemo, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import aiProviderConfigService from "@/services/aiProviderConfigService";
import { extractErrorMessage } from "@/utils/errors";
import {
  CheckboxField,
  Field,
  MetadataCard,
  ValidationStatusCard,
  ValidationSummaryGrid,
} from "./components/AiProviderConfigModalFields";

export const AI_PROVIDER_MODAL_MODES = {
  CREATE: "create",
  EDIT: "edit",
};

export const AI_VALIDATION_IDLE_MESSAGE =
  "Valida esta configuración para confirmar conectividad, autenticación y respuesta del proveedor.";

const INPUT_BASE =
  "w-full rounded-xl border px-3.5 py-2.5 text-sm " +
  "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 " +
  "focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800";

const INPUT_OK = "border-gray-300 dark:border-gray-700";
const INPUT_ERROR = "border-red-500 dark:border-red-400";
const FALLBACK_PROVIDER_OPTIONS = [
  {
    value: "openai",
    label: "OpenAI / ChatGPT",
    baseUrl: "https://api.openai.com/v1",
    validationEndpoint: "/models",
    modelsEndpoint: "/models",
    authType: "api_key",
  },
  {
    value: "anthropic",
    label: "Anthropic / Claude",
    baseUrl: "https://api.anthropic.com/v1",
    validationEndpoint: "/models",
    modelsEndpoint: "/models",
    authType: "api_key",
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    validationEndpoint: "/models",
    modelsEndpoint: "/models",
    authType: "api_key",
  },
  {
    value: "perplexity",
    label: "Perplexity",
    baseUrl: "https://api.perplexity.ai/v1",
    validationEndpoint: "/models",
    modelsEndpoint: "/models",
    authType: "api_key",
  },
  {
    value: "ollama_local",
    label: "Ollama local",
    baseUrl: "http://localhost:11434",
    validationEndpoint: "/api/tags",
    modelsEndpoint: "/api/tags",
    authType: "none",
  },
  {
    value: "ollama_remote",
    label: "Ollama remoto",
    baseUrl: "http://host.docker.internal:11434",
    validationEndpoint: "/api/tags",
    modelsEndpoint: "/api/tags",
    authType: "none",
  },
  {
    value: "custom",
    label: "Custom",
    baseUrl: "",
    validationEndpoint: "",
    modelsEndpoint: "",
    authType: "none",
  },
];

const VALIDATION_LABELS = {
  unvalidated: "Sin validar",
  valid: "Validación correcta",
  error: "Validación con error",
  auth_error: "Error de autenticación",
  connection_error: "Error de conexión",
  timeout: "Timeout",
  endpoint_unavailable: "Endpoint no disponible",
};
const AI_PROVIDER_VALIDATION_FALLBACK =
  "No fue posible validar la configuración AI. Revisa la URL base, las credenciales y el endpoint de validación del proveedor.";

const getAiProviderValidationErrorMessage = (error) => {
  const message = error?.response?.data
    ? extractErrorMessage(error.response.data, "")
    : "";
  const cleaned = String(message || "").trim();
  if (cleaned) return cleaned;
  if (error?.code === "ECONNABORTED") {
    return "La validación superó el tiempo máximo de espera. Revisa que el proveedor responda y vuelve a intentar.";
  }
  if (!error?.response && error?.request) {
    return "No se pudo conectar con el servicio de validación. Revisa conectividad, URL base y disponibilidad del proveedor.";
  }
  return AI_PROVIDER_VALIDATION_FALLBACK;
};

const normalizeProviderOptions = (items = []) => {
  const normalized = items
    .map((item) => ({
      value: String(item?.id || item?.value || "").trim(),
      label: String(item?.label || item?.name || item?.id || item?.value || "").trim(),
      baseUrl: String(item?.baseUrl || item?.base_url || "").trim(),
      validationEndpoint: String(item?.validationEndpoint || item?.validation_endpoint || "").trim(),
      modelsEndpoint: String(item?.modelsEndpoint || item?.models_endpoint || "").trim(),
      authType: String(item?.authType || item?.auth_type || "none").trim() || "none",
      isCommercial: Boolean(item?.isCommercial ?? item?.is_commercial),
      providerFamily: String(item?.providerFamily || item?.provider_family || "").trim(),
    }))
    .filter((item) => item.value && item.label);

  return normalized.length ? normalized : FALLBACK_PROVIDER_OPTIONS;
};

const getProviderPreset = (providerType, providerOptions) =>
  providerOptions.find((option) => option.value === providerType) || providerOptions[0] || FALLBACK_PROVIDER_OPTIONS[0];

const buildValidationToastMessage = ({ name, ok, status }) => {
  const configName = String(name || "").trim() || "Configuración";
  const resultLabel = ok ? "validada correctamente" : VALIDATION_LABELS[status] || "con observaciones";
  return `${configName} / ${resultLabel}`;
};

const safeJsonStringify = (value) => {
  if (!value || typeof value !== "object") return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
};

const compactTokenHint = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("*****")) {
    const [head, tail] = raw.split("*****");
    const left = String(head || "").slice(0, 3);
    const right = String(tail || "").slice(-3);
    return `${left}*****${right}`;
  }
  if (raw.length <= 6) {
    return `${raw.slice(0, 3)}*****${raw.slice(-3)}`;
  }
  return `${raw.slice(0, 3)}*****${raw.slice(-3)}`;
};

const toFormData = (config, providerOptions) => {
  const preset = getProviderPreset(config?.providerType ?? "openai", providerOptions);
  return {
    id: config?.id ?? "",
    name: config?.name ?? "",
    providerType: config?.providerType ?? "openai",
    baseUrl: config?.baseUrl ?? preset.baseUrl,
    validationEndpoint: config?.validationEndpoint ?? preset.validationEndpoint,
    modelsEndpoint: config?.modelsEndpoint ?? preset.modelsEndpoint,
    modelName: config?.modelName ?? "",
    authType: config?.authType ?? preset.authType,
    token: "",
    username: config?.username ?? "",
    password: "",
    customHeadersText: safeJsonStringify(config?.customHeaders),
    allowModelDiscovery: true,
    isActive: Boolean(config?.isActive ?? false),
    validationStatus: config?.validationStatus ?? "unvalidated",
    lastValidatedAt: config?.lastValidatedAt ?? null,
    lastError: config?.lastError ?? "",
    timeoutSeconds: String(config?.timeoutSeconds ?? 15),
    hasToken: Boolean(config?.hasToken ?? false),
    tokenHint: compactTokenHint(config?.tokenHint ?? ""),
    hasPassword: Boolean(config?.hasPassword ?? false),
    createdAt: config?.createdAt ?? null,
  };
};

const parseHeaders = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { value: null, error: null };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: null, error: "Los headers personalizados deben ser un objeto JSON." };
    }
    const normalized = {};
    for (const [key, headerValue] of Object.entries(parsed)) {
      const cleanKey = String(key || "").trim();
      const cleanValue = String(headerValue || "").trim();
      if (!cleanKey) {
        return { value: null, error: "Cada header personalizado debe tener una clave válida." };
      }
      if (!cleanValue) {
        return { value: null, error: `El header "${cleanKey}" no puede quedar vacío.` };
      }
      normalized[cleanKey] = cleanValue;
    }
    return { value: normalized, error: null };
  } catch {
    return { value: null, error: "El JSON de headers personalizados no es válido." };
  }
};

const validate = (formData, { isEdit = false, commercialProviderTypes = new Set() } = {}) => {
  const errors = {};
  const isCommercialProvider = commercialProviderTypes.has(formData.providerType);
  const tokenValue = String(formData.token || "").trim();
  const passwordValue = String(formData.password || "").trim();

  if (!String(formData.name || "").trim()) errors.name = "El nombre interno es obligatorio";
  if (!String(formData.providerType || "").trim()) errors.providerType = "El tipo de proveedor es obligatorio";
  if (!String(formData.baseUrl || "").trim()) errors.baseUrl = "La URL base es obligatoria";

  try {
    if (String(formData.baseUrl || "").trim()) {
      const parsed = new URL(String(formData.baseUrl || "").trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.baseUrl = "La URL base debe iniciar con http:// o https://";
      }
    }
  } catch {
    errors.baseUrl = "La URL base no tiene un formato válido";
  }

  const timeout = Number(formData.timeoutSeconds);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120) {
    errors.timeoutSeconds = "Timeout entre 1 y 120 segundos";
  }

  if (formData.authType === "api_key") {
    if (!tokenValue && (!isEdit || !formData.hasToken)) {
      errors.token = "La API Key es obligatoria para esta configuración";
    }
  }

  if (isCommercialProvider) {
    if (formData.authType !== "api_key") {
      errors.authType = "Los proveedores comerciales deben usar API Key";
    }
    if (!tokenValue && (!isEdit || !formData.hasToken)) {
      errors.token = "La API Key es obligatoria para el proveedor seleccionado";
    }
  }

  if (formData.authType === "basic") {
    if (!String(formData.username || "").trim()) errors.username = "El usuario es obligatorio";
    if (!passwordValue && (!isEdit || !formData.hasPassword)) {
      errors.password = "La contraseña es obligatoria";
    }
  }

  if (formData.authType === "custom_headers") {
    const parsed = parseHeaders(formData.customHeadersText);
    if (parsed.error) errors.customHeadersText = parsed.error;
  } else if (String(formData.customHeadersText || "").trim()) {
    const parsed = parseHeaders(formData.customHeadersText);
    if (parsed.error) errors.customHeadersText = parsed.error;
  }

  return errors;
};

const buildPayload = (formData, validationToken, { isEdit = false } = {}) => {
  const parsedHeaders = parseHeaders(formData.customHeadersText);
  const payload = {
    name: String(formData.name || "").trim(),
    provider_type: String(formData.providerType || "").trim(),
    base_url: String(formData.baseUrl || "").trim(),
    validation_endpoint: String(formData.validationEndpoint || "").trim() || null,
    models_endpoint: String(formData.modelsEndpoint || "").trim() || null,
    model_name: String(formData.modelName || "").trim() || null,
    auth_type: String(formData.authType || "").trim() || "none",
    username: String(formData.username || "").trim() || null,
    custom_headers: parsedHeaders.value,
    allow_model_discovery: true,
    is_active: Boolean(formData.isActive),
    timeout_seconds: Number(formData.timeoutSeconds),
    validation_token: validationToken,
  };

  const tokenValue = String(formData.token || "").trim();
  const passwordValue = String(formData.password || "").trim();

  if (!isEdit || tokenValue) {
    payload.token = tokenValue || null;
  }
  if (!isEdit || passwordValue) {
    payload.password = passwordValue || null;
  }

  return payload;
};

const buildValidationPayload = (formData, { isEdit = false } = {}) => ({
  config_id: isEdit ? formData.id : undefined,
  name: String(formData.name || "").trim() || null,
  provider_type: String(formData.providerType || "").trim() || null,
  base_url: String(formData.baseUrl || "").trim() || null,
  validation_endpoint: String(formData.validationEndpoint || "").trim() || null,
  models_endpoint: String(formData.modelsEndpoint || "").trim() || null,
  model_name: String(formData.modelName || "").trim() || null,
  auth_type: String(formData.authType || "").trim() || null,
  token: String(formData.token || "").trim() || undefined,
  username: String(formData.username || "").trim() || undefined,
  password: String(formData.password || "").trim() || undefined,
  custom_headers: parseHeaders(formData.customHeadersText).value,
  allow_model_discovery: true,
  is_active: Boolean(formData.isActive),
  timeout_seconds: Number(formData.timeoutSeconds),
});

const buildValidationSummaryItems = (config, providerOptions) => [
    ["Proveedor", getProviderPreset(config?.providerType || "custom", providerOptions).label],
    ["URL base", config?.baseUrl || "—"],
    [
      "Autenticación",
      config?.authType === "api_key"
        ? "API Key"
        : config?.authType === "basic"
          ? "Basic"
          : config?.authType === "custom_headers"
            ? "Headers"
            : "Sin autenticación",
    ],
    ["Token", config?.hasToken ? compactTokenHint(config?.tokenHint) || "Guardado" : "No configurado"],
  ];

export const AiProviderValidationModal = ({ config, providerCatalog = [], onClose, onValidated }) => {
  const providerOptions = useMemo(() => normalizeProviderOptions(providerCatalog), [providerCatalog]);
  const [isRunning, setIsRunning] = useState(false);
  const [validationState, setValidationState] = useState({
    status: config?.validationStatus ?? "unvalidated",
    message: config?.lastError || AI_VALIDATION_IDLE_MESSAGE,
    lastValidatedAt: config?.lastValidatedAt ?? null,
  });

  const handleValidate = async () => {
    setIsRunning(true);
    try {
      const result = await aiProviderConfigService.validate({ config_id: config.id });
      setValidationState({
        status: result?.status ?? "error",
        message: result?.message ?? "La validación finalizó sin detalles adicionales.",
        lastValidatedAt: result?.lastValidatedAt ?? null,
      });
      if (result?.ok) {
        toastSuccess(
          "Validación AI correcta",
          buildValidationToastMessage({
            name: config?.name,
            ok: true,
            status: result?.status,
          })
        );
      } else {
        toastError(
          "Validación AI con observaciones",
          buildValidationToastMessage({
            name: config?.name,
            ok: false,
            status: result?.status,
          })
        );
      }
      onValidated?.(result?.config ?? null);
    } catch (error) {
      const message = getAiProviderValidationErrorMessage(error);
      setValidationState({
        status: "error",
        message,
        lastValidatedAt: config?.lastValidatedAt ?? null,
      });
      toastError("No se pudo validar AI", message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="flex max-h-[78vh] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
        <div className="border-b border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
          <h3 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
            <Icon name="flask" className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            Validar configuración AI
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Esta prueba es acotada: revisa conectividad, autenticación y respuesta del proveedor, sin ejecutar procesamiento de minutas ni prompts productivos.
          </p>
        </div>

        <div className="overflow-y-auto px-8 py-5">
          <div className="space-y-4">
            <ValidationSummaryGrid items={buildValidationSummaryItems(config, providerOptions)} />
            <ValidationStatusCard
              status={validationState.status}
              message={validationState.message}
              lastValidatedAt={validationState.lastValidatedAt}
            />
          </div>
        </div>

        <div className="border-t border-slate-200/80 px-8 py-4 dark:border-slate-700/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <ActionButton label="Cerrar" onClick={onClose} variant="neutral" size="sm" />
            <ActionButton
              label={isRunning ? "Validando..." : "Ejecutar validación"}
              onClick={handleValidate}
              variant="primary"
              size="sm"
              disabled={isRunning}
              icon={<Icon name={isRunning ? "spinner" : "flask"} className={isRunning ? "animate-spin" : ""} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const AiProviderConfigModal = ({
  mode = AI_PROVIDER_MODAL_MODES.CREATE,
  config = null,
  providerCatalog = [],
  onSubmit,
  onDelete,
  onClose,
}) => {
  const isEdit = mode === AI_PROVIDER_MODAL_MODES.EDIT;
  const providerOptions = useMemo(() => normalizeProviderOptions(providerCatalog), [providerCatalog]);
  const commercialProviderTypes = useMemo(
    () => new Set(providerOptions.filter((item) => item.isCommercial).map((item) => item.value)),
    [providerOptions]
  );
  const [formData, setFormData] = useState(() => toFormData(config, providerOptions));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationSession, setValidationSession] = useState(null);
  const title = useMemo(
    () => (isEdit ? "Editar configuración AI" : "Nueva configuración AI"),
    [isEdit]
  );

  const isCommercialProvider = commercialProviderTypes.has(formData.providerType);
  const showTokenField = isCommercialProvider || formData.authType === "api_key";
  const showBasicFields = formData.authType === "basic";
  const showCustomHeaders = formData.authType === "custom_headers" || String(formData.customHeadersText || "").trim();
  const canSave = Boolean(validationSession?.token) && !isSubmitting && !isValidating;

  const resetValidationApproval = () => {
    setValidationSession(null);
    setFormData((prev) => ({
      ...prev,
      validationStatus: "unvalidated",
      lastValidatedAt: null,
      lastError: "",
    }));
  };

  const applyProviderPreset = (providerType) => {
    const preset = getProviderPreset(providerType, providerOptions);
    setFormData((prev) => ({
      ...prev,
      providerType,
      baseUrl: preset.baseUrl,
      validationEndpoint: preset.validationEndpoint,
      modelsEndpoint: preset.modelsEndpoint,
      authType: preset.authType,
      token: "",
      username: "",
      password: "",
      customHeadersText: "",
      allowModelDiscovery: true,
      modelName: "",
      validationStatus: "unvalidated",
      lastValidatedAt: null,
      lastError: "",
      hasToken: false,
      tokenHint: "",
      hasPassword: false,
    }));
    setValidationSession(null);
    setErrors((prev) => ({
      ...prev,
      providerType: undefined,
      baseUrl: undefined,
      authType: undefined,
      validationEndpoint: undefined,
      modelsEndpoint: undefined,
      token: undefined,
      modelName: undefined,
    }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      validationStatus: "unvalidated",
      lastValidatedAt: null,
      lastError: "",
    }));
    setValidationSession(null);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleValidate = async () => {
    const nextErrors = validate(formData, { isEdit, commercialProviderTypes });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toastError("Completa la configuración primero", "Corrige los campos obligatorios antes de validar.");
      return;
    }

    setIsValidating(true);
    try {
      const result = await aiProviderConfigService.validate(buildValidationPayload(formData, { isEdit }));
      setFormData((prev) => ({
        ...prev,
        validationStatus: result?.status ?? "error",
        lastValidatedAt: result?.lastValidatedAt ?? null,
        lastError: result?.ok ? "" : result?.message ?? "La validación no pudo completarse.",
      }));
      if (result?.ok && result?.validationToken) {
        setValidationSession({
          token: result.validationToken,
          expiresAt: result?.expiresAt ?? null,
        });
        toastSuccess(
          "Validación AI correcta",
          buildValidationToastMessage({
            name: formData.name,
            ok: true,
            status: result?.status,
          })
        );
      } else {
        setValidationSession(null);
        toastError(
          "Validación AI con observaciones",
          buildValidationToastMessage({
            name: formData.name,
            ok: false,
            status: result?.status,
          })
        );
      }
    } catch (error) {
      const message = getAiProviderValidationErrorMessage(error);
      setValidationSession(null);
      setFormData((prev) => ({
        ...prev,
        validationStatus: "error",
        lastValidatedAt: null,
        lastError: message,
      }));
      toastError("No se pudo validar AI", message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    const nextErrors = validate(formData, { isEdit, commercialProviderTypes });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!validationSession?.token) {
      toastError("Debes validar la configuración", "No puedes guardar hasta validar correctamente el proveedor.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.(buildPayload(formData, validationSession.token, { isEdit }));
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
    <div className="relative w-full">
      <div className="flex max-h-[78vh] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
        <div className="border-b border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
                <Icon name="FaBrain" className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                {title}
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Registra el acceso del sistema a proveedores, credenciales y endpoints AI que luego podrán asignarse por uso operativo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  formData.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {formData.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-8 py-5">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre interno" required error={errors.name}>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={`${INPUT_BASE} ${errors.name ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="Ej: OpenAI producción"
                />
              </Field>

              <Field label="Tipo de proveedor" required error={errors.providerType}>
                <select
                  value={formData.providerType}
                  onChange={(e) => applyProviderPreset(e.target.value)}
                  className={`${INPUT_BASE} ${errors.providerType ? INPUT_ERROR : INPUT_OK}`}
                >
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field className="md:col-span-2" label="URL base" required error={errors.baseUrl}>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => handleChange("baseUrl", e.target.value)}
                  className={`${INPUT_BASE} ${errors.baseUrl ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="https://api.openai.com/v1"
                />
              </Field>

              <Field label="Tipo de autenticación" required error={errors.authType}>
                <select
                  value={formData.authType}
                  disabled={isCommercialProvider}
                  onChange={(e) => handleChange("authType", e.target.value)}
                  className={`${INPUT_BASE} ${errors.authType ? INPUT_ERROR : INPUT_OK} ${isCommercialProvider ? "opacity-70" : ""}`}
                >
                  <option value="none">Sin autenticación</option>
                  <option value="api_key">Token / API Key</option>
                  <option value="basic">Usuario / Password</option>
                  <option value="custom_headers">Headers personalizados</option>
                </select>
              </Field>

              <Field
                className={!showTokenField ? "invisible" : ""}
                label="API Token"
                error={errors.token}
                hint={showTokenField && isEdit && formData.hasToken ? `Si lo dejas vacío, se mantiene el valor actual (${formData.tokenHint || "abc*****xyz"}).` : null}
              >
                <input
                  type="password"
                  value={showTokenField ? formData.token : ""}
                  onChange={(e) => handleChange("token", e.target.value)}
                  disabled={!showTokenField}
                  tabIndex={showTokenField ? 0 : -1}
                  className={`${INPUT_BASE} ${errors.token ? INPUT_ERROR : INPUT_OK}`}
                  placeholder={showTokenField ? (isEdit && formData.hasToken ? "Mantener token actual" : "Ingresa el token o API Key") : ""}
                />
              </Field>

              {showBasicFields ? (
                <>
                  <Field label="Usuario" error={errors.username}>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => handleChange("username", e.target.value)}
                      className={`${INPUT_BASE} ${errors.username ? INPUT_ERROR : INPUT_OK}`}
                      placeholder="usuario"
                    />
                  </Field>

                  <Field
                    label="Password"
                    error={errors.password}
                    hint={isEdit && formData.hasPassword ? "Si la dejas vacía, se mantiene la contraseña actual." : null}
                  >
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      className={`${INPUT_BASE} ${errors.password ? INPUT_ERROR : INPUT_OK}`}
                      placeholder={isEdit && formData.hasPassword ? "Mantener password actual" : "Ingresa la contraseña"}
                    />
                  </Field>
                </>
              ) : null}

              {showCustomHeaders ? (
                <Field
                  className="md:col-span-2"
                  label="Headers personalizados (JSON)"
                  error={errors.customHeadersText}
                  hint='Ejemplo: { "X-Client-Id": "demo", "X-Env": "prod" }'
                >
                  <textarea
                    value={formData.customHeadersText}
                    onChange={(e) => handleChange("customHeadersText", e.target.value)}
                    className={`${INPUT_BASE} ${errors.customHeadersText ? INPUT_ERROR : INPUT_OK} min-h-[120px]`}
                    placeholder="{}"
                  />
                </Field>
              ) : null}

              <Field
                label="URL modelos"
                error={errors.modelsEndpoint}
                hint="Endpoint para recuperar o contrastar la lista de modelos disponibles."
              >
                <input
                  type="text"
                  value={formData.modelsEndpoint}
                  onChange={(e) => handleChange("modelsEndpoint", e.target.value)}
                  className={`${INPUT_BASE} ${errors.modelsEndpoint ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="/models"
                />
              </Field>

              <Field
                label="URL validación"
                error={errors.validationEndpoint}
                hint="Endpoint para comprobar conexión, autenticación y respuesta mínima del proveedor."
              >
                <input
                  type="text"
                  value={formData.validationEndpoint}
                  onChange={(e) => handleChange("validationEndpoint", e.target.value)}
                  className={`${INPUT_BASE} ${errors.validationEndpoint ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="/models"
                />
              </Field>

              <Field
                label="Timeout (segundos)"
                required
                error={errors.timeoutSeconds}
                hint="Tiempo máximo para validación, sincronización de modelos y llamadas reales del worker cuando esta integración esté activa en el procesamiento de minutas."
              >
                <input
                  type="number"
                  value={formData.timeoutSeconds}
                  onChange={(e) => handleChange("timeoutSeconds", e.target.value)}
                  className={`${INPUT_BASE} ${errors.timeoutSeconds ? INPUT_ERROR : INPUT_OK}`}
                  placeholder="15"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <CheckboxField
                label="Dejar activa esta configuración"
                checked={formData.isActive}
                onChange={(value) => handleChange("isActive", value)}
                hint="Una configuración activa queda disponible para asignarla en Uso AI."
              />
            </div>

            <MetadataCard createdAt={formData.createdAt} lastValidatedAt={formData.lastValidatedAt} />
          </div>
        </div>

        <div className="border-t border-slate-200/80 px-8 py-4 dark:border-slate-700/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton
                label={isValidating ? "Validando..." : "Validar"}
                onClick={handleValidate}
                variant="soft"
                size="sm"
                disabled={isValidating || isSubmitting}
                icon={<Icon name={isValidating ? "spinner" : "flask"} className={isValidating ? "animate-spin" : ""} />}
              />
              {isEdit ? (
                <ActionButton
                  label={isDeleting ? "Eliminando..." : "Eliminar"}
                  onClick={handleDelete}
                  variant="danger"
                  size="sm"
                  disabled={isDeleting || isSubmitting || isValidating}
                  icon={<Icon name={isDeleting ? "spinner" : "FaTrash"} className={isDeleting ? "animate-spin" : ""} />}
                />
              ) : null}
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <ActionButton label="Cancelar" onClick={onClose} variant="neutral" size="sm" />
                <ActionButton
                  label={isSubmitting ? "Guardando..." : "Guardar configuración"}
                  onClick={handleSave}
                  variant="primary"
                  size="sm"
                  disabled={!canSave}
                  icon={<Icon name="save" />}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiProviderConfigModal;
