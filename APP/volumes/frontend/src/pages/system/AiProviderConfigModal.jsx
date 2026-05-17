import React, { useMemo, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import aiProviderConfigService from "@/services/aiProviderConfigService";

export const AI_PROVIDER_MODAL_MODES = {
  CREATE: "create",
  EDIT: "edit",
};

export const AI_VALIDATION_IDLE_MESSAGE =
  "Valida esta configuración para confirmar conectividad, autenticación y disponibilidad del modelo.";

const INPUT_BASE =
  "w-full rounded-xl border px-3.5 py-2.5 text-sm " +
  "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 " +
  "focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800";

const INPUT_OK = "border-gray-300 dark:border-gray-700";
const INPUT_ERROR = "border-red-500 dark:border-red-400";
const LABEL = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
const ERR = "mt-1 text-xs text-red-500";

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
const VALIDATION_TONES = {
  unvalidated:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
  valid:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
  error:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
  auth_error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
  connection_error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
  timeout:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
  endpoint_unavailable:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
};
const VALIDATION_ICONS = {
  unvalidated: "FaClock",
  valid: "FaCheckCircle",
  error: "triangleExclamation",
  auth_error: "FaLock",
  connection_error: "triangleExclamation",
  timeout: "FaClock",
  endpoint_unavailable: "triangleExclamation",
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

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return value;
  }
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

const toModelOptions = (config) => {
  if (!config?.modelName) return [];
  return [{ value: config.modelName, label: config.modelName }];
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

const validate = (formData, { isEdit = false, requireModel = true, commercialProviderTypes = new Set() } = {}) => {
  const errors = {};
  const isCommercialProvider = commercialProviderTypes.has(formData.providerType);
  const tokenValue = String(formData.token || "").trim();
  const passwordValue = String(formData.password || "").trim();
  const modelValue = String(formData.modelName || "").trim();

  if (!String(formData.name || "").trim()) errors.name = "El nombre interno es obligatorio";
  if (!String(formData.providerType || "").trim()) errors.providerType = "El tipo de proveedor es obligatorio";
  if (!String(formData.baseUrl || "").trim()) errors.baseUrl = "La URL base es obligatoria";
  if (requireModel && !modelValue) errors.modelName = "Debes indicar un modelo antes de validar y guardar";

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

const mergeModelOptions = (currentOptions, incomingOptions, currentModelName = "") => {
  const merged = [];
  const seen = new Set();
  [...(Array.isArray(currentOptions) ? currentOptions : []), ...(Array.isArray(incomingOptions) ? incomingOptions : [])].forEach((item) => {
    const value = String(item?.value || "").trim();
    const label = String(item?.label || value).trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    merged.push({ value, label });
  });
  const fallbackModel = String(currentModelName || "").trim();
  if (fallbackModel && !seen.has(fallbackModel)) {
    merged.unshift({ value: fallbackModel, label: fallbackModel });
  }
  return merged;
};

const Field = ({ label, required = false, error, hint, className = "", children }) => (
  <div className={className}>
    <label className={LABEL}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    {error ? <p className={ERR}>{error}</p> : null}
  </div>
);

const CheckboxField = ({ label, checked, onChange, disabled = false, hint = null }) => (
  <div>
    <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer dark:border-gray-700 dark:bg-slate-900/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
    </label>
    {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
  </div>
);

const ValidationStatusCard = ({ status, message, lastValidatedAt }) => {
  const tone = VALIDATION_TONES[status] ?? VALIDATION_TONES.unvalidated;
  const icon = VALIDATION_ICONS[status] ?? VALIDATION_ICONS.unvalidated;
  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{VALIDATION_LABELS[status] ?? VALIDATION_LABELS.unvalidated}</p>
          <p className="mt-1 text-sm">{message}</p>
          <p className="mt-2 text-xs opacity-80">Última validación: {formatDateTime(lastValidatedAt)}</p>
        </div>
      </div>
    </div>
  );
};

const ValidationSummaryGrid = ({ config, providerOptions }) => {
  const items = [
    ["Proveedor", getProviderPreset(config?.providerType || "custom", providerOptions).label],
    ["URL base", config?.baseUrl || "—"],
    ["Modelo", config?.modelName || "Sin modelo"],
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

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{value}</p>
        </div>
      ))}
    </div>
  );
};

const MetadataCard = ({ createdAt, lastValidatedAt }) => (
  <div className="rounded-2xl border border-gray-200 bg-white/70 px-5 py-4 dark:border-gray-700 dark:bg-slate-900/60">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fecha registro</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{formatDateTime(createdAt)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Última validación</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{formatDateTime(lastValidatedAt)}</p>
      </div>
    </div>
  </div>
);

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
      const message = error?.message ?? "No fue posible ejecutar la validación AI.";
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
    <div className="w-full max-w-3xl rounded-[26px] bg-white/8 p-[2px] shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:bg-white/[0.06] dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
      <div className="flex max-h-[78vh] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
          <h3 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
            <Icon name="flask" className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            Validar configuración AI
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Esta prueba es acotada: revisa conectividad, autenticación y disponibilidad del modelo, sin ejecutar procesamiento de minutas ni prompts productivos.
          </p>
        </div>

        <div className="overflow-y-auto px-8 py-5">
          <div className="space-y-4">
            <ValidationSummaryGrid config={config} providerOptions={providerOptions} />
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
  const [availableModels, setAvailableModels] = useState(() => toModelOptions(config));
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsEndpointUsed, setModelsEndpointUsed] = useState(null);
  const [modelEntryMode, setModelEntryMode] = useState("sync");
  const [modelSearch, setModelSearch] = useState(() => String(config?.modelName || "").trim());
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
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
  const filteredAvailableModels = useMemo(() => {
    const query = String(modelSearch || "").trim().toLowerCase();
    if (!query) return availableModels;

    const matching = availableModels.filter((option) =>
      String(option?.label || option?.value || "")
        .toLowerCase()
        .includes(query)
    );

    const selectedValue = String(formData.modelName || "").trim();
    if (!selectedValue) return matching;

    const selectedOption = availableModels.find((option) => String(option?.value || "").trim() === selectedValue);
    if (!selectedOption) return matching;
    if (matching.some((option) => String(option?.value || "").trim() === selectedValue)) return matching;
    return [selectedOption, ...matching];
  }, [availableModels, formData.modelName, modelSearch]);
  const showModelSuggestions =
    modelEntryMode !== "manual" &&
    isModelDropdownOpen &&
    filteredAvailableModels.length > 0;

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
    setAvailableModels([]);
    setModelsEndpointUsed(null);
    setModelEntryMode("sync");
    setModelSearch("");
    setIsModelDropdownOpen(false);
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

  const handleLoadModels = async () => {
    const nextErrors = validate(formData, { isEdit, requireModel: false, commercialProviderTypes });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toastError("Completa la configuración primero", "Corrige los campos técnicos antes de sincronizar modelos.");
      return;
    }

    setIsLoadingModels(true);
    try {
      const result = await aiProviderConfigService.discoverModels({
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
        is_active: false,
        timeout_seconds: Number(formData.timeoutSeconds),
      });

      const nextOptions = mergeModelOptions([], result?.items, formData.modelName);
      setAvailableModels(nextOptions);
      setModelsEndpointUsed(result?.endpointUsed || null);
      setModelEntryMode("sync");
      setModelSearch(String(formData.modelName || "").trim());
      setIsModelDropdownOpen(true);

      if (!String(formData.modelName || "").trim() && nextOptions.length > 0) {
        setFormData((prev) => ({
          ...prev,
          modelName: nextOptions[0].value,
        }));
        setModelSearch(nextOptions[0].label || nextOptions[0].value);
      }

      toastSuccess("Modelos sincronizados", `Se cargaron ${nextOptions.length} modelo(s) disponibles.`);
    } catch (error) {
      toastError("No se pudieron recuperar modelos", error?.message ?? "La consulta al endpoint de modelos no pudo completarse.");
    } finally {
      setIsLoadingModels(false);
    }
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

  const handleModelSearchChange = (value) => {
    setModelSearch(value);
    setIsModelDropdownOpen(true);

    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      handleChange("modelName", "");
      return;
    }

    const exactMatch = availableModels.find((option) => {
      const optionValue = String(option?.value || "").trim();
      const optionLabel = String(option?.label || optionValue).trim();
      return optionValue === normalizedValue || optionLabel.toLowerCase() === normalizedValue.toLowerCase();
    });

    if (exactMatch) {
      handleChange("modelName", exactMatch.value);
      return;
    }

    if (String(formData.modelName || "").trim()) {
      handleChange("modelName", "");
    }
  };

  const handleSelectModelOption = (option) => {
    const nextValue = String(option?.value || "").trim();
    const nextLabel = String(option?.label || nextValue).trim();
    handleChange("modelName", nextValue);
    setModelSearch(nextLabel);
    setIsModelDropdownOpen(false);
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
      const message = error?.message ?? "No fue posible ejecutar la validación AI.";
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
      toastError("Debes validar la configuración", "No puedes guardar hasta validar correctamente el proveedor y el modelo.");
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
    <div className="relative w-full rounded-[26px] bg-white/8 p-[2px] shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:bg-white/[0.06] dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
      <div className="flex max-h-[78vh] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
                <Icon name="FaBrain" className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                {title}
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Registra el acceso del sistema a proveedores y modelos AI que podrán usarse más adelante para el análisis y procesamiento de minutas.
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
                label="Modelo"
                required
                error={errors.modelName}
                hint={
                  modelEntryMode === "manual"
                    ? "Modo manual activo. Cambia al modo sincronizado si quieres recuperar modelos desde la URL de modelos."
                    : modelsEndpointUsed
                      ? `Modelos recuperados desde ${modelsEndpointUsed}`
                      : "Sincroniza modelos desde el proveedor o cambia al modo manual. Luego escribe en el mismo campo para filtrar la lista cargada."
                }
              >
                <div className="flex gap-2">
                  {modelEntryMode === "manual" ? (
                    <input
                      type="text"
                      value={formData.modelName}
                      onChange={(e) => handleChange("modelName", e.target.value)}
                      className={`${INPUT_BASE} ${errors.modelName ? INPUT_ERROR : INPUT_OK}`}
                      placeholder="Ej: gpt-4o-mini"
                    />
                  ) : (
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => handleModelSearchChange(e.target.value)}
                        onFocus={() => {
                          if (availableModels.length) setIsModelDropdownOpen(true);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setIsModelDropdownOpen(false);
                          }, 120);
                        }}
                        className={`${INPUT_BASE} ${errors.modelName ? INPUT_ERROR : INPUT_OK}`}
                        placeholder={availableModels.length ? "Escribe para filtrar y seleccionar un modelo" : "Sin modelos cargados"}
                      />
                      {showModelSuggestions ? (
                        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-slate-900">
                          {filteredAvailableModels.map((option) => {
                            const isSelected = String(formData.modelName || "").trim() === String(option.value || "").trim();
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectModelOption(option);
                                }}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                  isSelected
                                    ? "bg-primary-50 text-gray-900 dark:bg-primary-900/20 dark:text-white"
                                    : "text-gray-700 hover:bg-primary-50 dark:text-gray-200 dark:hover:bg-primary-900/20"
                                }`}
                              >
                                <span className="truncate">{option.label}</span>
                                {isSelected ? (
                                  <span className="ml-3 text-xs text-primary-600 dark:text-primary-300">Seleccionado</span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {isModelDropdownOpen && availableModels.length && !filteredAvailableModels.length ? (
                        <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-xl dark:border-gray-700 dark:bg-slate-900 dark:text-gray-400">
                          Sin coincidencias para el filtro.
                        </div>
                      ) : null}
                    </div>
                  )}
                  <ActionButton
                    label=""
                    tooltip="Sincronizar modelos"
                    onClick={handleLoadModels}
                    variant="soft"
                    size="sm"
                    disabled={isLoadingModels}
                    className="px-3"
                    icon={<Icon name={isLoadingModels ? "spinner" : "arrowsRotate"} className={isLoadingModels ? "animate-spin" : ""} />}
                  />
                  <ActionButton
                    label=""
                    tooltip={modelEntryMode === "manual" ? "Volver a selección desde lista" : "Ingresar modelo manualmente"}
                    onClick={() => {
                      setModelEntryMode((prev) => (prev === "manual" ? "sync" : "manual"));
                      setModelSearch(String(formData.modelName || "").trim());
                      setIsModelDropdownOpen(false);
                      resetValidationApproval();
                    }}
                    variant="soft"
                    size="sm"
                    className="px-3"
                    icon={<Icon name={modelEntryMode === "manual" ? "FaList" : "FaPenToSquare"} />}
                  />
                </div>
              </Field>

              <Field
                label="Timeout (segundos)"
                required
                error={errors.timeoutSeconds}
                hint="Tiempo máximo para validación, prueba de conexión y sincronización de modelos. No afecta todavía el procesamiento real de minutas."
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
                hint="Si la activas, cualquier otra configuración AI activa quedará desactivada."
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
