import React, { useEffect, useMemo, useRef, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import AiProviderConfigModal, {
  AI_PROVIDER_MODAL_MODES,
  AiProviderValidationModal,
} from "@/pages/system/AiProviderConfigModal";
import SmtpConfigModal, {
  SMTP_MODAL_MODES,
  SMTP_TEST_IDLE_MESSAGE,
  SmtpTestDialogPanel,
} from "@/pages/system/SmtpConfigModal";
import aiProviderConfigService from "@/services/aiProviderConfigService";
import smtpConfigService from "@/services/smtpConfigService";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const TABS = [
  {
    id: "summary",
    label: "Resumen",
    icon: "FaGaugeHigh",
    description: "Vista general del módulo",
  },
  {
    id: "integrations",
    label: "Integraciones",
    icon: "FaCloud",
    description: "SMTP e inteligencia artificial",
  },
  {
    id: "maintenance",
    label: "Mantenimiento",
    icon: "FaGears",
    description: "Próxima etapa",
  },
  {
    id: "backups",
    label: "Respaldos",
    icon: "FaDatabase",
    description: "Próxima etapa",
  },
];

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

const statusClasses = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  info: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const FALLBACK_PROVIDER_LABELS = {
  openai: "OpenAI / ChatGPT",
  anthropic: "Anthropic / Claude",
  deepseek: "DeepSeek",
  perplexity: "Perplexity",
  ollama_local: "Ollama local",
  ollama_remote: "Ollama remoto",
  custom: "Custom",
};

const getProviderLabel = (providerType, providerLabelMap = {}) =>
  providerLabelMap?.[providerType] ?? FALLBACK_PROVIDER_LABELS[providerType] ?? providerType ?? "—";

const maskTokenHint = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Sin token";
  if (raw.includes("*****")) {
    const [head, tail] = raw.split("*****");
    return `${String(head || "").slice(0, 3)}*****${String(tail || "").slice(-3)}`;
  }
  return `${raw.slice(0, 3)}*****${raw.slice(-3)}`;
};

const Header = () => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <h1 className={`flex items-center gap-3 text-3xl font-bold ${TXT_TITLE}`}>
        <Icon name="FaGears" className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        Sistema
      </h1>
      <p className={`mt-2 max-w-3xl text-sm ${TXT_BODY}`}>
        Administra integraciones globales con configuraciones persistidas, activación controlada y validación previa al guardado.
      </p>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Foco actual</p>
      <p className={`mt-1 text-sm font-medium ${TXT_TITLE}`}>SMTP y AI administrables con persistencia y validación controlada</p>
    </div>
  </div>
);

const TabNav = ({ activeTab, onTabChange }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="grid grid-cols-1 md:grid-cols-4">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={[
              "border-b border-r border-gray-200 px-5 py-4 text-left transition-colors last:border-r-0 md:last:border-r-0 dark:border-gray-700",
              isActive
                ? "bg-primary-50 dark:bg-primary-900/20"
                : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/40",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${isActive ? statusClasses.info : statusClasses.inactive}`}>
                <Icon name={tab.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${TXT_TITLE}`}>{tab.label}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>{tab.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const SectionCard = ({ title, icon, description, actions = null, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-700 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className={`flex items-center gap-3 text-lg font-semibold ${TXT_TITLE}`}>
          <Icon name={icon} className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          {title}
        </h2>
        {description ? <p className={`mt-2 text-sm ${TXT_BODY}`}>{description}</p> : null}
      </div>
      {actions}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const StatusBadge = ({ tone, children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[tone] ?? statusClasses.inactive}`}>
    {children}
  </span>
);

const SendSmtpTestModal = ({ config, onClose, onSent }) => {
  const [email, setEmail] = useState(String(config?.fromEmail || "").trim());
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(SMTP_TEST_IDLE_MESSAGE);

  const handleSend = async () => {
    if (!String(email || "").trim()) {
      setStatus("error");
      setMessage("Indica un correo destino para enviar la prueba.");
      toastError("Correo requerido", "Indica un correo destino para enviar la prueba.");
      return;
    }

    setIsSending(true);
    setStatus("loading");
    setMessage("Probando conexión, autenticación y entrega del correo HTML...");
    try {
      await smtpConfigService.test({
        config_id: config.id,
        test_email: String(email).trim(),
      });
      const successMessage = `Se envió una prueba a ${String(email).trim()}.`;
      setStatus("success");
      setMessage(successMessage);
      toastSuccess("Prueba SMTP enviada", successMessage);
      onSent?.();
    } catch (error) {
      const errorMessage = error?.message ?? "La prueba SMTP no pudo completarse.";
      setStatus("error");
      setMessage(errorMessage);
      toastError("No se pudo enviar la prueba", errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex w-full justify-center px-4">
      <SmtpTestDialogPanel
        email={email}
        onEmailChange={setEmail}
        onClose={onClose}
        onRunTest={handleSend}
        isTesting={isSending}
        status={status}
        message={message}
        title="Enviar prueba SMTP"
        description={`Envía una prueba rápida usando ${config?.name}.`}
        submitLabel="Enviar prueba"
        submittingLabel="Validando SMTP..."
      />
    </div>
  );
};

const PlaceholderPanel = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <Icon name="FaGears" className="mx-auto h-8 w-8 text-primary-500 dark:text-primary-400" />
    <h2 className={`mt-4 text-lg font-semibold ${TXT_TITLE}`}>{title}</h2>
    <p className={`mx-auto mt-2 max-w-2xl text-sm ${TXT_BODY}`}>{description}</p>
  </div>
);

const SummaryPanel = ({ smtpItems, aiItems }) => {
  const activeCount = smtpItems.filter((item) => item.isActive).length;
  const inactiveCount = smtpItems.length - activeCount;
  const aiActiveCount = aiItems.filter((item) => item.isActive).length;
  const aiInactiveCount = aiItems.length - aiActiveCount;
  const activeSmtp = smtpItems.find((item) => item.isActive) ?? null;
  const activeAi = aiItems.find((item) => item.isActive) ?? null;
  const aiPendingValidationCount = aiItems.filter((item) => item.validationStatus && item.validationStatus !== "valid").length;
  const configuredChannels = Number(Boolean(activeSmtp)) + Number(Boolean(activeAi));
  const summaryPanels = [
    {
      key: "smtp",
      title: "SMTP",
      icon: "FaEnvelope",
      tone: activeSmtp ? "active" : smtpItems.length ? "warning" : "inactive",
      status: activeSmtp ? "Operativo" : smtpItems.length ? "Pendiente de activación" : "Sin configurar",
      description: "Estado de las cuentas y servidores usados para correos y notificaciones.",
      stats: [
        { label: "Total", value: smtpItems.length },
        { label: "Activas", value: activeCount },
        { label: "Inactivas", value: inactiveCount },
      ],
      details: activeSmtp
        ? [
            { label: "Nombre", value: activeSmtp.name || "—" },
            { label: "Remitente", value: activeSmtp.fromEmail || "—" },
            { label: "Host", value: activeSmtp.host ? `${activeSmtp.host}:${activeSmtp.port}` : "—" },
            { label: "Actualizado", value: formatDateTime(activeSmtp.updatedAt || activeSmtp.createdAt) },
          ]
        : [],
      emptyMessage: "Activa una configuración SMTP desde la pestaña Integraciones para habilitar notificaciones.",
    },
    {
      key: "ai",
      title: "AI",
      icon: "FaBrain",
      tone: activeAi ? "active" : aiItems.length ? "warning" : "inactive",
      status: activeAi ? "Operativo" : aiItems.length ? "Pendiente de activación" : "Sin configurar",
      description: "Estado de proveedores, modelos y validaciones para automatizaciones con IA.",
      stats: [
        { label: "Total", value: aiItems.length },
        { label: "Activas", value: aiActiveCount },
        { label: "Inactivas", value: aiInactiveCount },
      ],
      details: activeAi
        ? [
            { label: "Nombre", value: activeAi.name || "—" },
            { label: "Proveedor", value: getProviderLabel(activeAi.providerType) || "—" },
            { label: "Modelo", value: activeAi.modelName || "Sin modelo" },
            { label: "Actualizado", value: formatDateTime(activeAi.updatedAt || activeAi.createdAt) },
          ]
        : [],
      emptyMessage: "Activa una configuración AI validada desde la pestaña Integraciones para usar automatizaciones.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-gray-200/80 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Estado general</p>
            <h2 className={`mt-1 text-xl font-semibold ${TXT_TITLE}`}>Cobertura operativa del sistema</h2>
            <p className={`mt-2 text-sm ${TXT_BODY}`}>
              {configuredChannels === 2
                ? "SMTP y AI tienen una configuración activa."
                : configuredChannels === 1
                  ? "Solo uno de los dos canales tiene configuración activa."
                  : "Todavía no hay canales activos configurados."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-slate-900/40">
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Canales activos</p>
              <p className={`mt-2 text-2xl font-bold ${TXT_TITLE}`}>{configuredChannels}/2</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-slate-900/40">
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Validaciones AI</p>
              <p className={`mt-2 text-2xl font-bold ${TXT_TITLE}`}>{aiPendingValidationCount}</p>
              <p className={`mt-1 text-xs ${TXT_META}`}>pendientes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {summaryPanels.map((panel) => (
          <div
            key={panel.key}
            className="overflow-hidden rounded-[26px] border border-gray-200/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-3 ${statusClasses[panel.tone]}`}>
                      <Icon name={panel.icon} className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${TXT_TITLE}`}>{panel.title}</h3>
                      <p className={`mt-1 text-sm ${TXT_BODY}`}>{panel.description}</p>
                    </div>
                  </div>
                </div>
                <StatusBadge tone={panel.tone}>{panel.status}</StatusBadge>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-3">
                {panel.stats.map((stat) => (
                  <div key={`${panel.key}-${stat.label}`} className="rounded-2xl border border-gray-100 bg-slate-50/80 px-4 py-4 text-center dark:border-gray-700/80 dark:bg-slate-900/40">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{stat.label}</p>
                    <p className={`mt-2 text-2xl font-bold ${TXT_TITLE}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {panel.details.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {panel.details.map((detail) => (
                    <div key={`${panel.key}-${detail.label}`} className="rounded-2xl border border-gray-100 bg-slate-50/80 px-4 py-4 dark:border-gray-700/80 dark:bg-slate-900/40">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{detail.label}</p>
                      <p className={`mt-2 text-sm font-medium ${TXT_TITLE}`}>{detail.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50/70 px-5 py-8 text-center dark:border-gray-700 dark:bg-slate-900/30">
                  <p className={`text-sm ${TXT_BODY}`}>{panel.emptyMessage}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SmtpTable = ({ items, isLoading, onEdit, onActivate, onSend, onDelete }) => {
  if (isLoading) {
    return <p className={`text-sm ${TXT_BODY}`}>Cargando configuraciones SMTP...</p>;
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
        <p className={`text-sm ${TXT_BODY}`}>No hay configuraciones SMTP registradas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Nombre</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Estado</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Host</th>
            <th className={`py-3 text-right font-semibold ${TXT_META}`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={[
                "border-b border-gray-100 align-top dark:border-gray-700/60",
                item.isActive ? "bg-green-50/60 dark:bg-green-950/10" : "",
              ].join(" ")}
            >
              <td className="py-4 pr-4">
                <p className={`font-semibold ${TXT_TITLE}`}>{item.name}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>{item.fromEmail}</p>
              </td>
              <td className="py-4 pr-4">
                <StatusBadge tone={item.isActive ? "active" : "inactive"}>
                  {item.isActive ? "Activa" : "Inactiva"}
                </StatusBadge>
              </td>
              <td className="py-4 pr-4">
                <p className={`font-medium ${TXT_TITLE}`}>{item.host}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>Puerto {item.port}</p>
              </td>
              <td className="py-4 text-right">
                <div className="ml-auto grid w-[224px] grid-cols-4 gap-2">
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="paperPlane" />}
                    tooltip="Enviar prueba SMTP"
                    onClick={() => onSend(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="FaEdit" />}
                    tooltip="Editar configuración"
                    onClick={() => onEdit(item.id)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={
                      <Icon
                        name={item.isActive ? "toggleOn" : "powerOff"}
                        className={item.isActive ? "text-green-500" : "text-gray-400 dark:text-gray-500"}
                      />
                    }
                    tooltip={item.isActive ? "SMTP activo" : "Activar SMTP"}
                    onClick={() => onActivate(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="FaTrash" />}
                    tooltip="Eliminar configuración"
                    onClick={() => onDelete(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AIProviderTable = ({ items, isLoading, providerLabelMap, onEdit, onValidate, onToggleActive, onDelete }) => {
  if (isLoading) {
    return <p className={`text-sm ${TXT_BODY}`}>Cargando configuraciones AI...</p>;
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
        <p className={`text-sm ${TXT_BODY}`}>No hay configuraciones AI registradas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Nombre</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Proveedor</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Modelo</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Estado</th>
            <th className={`py-3 text-right font-semibold ${TXT_META}`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={[
                "border-b border-gray-100 align-top dark:border-gray-700/60",
                item.isActive ? "bg-green-50/60 dark:bg-green-950/10" : "",
              ].join(" ")}
            >
              <td className="py-4 pr-4">
                <p className={`font-semibold ${TXT_TITLE}`}>{item.name}</p>
              </td>
              <td className="py-4 pr-4">
                <p className={`font-medium ${TXT_TITLE}`}>{getProviderLabel(item.providerType, providerLabelMap)}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>{maskTokenHint(item.tokenHint)}</p>
              </td>
              <td className="py-4 pr-4">
                <p className={`font-medium ${TXT_TITLE}`}>{item.modelName || "Sin modelo"}</p>
              </td>
              <td className="py-4 pr-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={item.isActive ? "active" : "inactive"}>
                    {item.isActive ? "Activa" : "Inactiva"}
                  </StatusBadge>
                </div>
              </td>
              <td className="py-4 text-right">
                <div className="ml-auto grid w-[224px] grid-cols-4 gap-2">
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="flask" />}
                    tooltip="Validar configuración"
                    onClick={() => onValidate(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="FaEdit" />}
                    tooltip="Editar configuración"
                    onClick={() => onEdit(item.id)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={
                      <Icon
                        name={item.isActive ? "toggleOn" : "powerOff"}
                        className={item.isActive ? "text-green-500" : "text-gray-400 dark:text-gray-500"}
                      />
                    }
                    tooltip={item.isActive ? "Desactivar AI" : "Activar AI"}
                    onClick={() => onToggleActive(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="FaTrash" />}
                    tooltip="Eliminar configuración"
                    onClick={() => onDelete(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState("summary");
  const [smtpItems, setSmtpItems] = useState([]);
  const [aiItems, setAiItems] = useState([]);
  const [aiProviderCatalog, setAiProviderCatalog] = useState([]);
  const [isSmtpLoading, setIsSmtpLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const hasLoadedSmtpRef = useRef(false);
  const hasLoadedAiRef = useRef(false);

  useDocumentTitle("Configuración del Sistema");

  const loadSmtpConfigs = async () => {
    setIsSmtpLoading(true);
    try {
      const result = await smtpConfigService.list({ limit: 100 });
      setSmtpItems(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      setSmtpItems([]);
    } finally {
      setIsSmtpLoading(false);
    }
  };

  const loadAiConfigs = async () => {
    setIsAiLoading(true);
    try {
      const result = await aiProviderConfigService.list({ limit: 100 });
      setAiItems(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      setAiItems([]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const loadAiProviderCatalog = async () => {
    try {
      const result = await aiProviderConfigService.getCatalog();
      setAiProviderCatalog(Array.isArray(result) ? result : []);
    } catch (error) {
      setAiProviderCatalog([]);
    }
  };

  useEffect(() => {
    if (hasLoadedSmtpRef.current) return;
    hasLoadedSmtpRef.current = true;
    loadSmtpConfigs();
  }, []);

  useEffect(() => {
    if (hasLoadedAiRef.current) return;
    hasLoadedAiRef.current = true;
    loadAiProviderCatalog();
    loadAiConfigs();
  }, []);

  const aiProviderLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(aiProviderCatalog) ? aiProviderCatalog : [])
          .map((item) => [String(item?.id || "").trim(), String(item?.label || "").trim()])
          .filter(([id, label]) => id && label)
      ),
    [aiProviderCatalog]
  );

  const openCreateModal = () => {
    ModalManager.show({
      type: "custom",
      title: "Nueva configuración SMTP",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <SmtpConfigModal
          mode={SMTP_MODAL_MODES.CREATE}
          config={null}
          onSubmit={async (payload) => {
            const created = await smtpConfigService.create(payload);
            toastSuccess("Configuración SMTP creada", `Se guardó "${created?.name ?? "la configuración"}".`);
            ModalManager.closeAll();
            await loadSmtpConfigs();
          }}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  const openEditModal = async (id) => {
    try {
      const detail = await smtpConfigService.getById(id);
      ModalManager.show({
        type: "custom",
        title: "Editar configuración SMTP",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <SmtpConfigModal
            mode={SMTP_MODAL_MODES.EDIT}
            config={detail}
            onSubmit={async (payload) => {
              const updated = await smtpConfigService.update(id, payload);
              toastSuccess("Configuración SMTP actualizada", `Se actualizó "${updated?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadSmtpConfigs();
            }}
            onDelete={async () => {
              const confirmed = await ModalManager.confirm({
                title: "Confirmar eliminación SMTP",
                message: `¿Deseas eliminar la configuración "${detail?.name ?? "seleccionada"}"? Esta acción la quitará de la lista.`,
                confirmText: "Eliminar",
                cancelText: "Cancelar",
              });

              if (!confirmed) return;

              await smtpConfigService.remove(id);
              toastSuccess("Configuración SMTP eliminada", `Se eliminó "${detail?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadSmtpConfigs();
            }}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      toastError("No se pudo abrir SMTP", error?.message ?? "No fue posible cargar el detalle para edición.");
    }
  };

  const handleActivate = async (item) => {
    if (item?.isActive) {
      if (smtpItems.length <= 1) {
        ModalManager.warning({
          title: "No se puede desactivar SMTP",
          message:
            "Esta es la única configuración SMTP disponible. Puedes eliminarla si ya no la necesitas, pero no puedes dejarla inactiva desde aquí.",
        });
        return;
      }

      ModalManager.info({
        title: "SMTP ya activa",
        message: "Esta configuración ya está en uso. Si quieres cambiar la vigente, activa otra configuración de la lista.",
      });
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: "Confirmar activación SMTP",
      message: `¿Deseas dejar activa la configuración "${item?.name ?? "seleccionada"}"? La configuración SMTP activa actual dejará de estar vigente.`,
      confirmText: "Activar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      const updated = await smtpConfigService.activate(item.id);
      toastSuccess("Configuración activa actualizada", `"${updated?.name ?? "La configuración"}" quedó en uso.`);
      await loadSmtpConfigs();
    } catch (error) {
      toastError("No se pudo activar SMTP", error?.message ?? "La activación no pudo completarse.");
    }
  };

  const openSendTestModal = (item) => {
    ModalManager.show({
      type: "custom",
      title: "Enviar prueba SMTP",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <SendSmtpTestModal
          config={item}
          onClose={() => ModalManager.closeAll()}
          onSent={() => loadSmtpConfigs()}
        />
      ),
    });
  };

  const openCreateAiModal = () => {
    ModalManager.show({
      type: "custom",
      title: "Nueva configuración AI",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <AiProviderConfigModal
          mode={AI_PROVIDER_MODAL_MODES.CREATE}
          config={null}
          providerCatalog={aiProviderCatalog}
          onSubmit={async (payload) => {
            const created = await aiProviderConfigService.create(payload);
            toastSuccess("Configuración AI creada", `Se guardó "${created?.name ?? "la configuración"}".`);
            ModalManager.closeAll();
            await loadAiConfigs();
          }}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  const openEditAiModal = async (id) => {
    try {
      const detail = await aiProviderConfigService.getById(id);
      ModalManager.show({
        type: "custom",
        title: "Editar configuración AI",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <AiProviderConfigModal
            mode={AI_PROVIDER_MODAL_MODES.EDIT}
            config={detail}
            providerCatalog={aiProviderCatalog}
            onSubmit={async (payload) => {
              const updated = await aiProviderConfigService.update(id, payload);
              toastSuccess("Configuración AI actualizada", `Se actualizó "${updated?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadAiConfigs();
            }}
            onDelete={async () => {
              const confirmed = await ModalManager.confirm({
                title: "Confirmar eliminación AI",
                message: `¿Deseas eliminar la configuración "${detail?.name ?? "seleccionada"}"?`,
                confirmText: "Eliminar",
                cancelText: "Cancelar",
              });

              if (!confirmed) return;

              await aiProviderConfigService.remove(id);
              toastSuccess("Configuración AI eliminada", `Se eliminó "${detail?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadAiConfigs();
            }}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      toastError("No se pudo abrir AI", error?.message ?? "No fue posible cargar el detalle para edición.");
    }
  };

  const openAiValidationModal = (item) => {
    ModalManager.show({
      type: "custom",
      title: "Validar configuración AI",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <AiProviderValidationModal
          config={item}
          providerCatalog={aiProviderCatalog}
          onClose={() => ModalManager.closeAll()}
          onValidated={() => loadAiConfigs()}
        />
      ),
    });
  };

  const handleAiToggleActive = async (item) => {
    if (item?.isActive) {
      const confirmed = await ModalManager.confirm({
        title: "Desactivar configuración AI",
        message: `¿Deseas desactivar "${item?.name ?? "la configuración"}"? Si continúas, el sistema quedará sin configuración AI activa registrada.`,
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      try {
        await aiProviderConfigService.deactivate(item.id);
        toastSuccess("Configuración AI desactivada", `"${item?.name ?? "La configuración"}" quedó inactiva.`);
        await loadAiConfigs();
      } catch (error) {
        toastError("No se pudo desactivar AI", error?.message ?? "La desactivación no pudo completarse.");
      }
      return;
    }

    if (!item?.modelName) {
      ModalManager.warning({
        title: "Modelo requerido",
        message: "No puedes activar una configuración AI sin modelo configurado.",
      });
      return;
    }

    if (item?.validationStatus !== "valid") {
      ModalManager.warning({
        title: "Validación requerida",
        message: `La configuración "${item?.name ?? "seleccionada"}" debe validarse correctamente antes de activarse.`,
      });
      return;
    }

    const currentActive = aiItems.find((candidate) => candidate.isActive);
    const confirmed = await ModalManager.confirm({
      title: "Confirmar activación AI",
      message: currentActive
        ? `¿Deseas activar "${item?.name ?? "seleccionada"}"? "${currentActive.name}" dejará de estar activa automáticamente.`
        : `¿Deseas activar "${item?.name ?? "seleccionada"}"?`,
      confirmText: "Activar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      const updated = await aiProviderConfigService.activate(item.id);
      toastSuccess("Configuración AI activa actualizada", `"${updated?.name ?? "La configuración"}" quedó activa.`);
      await loadAiConfigs();
    } catch (error) {
      toastError("No se pudo activar AI", error?.message ?? "La activación no pudo completarse.");
    }
  };

  const handleDelete = async (item) => {
    const confirmed = await ModalManager.confirm({
      title: "Confirmar eliminación SMTP",
      message: `¿Deseas eliminar la configuración "${item?.name ?? "seleccionada"}"? Esta acción la quitará de la lista.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      await smtpConfigService.remove(item.id);
      toastSuccess("Configuración SMTP eliminada", `Se eliminó "${item?.name ?? "la configuración"}".`);
      await loadSmtpConfigs();
    } catch (error) {
      toastError("No se pudo eliminar SMTP", error?.message ?? "La eliminación no pudo completarse.");
    }
  };

  const handleAiDelete = async (item) => {
    const confirmed = await ModalManager.confirm({
      title: "Confirmar eliminación AI",
      message: item?.isActive
        ? `¿Deseas eliminar la configuración activa "${item?.name ?? "seleccionada"}"? Si continúas, el sistema quedará sin configuración AI activa registrada.`
        : `¿Deseas eliminar la configuración "${item?.name ?? "seleccionada"}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      await aiProviderConfigService.remove(item.id);
      toastSuccess("Configuración AI eliminada", `Se eliminó "${item?.name ?? "la configuración"}".`);
      await loadAiConfigs();
    } catch (error) {
      toastError("No se pudo eliminar AI", error?.message ?? "La eliminación no pudo completarse.");
    }
  };

  return (
    <div className="space-y-6">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "summary" && <SummaryPanel smtpItems={smtpItems} aiItems={aiItems} />}

      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SectionCard
              title="SMTP"
              icon="FaEnvelope"
              description="Administra las cuentas y servidores de correo que MinuetAItor utilizará para enviar notificaciones, mensajes automáticos y comunicaciones a usuarios y participantes."
              actions={
                <ActionButton
                  label="Nueva configuración"
                  onClick={openCreateModal}
                  variant="primary"
                  size="sm"
                  icon={<Icon name="FaPlus" />}
                />
              }
            >
              <SmtpTable
                items={smtpItems}
                isLoading={isSmtpLoading}
                onEdit={openEditModal}
                onActivate={handleActivate}
                onSend={openSendTestModal}
                onDelete={handleDelete}
              />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="AI"
              icon="FaBrain"
              description="Administra los proveedores, credenciales y modelos de IA que MinuetAItor podrá usar para analizar, resumir y apoyar el procesamiento de minutas."
              actions={
                <ActionButton
                  label="Nueva configuración"
                  onClick={openCreateAiModal}
                  variant="primary"
                  size="sm"
                  icon={<Icon name="FaPlus" />}
                />
              }
            >
              <AIProviderTable
                items={aiItems}
                isLoading={isAiLoading}
                providerLabelMap={aiProviderLabelMap}
                onEdit={openEditAiModal}
                onValidate={openAiValidationModal}
                onToggleActive={handleAiToggleActive}
                onDelete={handleAiDelete}
              />
            </SectionCard>
          </div>
        </div>
      )}

      {activeTab === "maintenance" && (
        <PlaceholderPanel
          title="Mantenimiento"
          description="Aquí podemos continuar después con jobs programados, observabilidad de colas y acciones operativas del scheduler sin mezclarlo con el avance de SMTP."
        />
      )}

      {activeTab === "backups" && (
        <PlaceholderPanel
          title="Respaldos"
          description="Esta pestaña queda reservada para políticas de backup e historial. No la estoy tocando en esta iteración para mantener el cambio pequeño y coherente."
        />
      )}
    </div>
  );
};

export default SystemSettings;
