import React, { useEffect, useMemo, useRef, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import {
  getProviderLabel,
  SectionCard,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
} from "@/pages/system/SystemSettingsShared";
import aiProviderBindingService from "@/services/aiProviderBindingService";
import aiProviderConfigService from "@/services/aiProviderConfigService";
import { ensureWriteOperationAllowed } from "@/utils/operationModeGuard";

const PURPOSES = [
  {
    id: "minute_analysis",
    label: "Análisis de minuta",
    agent: "Minuta",
    description: "Modelo usado por el worker para procesar y estructurar minutas.",
  },
  {
    id: "context_embeddings",
    label: "Vectorización",
    agent: "Contexto",
    description: "Modelo encoder usado para generar embeddings del contexto.",
    requiresDimensions: true,
  },
  {
    id: "context_answering",
    label: "Respuesta contextual",
    agent: "Contexto",
    description: "Modelo usado para responder preguntas con snippets autorizados.",
  },
];

const mergeModelOptions = (items = [], selectedModel = "") => {
  const seen = new Set();
  const options = [];
  for (const item of items || []) {
    const value = String(item?.value ?? item?.id ?? item?.name ?? item ?? "").trim();
    const label = String(item?.label ?? item?.name ?? value).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({
      ...(typeof item === "object" && item !== null ? item : {}),
      value,
      label: label || value,
    });
  }
  const selected = String(selectedModel || "").trim();
  if (selected && !seen.has(selected)) {
    options.unshift({ value: selected, label: selected });
  }
  return options;
};

const buildInitialDraft = (bindings = []) =>
  Object.fromEntries(
    PURPOSES.map((purpose) => {
      const binding = bindings.find((item) => item.purpose === purpose.id);
      return [
        purpose.id,
        {
          providerConfigId: binding?.providerConfigId || "",
          modelName: binding?.modelName || "",
          embeddingDimensions: binding?.embeddingDimensions || "",
        },
      ];
    })
  );

const resolvePurposeStatus = ({ purpose, current, activeBinding, providerOptions }) => {
  const providerId = current?.providerConfigId || activeBinding?.providerConfigId || "";
  const modelName = String(current?.modelName || activeBinding?.modelName || "").trim();
  const dimensions = Number(current?.embeddingDimensions || activeBinding?.embeddingDimensions || 0);
  const provider = providerOptions.find((item) => String(item.id) === String(providerId));

  if (!providerId && !modelName) {
    return {
      tone: "pending",
      label: "Pendiente",
      message: "Aún no se ha asignado provider ni modelo.",
    };
  }
  if (!provider) {
    return {
      tone: "error",
      label: "Revisar",
      message: "El provider asignado no está activo o no está validado.",
    };
  }
  if (!modelName) {
    return {
      tone: "warning",
      label: "Incompleto",
      message: "Falta seleccionar el modelo para este agente.",
    };
  }
  if (purpose.requiresDimensions && !dimensions) {
    return {
      tone: "warning",
      label: "Incompleto",
      message: "Falta definir la dimensión del embedding.",
    };
  }
  if (
    !activeBinding ||
    String(activeBinding.providerConfigId || "") !== String(current?.providerConfigId || "") ||
    String(activeBinding.modelName || "") !== String(current?.modelName || "") ||
    String(activeBinding.embeddingDimensions || "") !== String(current?.embeddingDimensions || "")
  ) {
    return {
      tone: "warning",
      label: "Sin guardar",
      message: "La asignación está completa, pero tiene cambios pendientes de guardar.",
    };
  }
  return {
    tone: "ready",
    label: "Listo",
    message: "Agente configurado con provider y modelo activos.",
  };
};

export const AiBindingsPanel = ({
  bindings = [],
  providers = [],
  providerLabelMap = {},
  onSaved = () => {},
}) => {
  const [draft, setDraft] = useState(() => buildInitialDraft(bindings));
  const [savingPurpose, setSavingPurpose] = useState(null);
  const [modelOptionsByPurpose, setModelOptionsByPurpose] = useState({});
  const [loadingModelsPurpose, setLoadingModelsPurpose] = useState(null);
  const [modelDetail, setModelDetail] = useState(null);

  React.useEffect(() => {
    setDraft(buildInitialDraft(bindings));
  }, [bindings]);

  const providerOptions = useMemo(
    () => providers.filter((item) => item.validationStatus === "valid" && item.isActive),
    [providers]
  );

  const updateDraft = (purpose, key, value) => {
    setDraft((current) => ({
      ...current,
      [purpose]: {
        ...(current[purpose] || {}),
        [key]: value,
      },
    }));
  };

  const loadModelsForPurpose = async (purpose, providerId, selectedModel = "") => {
    if (!providerId) return;
    setLoadingModelsPurpose(purpose);
    try {
      const result = await aiProviderConfigService.discoverModels({ config_id: providerId });
      const options = mergeModelOptions(result?.items, selectedModel);
      setModelOptionsByPurpose((current) => ({ ...current, [purpose]: options }));
    } catch (error) {
      setModelOptionsByPurpose((current) => ({ ...current, [purpose]: mergeModelOptions([], selectedModel) }));
      toastError("No se pudieron recuperar modelos", error?.message ?? "Revisa la configuración del provider.");
    } finally {
      setLoadingModelsPurpose(null);
    }
  };

  const handleProviderChange = (purpose, providerId) => {
    updateDraft(purpose, "providerConfigId", providerId);
    updateDraft(purpose, "modelName", "");
    setModelOptionsByPurpose((current) => ({ ...current, [purpose]: [] }));
    if (providerId) loadModelsForPurpose(purpose, providerId);
  };

  const handleSelectModelOption = (purpose, option) => {
    const value = String(option?.value || "").trim();
    updateDraft(purpose, "modelName", value);
  };

  const handleSave = async (purpose) => {
    const allowed = await ensureWriteOperationAllowed({ actionLabel: "Guardar asignación AI" });
    if (!allowed) return;

    const current = draft[purpose.id] || {};
    setSavingPurpose(purpose.id);
    try {
      await aiProviderBindingService.upsert({
        purpose: purpose.id,
        providerConfigId: current.providerConfigId,
        modelName: current.modelName,
        embeddingDimensions: purpose.requiresDimensions ? Number(current.embeddingDimensions || 0) : null,
      });
      toastSuccess("Asignación AI guardada", `${purpose.label} quedó configurado.`);
      await onSaved();
    } catch (error) {
      toastError("No se pudo guardar", error?.message ?? "Revisa provider, modelo y dimensiones.");
    } finally {
      setSavingPurpose(null);
    }
  };

  return (
    <SectionCard
      title="Uso AI"
      icon="FaBrain"
      description="Define qué provider y modelo ejecutará cada acción del sistema."
    >
      <div className="hidden grid-cols-[minmax(180px,1fr)_140px_minmax(220px,1.25fr)_minmax(240px,1.35fr)_100px_56px] gap-3 border-b border-gray-200 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400 xl:grid">
        <span>Acción</span>
        <span>Agente</span>
        <span>Provider</span>
        <span>Modelo</span>
        <span>Dim.</span>
        <span className="text-right">Guardar</span>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {PURPOSES.map((purpose) => {
            const current = draft[purpose.id] || {};
            const activeBinding = bindings.find((item) => item.purpose === purpose.id);
            const isSaving = savingPurpose === purpose.id;
            const modelOptions = modelOptionsByPurpose[purpose.id] || mergeModelOptions([], current.modelName);
            const isLoadingModels = loadingModelsPurpose === purpose.id;
            const selectedModelOption = modelOptions.find((option) => String(option.value) === String(current.modelName));
            const selectedProvider = providers.find((provider) => String(provider.id) === String(current.providerConfigId));
            const purposeStatus = resolvePurposeStatus({ purpose, current, activeBinding, providerOptions });

            return (
            <div
              key={purpose.id}
              className="grid gap-3 px-3 py-3 transition-theme xl:grid-cols-[minmax(180px,1fr)_140px_minmax(220px,1.25fr)_minmax(240px,1.35fr)_100px_56px] xl:items-center"
            >
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${TXT_TITLE}`}>{purpose.label}</p>
                <p className={`mt-1 text-xs leading-5 ${TXT_BODY}`}>{purpose.description}</p>
              </div>

              <div className="min-w-0">
                <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${TXT_META} xl:hidden`}>Agente</span>
                <span className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold ${TXT_BODY} dark:border-gray-700 dark:bg-gray-900/50`}>
                  <AgentStatusSignal status={purposeStatus} />
                  {purpose.agent}
                </span>
              </div>

              <label className="block min-w-0">
                <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${TXT_META} xl:hidden`}>Provider</span>
                <select
                  value={current.providerConfigId || ""}
                  onChange={(event) => handleProviderChange(purpose.id, event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">Seleccionar</option>
                  {providerOptions.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} · {getProviderLabel(provider.providerType, providerLabelMap)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0">
                <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${TXT_META} xl:hidden`}>Modelo</span>
                <div className="flex min-w-0 gap-2">
                  <ModelAutocompleteField
                    value={current.modelName || ""}
                    options={modelOptions}
                    disabled={!current.providerConfigId}
                    loading={isLoadingModels}
                    placeholder={current.providerConfigId ? "Seleccionar modelo" : "Selecciona provider"}
                    onOpen={() => {
                      if (!modelOptions.length && current.providerConfigId) {
                        loadModelsForPurpose(purpose.id, current.providerConfigId, current.modelName);
                      }
                    }}
                    onChange={(option) => handleSelectModelOption(purpose.id, option)}
                  />
                  <ActionButton
                    label=""
                    tooltip="Ver detalle del modelo"
                    onClick={() =>
                      setModelDetail({
                        purpose,
                        provider: selectedProvider,
                        option: selectedModelOption || { value: current.modelName, label: current.modelName },
                      })
                    }
                    variant="soft"
                    size="sm"
                    disabled={!current.modelName}
                    className="px-3"
                    icon={<Icon name="circleInfo" />}
                  />
                  <ActionButton
                    label=""
                    tooltip="Sincronizar modelos"
                    onClick={() => loadModelsForPurpose(purpose.id, current.providerConfigId, current.modelName)}
                    variant="soft"
                    size="sm"
                    disabled={!current.providerConfigId || isLoadingModels}
                    className="px-3"
                    icon={<Icon name={isLoadingModels ? "spinner" : "arrowsRotate"} className={isLoadingModels ? "animate-spin" : ""} />}
                  />
                </div>
              </label>

              <label className="block min-w-0">
                <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${TXT_META} xl:hidden`}>Dim.</span>
                <input
                  value={current.embeddingDimensions || ""}
                  disabled={!purpose.requiresDimensions}
                  onChange={(event) => updateDraft(purpose.id, "embeddingDimensions", event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-950"
                  placeholder={purpose.requiresDimensions ? "1536" : "N/A"}
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <ActionButton
                  label=""
                  tooltip="Guardar asignación"
                  icon={<Icon name="save" />}
                  size="sm"
                  variant="primary"
                  disabled={isSaving}
                  onClick={() => handleSave(purpose)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {modelDetail ? <ModelDetailModal detail={modelDetail} onClose={() => setModelDetail(null)} /> : null}
    </SectionCard>
  );
};

const STATUS_SIGNAL_STYLES = {
  ready: "border-emerald-400/60 bg-emerald-500 shadow-emerald-500/30",
  pending: "border-gray-400/60 bg-gray-400 shadow-gray-400/20",
  warning: "border-amber-300/70 bg-amber-400 shadow-amber-400/30",
  error: "border-rose-300/70 bg-rose-500 shadow-rose-500/30",
};

const AgentStatusSignal = ({ status }) => (
  <span
    title={`${status.label}: ${status.message}`}
    className={`h-2.5 w-2.5 shrink-0 rounded-full border shadow-[0_0_0_3px] ${STATUS_SIGNAL_STYLES[status.tone] || STATUS_SIGNAL_STYLES.pending}`}
  />
);

const ModelAutocompleteField = ({
  value,
  options = [],
  disabled = false,
  loading = false,
  placeholder = "Seleccionar",
  onOpen,
  onChange,
}) => {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = useMemo(() => {
    if (!normalizedQuery) return options.slice(0, 40);
    return options
      .filter((option) => `${option.label ?? ""} ${option.value ?? ""}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 40);
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setQuery("");
  };

  const displayValue = isOpen ? query : selectedOption?.label ?? value ?? "";

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <Icon
          name={loading ? "spinner" : "search"}
          className={`pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 dark:text-gray-400 ${
            loading ? "animate-spin" : ""
          }`}
        />
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setQuery("");
            setIsOpen(true);
            onOpen?.();
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-8 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:disabled:bg-gray-950"
        />
      </div>

      {isOpen && !disabled ? (
        <div
          className="absolute z-40 mt-1 max-h-64 min-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl transition-theme dark:border-gray-700 dark:bg-gray-800"
          style={{ width: "min(34rem, calc(100vw - 2rem))" }}
        >
          {value ? (
            <button
              type="button"
              onClick={() => handleSelect({ value: "", label: "" })}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-xs font-bold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/75"
            >
              <Icon name="circleInfo" className="shrink-0 text-xs" />
              Limpiar selección
            </button>
          ) : null}

          <div className="max-h-52 overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                {loading ? "Cargando modelos..." : "Sin resultados."}
              </p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700/75"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-bold text-gray-800 dark:text-gray-100">{option.label}</span>
                    {option.value !== option.label ? (
                      <span className="block break-words text-[11px] font-medium text-gray-500 dark:text-gray-400">{option.value}</span>
                    ) : null}
                  </span>
                  {String(value) === String(option.value) ? (
                    <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MODEL_METADATA_LABELS = {
  family: "Familia",
  families: "Familias",
  parameter_size: "Parámetros",
  quantization_level: "Cuantización",
  format: "Formato",
  size: "Tamaño",
  modified_at: "Modificado",
  digest: "Digest",
  object: "Objeto",
  created: "Creado",
  owned_by: "Propietario",
  type: "Tipo",
  created_at: "Creado",
  display_name: "Nombre visible",
};

const formatMetadataValue = (value) => {
  if (value === null || value === undefined || value === "") return "No informado";
  if (Array.isArray(value)) return value.join(", ") || "No informado";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number" && value > 1000000000 && value < 3000000000) {
    return new Date(value * 1000).toLocaleString();
  }
  return String(value);
};

const ModelDetailModal = ({ detail, onClose }) => {
  const metadata = detail?.option?.metadata && typeof detail.option.metadata === "object" ? detail.option.metadata : {};
  const raw = detail?.option?.raw && typeof detail.option.raw === "object" ? detail.option.raw : null;
  const metadataEntries = Object.entries(metadata);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl">
        <div className="flex max-h-[82vh] min-h-[560px] flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.24)] transition-theme dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_24px_70px_rgba(2,6,23,0.52)]">
          <div className="border-b border-slate-200/80 px-8 py-5 dark:border-slate-700/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h3 className={`flex items-center gap-3 break-words text-2xl font-semibold ${TXT_TITLE}`}>
                  <Icon name="FaBrain" className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" />
                  {detail?.option?.label || detail?.option?.value}
                </h3>
                <p className={`mt-2 text-sm ${TXT_BODY}`}>
                  Detalle técnico informado por el provider para el modelo seleccionado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {detail?.provider?.providerType || detail?.provider?.provider_type || "Provider"}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Cerrar detalle del modelo"
                >
                  <Icon name="xmark" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className={`mt-3 text-sm ${TXT_BODY}`}>
                {detail?.purpose?.label} · {detail?.provider?.name || "Provider no seleccionado"}
            </p>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(23rem,1.08fr)]">
            <div className="min-h-0 overflow-y-auto px-8 py-5">
              <div className="space-y-6">
                <section>
                  <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Identificación</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <DetailField label="Modelo" value={detail?.option?.value} />
                    <DetailField label="Provider" value={detail?.provider?.providerType || detail?.provider?.provider_type} />
                  </div>
                </section>

                <section>
                  <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Metadatos informados por el provider</p>
                  {metadataEntries.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {metadataEntries.map(([key, value]) => (
                        <DetailField key={key} label={MODEL_METADATA_LABELS[key] || key} value={formatMetadataValue(value)} />
                      ))}
                    </div>
                  ) : (
                    <p className={`rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm ${TXT_BODY} dark:border-gray-700 dark:bg-slate-900`}>
                      Este provider no entregó metadatos adicionales para el modelo seleccionado.
                    </p>
                  )}
                </section>
              </div>
            </div>

            <aside className="flex min-h-[320px] min-w-0 flex-col border-t border-slate-200/80 px-8 py-5 dark:border-slate-700/80 lg:border-l lg:border-t-0">
              <div className="mb-3">
                <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Respuesta cruda del provider</p>
                <p className={`mt-1 text-xs ${TXT_BODY}`}>Datos originales recibidos desde el endpoint de modelos.</p>
              </div>
              {raw ? (
                <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-xs leading-5 text-gray-800 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100">
                  {JSON.stringify(raw, null, 2)}
                </pre>
              ) : (
                <div className={`flex min-h-0 flex-1 items-center rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-sm ${TXT_BODY} dark:border-gray-700 dark:bg-slate-900`}>
                  El provider no entregó una respuesta cruda asociada a este modelo.
                </div>
              )}
            </aside>
          </div>

          <div className="border-t border-slate-200/80 px-8 py-4 dark:border-slate-700/80">
            <div className="flex justify-end">
              <ActionButton label="Cerrar" onClick={onClose} variant="neutral" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailField = ({ label, value }) => (
  <div>
    <p className={`mb-1 block text-sm font-medium ${TXT_BODY}`}>{label}</p>
    <p className={`min-h-[42px] rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium ${TXT_TITLE} break-words dark:border-gray-700 dark:bg-slate-900`}>
      {formatMetadataValue(value)}
    </p>
  </div>
);

export default AiBindingsPanel;
