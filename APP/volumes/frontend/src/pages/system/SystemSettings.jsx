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
    description: "Rutinas, colas y observabilidad",
  },
  {
    id: "backups",
    label: "Respaldos",
    icon: "FaDatabase",
    description: "Políticas y conservación",
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

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(amount >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const clonePlainObject = (value) => JSON.parse(JSON.stringify(value));
const BACKUP_STORAGE_ROOT_CONTAINER = "/app/remote_data/backups";
const BACKUP_STORAGE_ROOT_HOST = "./APP/data/backend_data/backups";

const INITIAL_MAINTENANCE_DRAFT = {
  sessionCleanupEnabled: true,
  sessionCleanupCron: "0 * * * *",
  sessionCleanupMode: "soft_logout",
  tempCleanupEnabled: true,
  tempCleanupCron: "0 3 * * *",
  tempCleanupMaxAgeDays: 7,
  monitorMaintenanceQueueEnabled: true,
  maintenanceQueueWarningThreshold: 25,
  monitorDlqEnabled: true,
  dlqWarningThreshold: 10,
};

const INITIAL_BACKUPS_DRAFT = {
  backupRetentionDays: 14,
  backupHistoryVisible: true,
  backupPurgeQueue: "queue:maintenance / backup_purge",
  policies: {
    database: {
      enabled: true,
      cron: "0 2 * * *",
      destination: "backend_shared",
      pathPrefix: "/app/remote_data/backups/database",
      fileFormat: "sql_gzip",
      verificationMode: "manifest",
      notifyByEmail: true,
      notifyRecipientName: "Operaciones DB",
      notifyRecipientEmail: "dba@minuet.local",
    },
    objects: {
      enabled: false,
      cron: "30 2 * * *",
      destination: "backend_shared",
      pathPrefix: "/app/remote_data/backups/objects",
      fileFormat: "tar_gzip",
      verificationMode: "inventory",
      notifyByEmail: false,
      notifyRecipientName: "",
      notifyRecipientEmail: "",
    },
    full: {
      enabled: true,
      cron: "0 4 * * 0",
      destination: "backend_shared",
      pathPrefix: "/app/remote_data/backups/full",
      fileFormat: "tar_gzip",
      verificationMode: "checksum",
      notifyByEmail: true,
      notifyRecipientName: "Respaldo general",
      notifyRecipientEmail: "backup@minuet.local",
    },
  },
};

const BACKUP_POLICY_DEFINITIONS = [
  {
    id: "database",
    title: "Base de datos",
    shortLabel: "BD",
    icon: "FaDatabase",
    source: "MariaDB",
    queue: "queue:maintenance / db_backup",
    description: "Respalda la base de datos operativa para restauraciones de estructura y datos.",
    formatOptions: [
      { value: "sql_gzip", label: "SQL comprimido (.sql.gz)" },
      { value: "sql_plain", label: "SQL plano (.sql)" },
    ],
  },
  {
    id: "objects",
    title: "Objetos y adjuntos",
    shortLabel: "MinIO",
    icon: "FaCloud",
    source: "Buckets MinIO / adjuntos",
    queue: "queue:maintenance / object_backup",
    description: "Respalda buckets, adjuntos y artefactos almacenados fuera de la base de datos.",
    formatOptions: [
      { value: "tar_gzip", label: "Tar comprimido (.tar.gz)" },
      { value: "tar_plain", label: "Tar plano (.tar)" },
    ],
  },
  {
    id: "full",
    title: "Respaldo completo",
    shortLabel: "FULL",
    icon: "FaGears",
    source: "MariaDB + objetos + configuración",
    queue: "queue:maintenance / full_backup",
    description: "Agrupa un paquete integral para restauración completa del sistema.",
    formatOptions: [
      { value: "tar_gzip", label: "Tar comprimido (.tar.gz)" },
      { value: "zip_bundle", label: "Paquete zip (.zip)" },
    ],
  },
];

const BACKUP_VERIFICATION_OPTIONS = [
  { value: "none", label: "Solo registrar ejecución" },
  { value: "inventory", label: "Verificar inventario de archivos" },
  { value: "manifest", label: "Verificar manifiesto del paquete" },
  { value: "checksum", label: "Validar checksum final" },
];

const BACKUP_VERIFICATION_LABELS = {
  none: "Solo registro",
  inventory: "Inventario",
  manifest: "Manifiesto",
  checksum: "Checksum",
};

const BACKUP_DESTINATION_LABELS = {
  backend_shared: "Carpeta compartida backend",
};

const CRON_FIELD_LABELS = ["minuto", "hora", "día", "mes", "día semana"];
const CRON_DAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CRON_PRESET_GROUPS = [
  {
    title: "Rutinas operativas",
    items: [
      { label: "Cada hora", cron: "0 * * * *", description: "Adecuado para limpieza de sesiones con alta rotación." },
      { label: "Cada 2 horas", cron: "0 */2 * * *", description: "Útil para sesiones activas sin cargar demasiado la cola." },
      { label: "Cada 4 horas", cron: "0 */4 * * *", description: "Buena frecuencia para mantenimiento liviano." },
      { label: "Cada 6 horas", cron: "0 */6 * * *", description: "Sirve para limpieza técnica y revisiones espaciadas." },
      { label: "Cada 12 horas", cron: "0 */12 * * *", description: "Pensado para ejecuciones de mañana y noche." },
      { label: "Lunes a viernes 08:00", cron: "0 8 * * 1-5", description: "Adecuado para tareas visibles en horario laboral." },
    ],
  },
  {
    title: "Ventanas nocturnas",
    items: [
      { label: "Todos los días 01:00", cron: "0 1 * * *", description: "Ventana temprana antes de respaldos más pesados." },
      { label: "Todos los días 02:00", cron: "0 2 * * *", description: "Frecuencia realista para respaldo diario de base de datos." },
      { label: "Todos los días 02:30", cron: "30 2 * * *", description: "Alineado con respaldo diario de objetos o adjuntos." },
      { label: "Todos los días 03:00", cron: "0 3 * * *", description: "Útil para limpieza diaria de temporales." },
      { label: "Todos los días 04:00", cron: "0 4 * * *", description: "Buena ventana cuando ya terminaron otras rutinas nocturnas." },
      { label: "Todos los días 05:00", cron: "0 5 * * *", description: "Alternativa tardía si la madrugada ya está ocupada." },
    ],
  },
  {
    title: "Respaldos profundos",
    items: [
      { label: "Sábados 23:00", cron: "0 23 * * 6", description: "Prepara una ventana de fin de semana para tareas largas." },
      { label: "Domingos 02:00", cron: "0 2 * * 0", description: "Adecuado para validaciones o respaldos semanales." },
      { label: "Domingos 04:00", cron: "0 4 * * 0", description: "Frecuencia típica para respaldo full semanal." },
      { label: "Lunes 02:00", cron: "0 2 * * 1", description: "Útil si el ciclo operativo cierra el domingo." },
      { label: "Primer día del mes 02:00", cron: "0 2 1 * *", description: "Pensado para conservación o archivado mensual." },
      { label: "Día 15 de cada mes 02:00", cron: "0 2 15 * *", description: "Opción intermedia para archivado quincenal." },
    ],
  },
];

const normalizeCronExpression = (value) => String(value || "").trim().replace(/\s+/g, " ");

const isCronNumberInRange = (value, min, max) => {
  if (!/^\d+$/.test(String(value || ""))) return false;
  const numericValue = Number(value);
  return numericValue >= min && numericValue <= max;
};

const validateCronSegment = (segment, min, max) => {
  const rawSegment = String(segment || "").trim();
  if (!rawSegment) return false;

  const [base, step] = rawSegment.split("/");
  if (rawSegment.split("/").length > 2) return false;

  if (step !== undefined) {
    if (!/^\d+$/.test(step) || Number(step) <= 0) return false;
  }

  if (base === "*") return true;

  if (base.includes("-")) {
    const [start, end] = base.split("-");
    if (!isCronNumberInRange(start, min, max) || !isCronNumberInRange(end, min, max)) return false;
    return Number(start) <= Number(end);
  }

  return isCronNumberInRange(base, min, max);
};

const validateCronFieldValue = (fieldValue, min, max) => {
  const parts = String(fieldValue || "").split(",");
  if (!parts.length) return false;
  return parts.every((part) => validateCronSegment(part, min, max));
};

const validateCronExpression = (value) => {
  const normalizedValue = normalizeCronExpression(value);
  if (!normalizedValue) {
    return {
      isValid: false,
      normalizedValue,
      message: "Debes ingresar una programación cron de 5 campos.",
    };
  }

  const fields = normalizedValue.split(" ");
  if (fields.length !== 5) {
    return {
      isValid: false,
      normalizedValue,
      message: "La expresión debe tener 5 campos: minuto hora día mes día-semana.",
    };
  }

  const ranges = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];

  for (let index = 0; index < fields.length; index += 1) {
    const [min, max] = ranges[index];
    if (!validateCronFieldValue(fields[index], min, max)) {
      return {
        isValid: false,
        normalizedValue,
        message: `El campo ${CRON_FIELD_LABELS[index]} no tiene una sintaxis válida.`,
      };
    }
  }

  return {
    isValid: true,
    normalizedValue,
    message: "",
  };
};

const formatCronTime = (hour, minute) =>
  `${String(Number(hour)).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;

const describeCronExpression = (value) => {
  const validation = validateCronExpression(value);
  if (!validation.isValid) {
    return {
      tone: "danger",
      text: validation.message,
    };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = validation.normalizedValue.split(" ");

  if (validation.normalizedValue === "* * * * *") {
    return { tone: "info", text: "Cada minuto." };
  }

  if (/^\*\/\d+$/.test(minute) && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { tone: "info", text: `Cada ${minute.split("/")[1]} minutos.` };
  }

  if (/^\d+$/.test(minute) && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { tone: "info", text: `Cada hora al minuto ${String(minute).padStart(2, "0")}.` };
  }

  if (/^\d+$/.test(minute) && /^\*\/\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return {
      tone: "info",
      text: `Cada ${hour.split("/")[1]} horas, al minuto ${String(minute).padStart(2, "0")}.`,
    };
  }

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return {
      tone: "active",
      text: `Todos los días a las ${formatCronTime(hour, minute)}.`,
    };
  }

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && /^\d+$/.test(dayOfWeek)) {
    return {
      tone: "active",
      text: `Cada ${CRON_DAY_LABELS[Number(dayOfWeek)]} a las ${formatCronTime(hour, minute)}.`,
    };
  }

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\*\/\d+$/.test(dayOfMonth) && month === "*" && dayOfWeek === "*") {
    return {
      tone: "active",
      text: `Cada ${dayOfMonth.split("/")[1]} días a las ${formatCronTime(hour, minute)}.`,
    };
  }

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\d+$/.test(dayOfMonth) && month === "*" && dayOfWeek === "*") {
    return {
      tone: "active",
      text: `El día ${String(dayOfMonth).padStart(2, "0")} de cada mes a las ${formatCronTime(hour, minute)}.`,
    };
  }

  return {
    tone: "info",
    text: "Programación personalizada válida.",
  };
};

const inferImportPackageAnalysis = (file) => {
  const rawName = String(file?.name || "").trim();
  const lowerName = rawName.toLowerCase();
  const format =
    lowerName.endsWith(".tar.gz") ? "tar.gz" :
    lowerName.endsWith(".tgz") ? "tgz" :
    lowerName.endsWith(".zip") ? "zip" :
    rawName.includes(".") ? rawName.split(".").pop() :
    "desconocido";

  if (/\b(db|database|mariadb|mysql)\b/.test(lowerName)) {
    return {
      file,
      scope: "BD",
      source: "MariaDB",
      format,
      restoreImpact: "limpiará la base de datos activa y cargará desde cero solo el contenido del paquete analizado",
    };
  }

  if (/\b(minio|object|objects|bucket|adjunto|artifact|artefact)\b/.test(lowerName)) {
    return {
      file,
      scope: "MinIO",
      source: "Buckets MinIO / adjuntos",
      format,
      restoreImpact: "limpiará los objetos y adjuntos activos antes de cargar desde cero el contenido del paquete analizado",
    };
  }

  return {
    file,
    scope: "FULL",
    source: "MariaDB + objetos + configuración",
    format,
    restoreImpact: "limpiará toda la persistencia activa del sistema antes de cargar desde cero el contenido del paquete analizado",
  };
};

const BACKUP_HISTORY_ITEMS = [
  {
    id: "backup-full-2026-05-17-0400",
    scope: "FULL",
    source: "MariaDB + objetos + configuración",
    restoreImpact: "reemplazará base de datos, objetos y configuración operativa",
    createdAt: "2026-05-17T04:00:00",
    name: "minuetaitor-full-2026-05-17.tar.gz",
    sizeBytes: 428734218,
    status: "Disponible",
    tone: "active",
    storagePath: "/app/remote_data/backups/full/2026/05/17/minuetaitor-full-2026-05-17.tar.gz",
  },
  {
    id: "backup-db-2026-05-17-0200",
    scope: "BD",
    source: "MariaDB",
    restoreImpact: "reemplazará solo la base de datos operativa",
    createdAt: "2026-05-17T02:00:00",
    name: "minuetaitor-db-2026-05-17.sql.gz",
    sizeBytes: 186734218,
    status: "Verificado",
    tone: "info",
    storagePath: "/app/remote_data/backups/database/2026/05/17/minuetaitor-db-2026-05-17.sql.gz",
  },
  {
    id: "backup-minio-2026-05-17-0230",
    scope: "MinIO",
    source: "Buckets y adjuntos",
    restoreImpact: "reemplazará objetos, adjuntos y artefactos respaldados",
    createdAt: "2026-05-17T02:30:00",
    name: "minuetaitor-objects-2026-05-17.tar.gz",
    sizeBytes: 219118904,
    status: "Verificado",
    tone: "info",
    storagePath: "/app/remote_data/backups/objects/2026/05/17/minuetaitor-objects-2026-05-17.tar.gz",
  },
  {
    id: "backup-db-2026-05-16-0200",
    scope: "BD",
    source: "MariaDB",
    restoreImpact: "reemplazará solo la base de datos operativa",
    createdAt: "2026-05-16T02:00:00",
    name: "minuetaitor-db-2026-05-16.sql.gz",
    sizeBytes: 182904552,
    status: "Disponible",
    tone: "active",
    storagePath: "/app/remote_data/backups/database/2026/05/16/minuetaitor-db-2026-05-16.sql.gz",
  },
];

const Header = () => (
  <div>
    <div>
      <h1 className={`flex items-center gap-3 text-3xl font-bold ${TXT_TITLE}`}>
        <Icon name="FaGears" className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        Sistema
      </h1>
      <p className={`mt-2 max-w-3xl text-sm ${TXT_BODY}`}>
        Administra integraciones globales con configuraciones persistidas, activación controlada y validación previa al guardado.
      </p>
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

const MaintenanceToggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-disabled={disabled}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={[
      "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors",
      disabled
        ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-70 dark:border-gray-700 dark:bg-gray-800"
        : checked
          ? "border-primary-500 bg-primary-500"
          : "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700",
    ].join(" ")}
  >
    <span
      className={[
        "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-6" : "translate-x-1",
      ].join(" ")}
    />
  </button>
);

const MaintenanceField = ({ label, hint, children }) => (
  <label className="block">
    <span className={`block text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{label}</span>
    {hint ? <span className={`mt-1 block text-xs ${TXT_META}`}>{hint}</span> : null}
    <div className="mt-3">{children}</div>
  </label>
);

const MaintenanceInput = ({ invalid = false, className = "", ...props }) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition",
      invalid
        ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-red-700 dark:focus:ring-red-900/30"
        : "border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-gray-600 dark:focus:ring-primary-900/40",
      "dark:bg-gray-800 dark:text-white",
      props.disabled ? "cursor-not-allowed opacity-70" : "",
      className,
    ].join(" ")}
  />
);

const MaintenanceSelect = ({ className = "", ...props }) => (
  <select
    {...props}
    className={[
      "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition",
      "focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900/40",
      props.disabled ? "cursor-not-allowed opacity-70" : "",
      className,
    ].join(" ")}
  />
);

const CronPresetModal = ({ title, currentValue, onClose, onSelect }) => (
  <div className="flex min-h-[90vh] w-full items-center justify-center px-4">
    <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
        <div>
          <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>{title || "Programación cron"}</h2>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            Puedes elegir una programación predefinida y luego ajustarla manualmente si lo necesitas.
          </p>
        </div>
      </div>

      <div className="space-y-6 overflow-y-auto px-6 py-6">
        <div className="space-y-5">
          {CRON_PRESET_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{group.title}</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const isSelected = normalizeCronExpression(currentValue) === normalizeCronExpression(item.cron);

                  return (
                    <button
                      key={`${group.title}-${item.cron}`}
                      type="button"
                      onClick={() => onSelect(item.cron)}
                      className={[
                        "relative flex h-full min-h-[172px] flex-col justify-between rounded-2xl border px-5 py-4 text-center transition",
                        isSelected
                          ? "border-primary-400 bg-primary-50/60 shadow-sm dark:border-primary-600 dark:bg-primary-900/20"
                          : "border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/40 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-700 dark:hover:bg-primary-900/10",
                      ].join(" ")}
                    >
                      {isSelected ? (
                        <div className="absolute right-4 top-4">
                          <StatusBadge tone="active">Actual</StatusBadge>
                        </div>
                      ) : null}

                      <div>
                        <p className={`text-sm font-semibold ${TXT_TITLE}`}>{item.label}</p>
                        <p className={`mt-3 text-sm ${TXT_BODY}`}>{item.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-center gap-3">
                        <span className="inline-flex max-w-full items-center overflow-x-auto whitespace-nowrap rounded-full bg-primary-50 px-3 py-1 font-mono text-xs font-semibold text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                          {item.cron}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const CronInputField = ({
  value,
  onChange,
  onBlur,
  onOpenPlanner,
  placeholder,
  errorMessage,
}) => {
  const cronDescription = describeCronExpression(value);
  const isCurrentValueValid = validateCronExpression(value).isValid;

  return (
    <div>
      <div className="flex items-start gap-2">
        <MaintenanceInput
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          invalid={Boolean(errorMessage)}
          className="flex-1"
        />
        <ActionButton
          variant="soft"
          size="sm"
          icon={<Icon name="FaClock" />}
          tooltip="Abrir programador"
          onClick={onOpenPlanner}
          className="shrink-0"
        />
      </div>

      <div className="mt-2 min-h-[20px]">
        {errorMessage ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : !isCurrentValueValid ? (
          <p className={`text-xs ${TXT_META}`}>Formato Linux de 5 campos: minuto hora día mes día-semana.</p>
        ) : (
          <p className={`text-xs ${cronDescription.tone === "active" ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
            {cronDescription.text}
          </p>
        )}
      </div>
    </div>
  );
};

const ConfigActionBar = ({
  hasChanges,
  onDiscard,
  onSave,
  saveLabel = "Guardar cambios",
  dirtyMessage = "Estás editando un borrador. Los cambios se aplicarán recién al guardar.",
  cleanMessage = "La última configuración guardada sigue activa hasta que edites algo nuevo.",
}) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      <StatusBadge tone={hasChanges ? "warning" : "inactive"}>
        {hasChanges ? "Cambios sin guardar" : "Sin cambios pendientes"}
      </StatusBadge>
      {(hasChanges ? dirtyMessage : cleanMessage) ? (
        <p className={`text-sm ${TXT_BODY}`}>
          {hasChanges ? dirtyMessage : cleanMessage}
        </p>
      ) : null}
    </div>

    <div className="flex flex-wrap gap-2">
      <ActionButton
        label="Descartar"
        variant="soft"
        size="sm"
        onClick={onDiscard}
        disabled={!hasChanges}
      />
      <ActionButton
        label={saveLabel}
        variant="primary"
        size="sm"
        onClick={onSave}
        disabled={!hasChanges}
      />
    </div>
  </div>
);

const DraftModeNotice = () => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/10">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Modo borrador</h3>
          <StatusBadge tone="warning">Requiere guardar</StatusBadge>
        </div>
        <p className={`mt-2 text-sm ${TXT_BODY}`}>
          Los campos y toggles de esta pantalla solo actualizan el borrador visual. Nada queda aplicado hasta usar
          <span className="font-semibold"> Guardar cambios</span>.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-200/80 bg-white/70 px-4 py-3 dark:border-amber-800/60 dark:bg-slate-900/40">
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Referencia</p>
        <p className={`mt-1 text-sm ${TXT_TITLE}`}>El resumen conserva la última versión guardada.</p>
      </div>
    </div>
  </div>
);

const RestoreBackupModal = ({ item, onClose, onConfirm }) => (
  <div className="flex w-full justify-center px-4">
    <div className="w-full max-w-4xl rounded-[28px] border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Restaurar respaldo</h2>
              <StatusBadge tone="warning">Limpia y carga desde cero</StatusBadge>
            </div>
            <p className={`mt-2 text-sm ${TXT_BODY}`}>
              Revisa el paquete seleccionado antes de continuar con la restauración.
            </p>
          </div>
          <ActionButton
            variant="soft"
            size="sm"
            icon={<Icon name="FaXmark" />}
            tooltip="Cerrar"
            onClick={onClose}
            className="hover:scale-100 active:scale-100"
          />
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
          <p className={`text-sm font-medium ${TXT_TITLE}`}>
            Esta restauración primero limpia las persistencias activas del sistema y luego carga el contenido del paquete seleccionado desde cero.
          </p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            El proceso sobrescribe la información vigente del ámbito respaldado y no debe ejecutarse como una acción menor.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <MaintenanceField label="Paquete" hint="Archivo seleccionado">
            <MaintenanceInput value={item?.name || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tipo" hint="Cobertura del respaldo">
            <MaintenanceInput value={item?.scope || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Fecha" hint="Momento de generación">
            <MaintenanceInput value={formatDateTime(item?.createdAt)} disabled />
          </MaintenanceField>
          <MaintenanceField label="Origen" hint="Contenido respaldado">
            <MaintenanceInput value={item?.source || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tamaño" hint="Volumen del paquete">
            <MaintenanceInput value={formatBytes(item?.sizeBytes)} disabled />
          </MaintenanceField>
          <MaintenanceField label="Estado" hint="Estado actual registrado">
            <MaintenanceInput value={item?.status || "—"} disabled />
          </MaintenanceField>
        </div>

        <MaintenanceField label="Ruta del paquete" hint="Ubicación registrada en el almacenamiento compartido">
          <MaintenanceInput value={item?.storagePath || "—"} disabled />
        </MaintenanceField>

        <MaintenanceField label="Impacto de restauración" hint="Efecto esperado sobre las persistencias activas">
          <MaintenanceInput value={item?.restoreImpact || "—"} disabled />
        </MaintenanceField>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${TXT_BODY}`}>
          Si continúas, el sistema quedará limpio en el ámbito afectado y se recargará únicamente con este paquete.
        </p>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
          <ActionButton
            label="Cancelar"
            variant="soft"
            size="sm"
            onClick={onClose}
            className="sm:min-w-[120px]"
          />
          <ActionButton
            label="Limpiar y restaurar"
            variant="primary"
            size="sm"
            onClick={onConfirm}
            className="sm:min-w-[180px]"
          />
        </div>
      </div>
    </div>
  </div>
);

const ImportBackupPackageModal = ({ onClose, onAnalyze }) => {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Importar paquete externo</h2>
              <p className={`mt-2 text-sm ${TXT_BODY}`}>
                Selecciona un paquete de respaldo para analizarlo antes de permitir la importación.
              </p>
            </div>
            <ActionButton
              variant="soft"
              size="sm"
              icon={<Icon name="FaXmark" />}
              tooltip="Cerrar"
              onClick={onClose}
              className="hover:scale-100 active:scale-100"
            />
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50/70 px-5 py-6 dark:border-gray-700 dark:bg-slate-900/30">
            <input
              ref={inputRef}
              type="file"
              accept=".tar.gz,.tgz,.zip"
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Paquete a revisar</h3>
                <p className={`mt-2 text-sm ${TXT_BODY}`}>
                  El análisis no importa el paquete todavía. Solo inspecciona el archivo y resume el alcance detectado.
                </p>
              </div>

              <ActionButton
                label={selectedFile ? "Cambiar paquete" : "Seleccionar paquete"}
                variant="primary"
                size="sm"
                onClick={() => inputRef.current?.click()}
              />
            </div>
          </div>

          {selectedFile ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <MaintenanceField label="Archivo" hint="Paquete seleccionado">
                <MaintenanceInput value={selectedFile.name} disabled />
              </MaintenanceField>
              <MaintenanceField label="Tamaño" hint="Volumen recibido">
                <MaintenanceInput value={formatBytes(selectedFile.size)} disabled />
              </MaintenanceField>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
              <p className={`text-sm ${TXT_BODY}`}>Selecciona un paquete para continuar con el análisis previo.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-5 dark:border-gray-700">
          <ActionButton
            label="Cancelar"
            variant="soft"
            size="sm"
            onClick={onClose}
          />
          <ActionButton
            label="Analizar paquete"
            variant="primary"
            size="sm"
            onClick={() => selectedFile && onAnalyze(selectedFile)}
            disabled={!selectedFile}
          />
        </div>
      </div>
    </div>
  );
};

const ImportBackupAnalysisLoadingModal = () => (
  <div className="flex w-full justify-center px-4">
    <div className="w-full max-w-2xl rounded-[28px] bg-white dark:bg-gray-800">
      <div className="px-6 py-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
          <Icon name="spinner" className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Analizando paquete</h2>
        <p className={`mx-auto mt-3 max-w-xl text-sm ${TXT_BODY}`}>
          Se está inspeccionando el paquete cargado para identificar su alcance, formato y efecto de importación antes de continuar.
        </p>
      </div>
    </div>
  </div>
);

const ImportBackupSummaryModal = ({ analysis, onClose, onImport }) => (
  <div className="flex w-full justify-center px-4">
    <div className="w-full max-w-4xl rounded-[28px] border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Resumen del paquete</h2>
              <StatusBadge tone="warning">Importación destructiva</StatusBadge>
            </div>
            <p className={`mt-2 text-sm ${TXT_BODY}`}>
              El análisis terminó. Revisa el alcance antes de habilitar la importación.
            </p>
          </div>
          <ActionButton
            variant="soft"
            size="sm"
            icon={<Icon name="FaXmark" />}
            tooltip="Cerrar"
            onClick={onClose}
            className="hover:scale-100 active:scale-100"
          />
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
          <p className={`text-sm font-medium ${TXT_TITLE}`}>
            Si importas este paquete, se perderá toda la persistencia anterior del ámbito afectado antes de cargar la información analizada.
          </p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            La importación limpia primero el contenido activo y luego carga desde cero la información contenida en el paquete.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <MaintenanceField label="Archivo" hint="Nombre recibido">
            <MaintenanceInput value={analysis?.file?.name || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tipo detectado" hint="Cobertura estimada por el análisis">
            <MaintenanceInput value={analysis?.scope || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Formato" hint="Formato reconocido por nombre de archivo">
            <MaintenanceInput value={analysis?.format || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Origen" hint="Contenido estimado del paquete">
            <MaintenanceInput value={analysis?.source || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tamaño" hint="Volumen del archivo cargado">
            <MaintenanceInput value={formatBytes(analysis?.file?.size)} disabled />
          </MaintenanceField>
          <MaintenanceField label="Fecha archivo" hint="Última fecha del archivo recibido">
            <MaintenanceInput value={formatDateTime(analysis?.file?.lastModified)} disabled />
          </MaintenanceField>
        </div>

        <MaintenanceField label="Impacto de importación" hint="Efecto antes de cargar el paquete">
          <MaintenanceInput value={analysis?.restoreImpact || "—"} disabled />
        </MaintenanceField>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${TXT_BODY}`}>
          El botón de importación ejecutará una carga desde cero y perderás toda persistencia anterior del ámbito detectado.
        </p>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
          <ActionButton
            label="Cancelar"
            variant="soft"
            size="sm"
            onClick={onClose}
          />
          <ActionButton
            label="Importar"
            variant="primary"
            size="sm"
            onClick={onImport}
          />
        </div>
      </div>
    </div>
  </div>
);

const IMPORT_EXECUTION_STEPS = [
  "Validando paquete seleccionado",
  "Limpiando persistencia anterior",
  "Preparando estructura base",
  "Cargando contenido del paquete",
  "Registrando resultado de importación",
];

const RESTORE_EXECUTION_STEPS_BY_SCOPE = {
  BD: [
    "Validando paquete de base de datos",
    "Limpiando base de datos activa",
    "Restaurando estructura y datos",
    "Verificando consistencia final",
    "Registrando resultado de restauración",
  ],
  MinIO: [
    "Validando paquete de objetos",
    "Limpiando objetos y adjuntos activos",
    "Restaurando buckets y artefactos",
    "Verificando inventario restaurado",
    "Registrando resultado de restauración",
  ],
  FULL: [
    "Validando paquete completo",
    "Limpiando persistencia activa del sistema",
    "Restaurando base de datos",
    "Restaurando objetos y configuración",
    "Registrando resultado de restauración",
  ],
};

const ImportBackupExecutionModal = ({ analysis, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= IMPORT_EXECUTION_STEPS.length) {
      const doneTimer = window.setTimeout(() => {
        onComplete?.();
      }, 900);
      return () => window.clearTimeout(doneTimer);
    }

    const stepTimer = window.setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
    }, 900);

    return () => window.clearTimeout(stepTimer);
  }, [currentStep, onComplete]);

  const isDone = currentStep >= IMPORT_EXECUTION_STEPS.length;

  return (
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Proceso de importación</h2>
            <StatusBadge tone={isDone ? "active" : "warning"}>
              {isDone ? "Completado" : "En curso"}
            </StatusBadge>
          </div>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            Se está ejecutando la importación del paquete `{analysis?.file?.name || "seleccionado"}`.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
            <p className={`text-sm ${TXT_BODY}`}>
              Durante este proceso se reemplaza la persistencia anterior del ámbito detectado antes de cargar desde cero la información del paquete.
            </p>
          </div>

          <div className="space-y-3">
            {IMPORT_EXECUTION_STEPS.map((step, index) => {
              const isCompleted = index < currentStep;
              const isActive = index === currentStep && !isDone;

              return (
                <div
                  key={`import-step-${step}`}
                  className={[
                    "flex items-center gap-4 rounded-2xl border px-4 py-4 transition",
                    isCompleted
                      ? "border-green-200 bg-green-50/70 dark:border-green-800/60 dark:bg-green-950/10"
                      : isActive
                        ? "border-amber-200 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/10"
                        : "border-gray-200 bg-slate-50/70 dark:border-gray-700 dark:bg-slate-900/30",
                  ].join(" ")}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-current/10 bg-white dark:bg-gray-800">
                    {isCompleted ? (
                      <Icon name="check" className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : isActive ? (
                      <Icon name="spinner" className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                    ) : (
                      <span className={`text-sm font-semibold ${TXT_META}`}>{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${TXT_TITLE}`}>{step}</p>
                    <p className={`mt-1 text-xs ${TXT_META}`}>
                      {isCompleted ? "Tarea completada" : isActive ? "Tarea en ejecución" : "Pendiente"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const RestoreBackupExecutionModal = ({ item, onComplete }) => {
  const steps = RESTORE_EXECUTION_STEPS_BY_SCOPE[item?.scope] ?? RESTORE_EXECUTION_STEPS_BY_SCOPE.FULL;
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= steps.length) {
      const doneTimer = window.setTimeout(() => {
        onComplete?.();
      }, 900);
      return () => window.clearTimeout(doneTimer);
    }

    const stepTimer = window.setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
    }, 900);

    return () => window.clearTimeout(stepTimer);
  }, [currentStep, steps.length, onComplete]);

  const isDone = currentStep >= steps.length;

  return (
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Proceso de restauración</h2>
            <StatusBadge tone={isDone ? "active" : "warning"}>
              {isDone ? "Completado" : "En curso"}
            </StatusBadge>
          </div>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            Se está ejecutando la restauración del paquete `{item?.name || "seleccionado"}` con alcance {item?.scope || "FULL"}.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
            <p className={`text-sm ${TXT_BODY}`}>
              Las tareas mostradas a continuación están alineadas con el tipo de restauración seleccionado y se ejecutan sobre la persistencia activa del sistema.
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const isCompleted = index < currentStep;
              const isActive = index === currentStep && !isDone;

              return (
                <div
                  key={`restore-step-${step}`}
                  className={[
                    "flex items-center gap-4 rounded-2xl border px-4 py-4 transition",
                    isCompleted
                      ? "border-green-200 bg-green-50/70 dark:border-green-800/60 dark:bg-green-950/10"
                      : isActive
                        ? "border-amber-200 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/10"
                        : "border-gray-200 bg-slate-50/70 dark:border-gray-700 dark:bg-slate-900/30",
                  ].join(" ")}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-current/10 bg-white dark:bg-gray-800">
                    {isCompleted ? (
                      <Icon name="check" className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : isActive ? (
                      <Icon name="spinner" className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                    ) : (
                      <span className={`text-sm font-semibold ${TXT_META}`}>{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${TXT_TITLE}`}>{step}</p>
                    <p className={`mt-1 text-xs ${TXT_META}`}>
                      {isCompleted ? "Tarea completada" : isActive ? "Tarea en ejecución" : "Pendiente"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompletedRestartModal = ({ title, description, onClose }) => {
  const RESTART_SECONDS = 15;
  const [secondsLeft, setSecondsLeft] = useState(RESTART_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onClose?.();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft, onClose]);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / RESTART_SECONDS;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500" />

        <div className="flex flex-col items-center p-8 text-center">
          <div className="mb-5 h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700">
            <img
              src="/images/chinchinAItor.jpg"
              alt="MinuetAItor"
              className="h-full w-full object-cover"
            />
          </div>

          <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
            {title || "Proceso terminado"}
          </h2>
          <p className="mb-6 max-w-[30ch] text-sm text-gray-500 dark:text-gray-400">
            {description || "La operación fue procesada correctamente."}
          </p>

          <div className="relative mb-6 flex items-center justify-center">
            <svg width="96" height="96" className="-rotate-90">
              <circle
                cx="48" cy="48" r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="48" cy="48" r={radius}
                fill="none"
                stroke="rgb(59 130 246)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.9s linear" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {secondsLeft}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                segundos
              </span>
            </div>
          </div>

          <div className="mb-6 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Para aplicar los cambios, el sistema se reiniciará automáticamente en {secondsLeft} segundos.
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              Entendido
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-8 py-4 dark:border-gray-800 dark:bg-gray-800/50">
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            MinuetAItor · Reinicio controlado para aplicar cambios
          </p>
        </div>
      </div>
    </div>
  );
};

const MaintenancePanel = () => {
  const [draft, setDraft] = useState(INITIAL_MAINTENANCE_DRAFT);
  const [savedDraft, setSavedDraft] = useState(INITIAL_MAINTENANCE_DRAFT);
  const [cronErrors, setCronErrors] = useState({});

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (key.endsWith("Cron") && cronErrors[key]) {
      const validation = validateCronExpression(value);
      setCronErrors((prev) => ({
        ...prev,
        [key]: validation.isValid ? "" : validation.message,
      }));
    }
  };

  const validateCronKey = (key, rawValue = draft[key]) => {
    const validation = validateCronExpression(rawValue);
    if (validation.normalizedValue && validation.normalizedValue !== rawValue) {
      setDraft((prev) => ({ ...prev, [key]: validation.normalizedValue }));
    }
    setCronErrors((prev) => ({
      ...prev,
      [key]: validation.isValid ? "" : validation.message,
    }));
    return validation;
  };

  const openCronPlanner = (key, title) => {
    ModalManager.show({
      type: "custom",
      title,
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <CronPresetModal
          title={title}
          currentValue={draft[key]}
          onClose={() => ModalManager.closeAll()}
          onSelect={(cronValue) => {
            updateDraft(key, cronValue);
            setCronErrors((prev) => ({ ...prev, [key]: "" }));
            ModalManager.closeAll();
          }}
        />
      ),
    });
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const handleDiscard = () => {
    setDraft(savedDraft);
    setCronErrors({});
  };

  const handleSave = () => {
    const cronKeys = ["sessionCleanupCron", "tempCleanupCron"];
    const invalidEntries = cronKeys
      .map((key) => [key, validateCronKey(key, draft[key])])
      .filter(([, validation]) => !validation.isValid);

    if (invalidEntries.length) {
      toastError("Programación inválida", "Revisa los campos de programación antes de guardar.");
      return;
    }

    setSavedDraft(draft);
    toastSuccess("Mantenimiento actualizado", "La configuración de mantenimiento fue aplicada.");
  };

  const maintenanceSummaryItems = [
    {
      key: "summary-sessions",
      title: "Limpieza de sesiones",
      tone: savedDraft.sessionCleanupEnabled ? "active" : "inactive",
      status: savedDraft.sessionCleanupEnabled ? "Habilitada" : "Deshabilitada",
      details: [
        { label: "Frecuencia", value: savedDraft.sessionCleanupCron || "—" },
        {
          label: "Estrategia",
          value:
            savedDraft.sessionCleanupMode === "soft_logout"
              ? "Marcar logout técnico"
              : savedDraft.sessionCleanupMode === "revoke_idle"
                ? "Revocar sesiones inactivas"
                : "Solo registrar hallazgos",
        },
      ],
    },
    {
      key: "summary-temp",
      title: "Limpieza de temporales",
      tone: savedDraft.tempCleanupEnabled ? "active" : "inactive",
      status: savedDraft.tempCleanupEnabled ? "Habilitada" : "Deshabilitada",
      details: [
        { label: "Frecuencia", value: savedDraft.tempCleanupCron || "—" },
        { label: "Retención", value: `${savedDraft.tempCleanupMaxAgeDays} días` },
      ],
    },
    {
      key: "summary-queues",
      title: "Observabilidad de colas",
      tone: savedDraft.monitorMaintenanceQueueEnabled || savedDraft.monitorDlqEnabled ? "info" : "inactive",
      status:
        savedDraft.monitorMaintenanceQueueEnabled || savedDraft.monitorDlqEnabled
          ? "Monitoreo visible"
          : "Monitoreo oculto",
      details: [
        {
          label: "queue:maintenance",
          value: savedDraft.monitorMaintenanceQueueEnabled
            ? `Umbral ${savedDraft.maintenanceQueueWarningThreshold}`
            : "Deshabilitado",
        },
        {
          label: "queue:dlq",
          value: savedDraft.monitorDlqEnabled ? `Umbral ${savedDraft.dlqWarningThreshold}` : "Deshabilitado",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {hasChanges ? <DraftModeNotice /> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Rutinas de limpieza"
          icon="FaFilter"
          description="Define la limpieza de sesiones registradas y archivos temporales del sistema."
        >
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Limpieza de sesiones</h3>
                    <StatusBadge tone={draft.sessionCleanupEnabled ? "active" : "inactive"}>
                      {draft.sessionCleanupEnabled ? "Habilitada" : "Deshabilitada"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Controla la limpieza de sesiones registradas y su tratamiento operativo.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.sessionCleanupEnabled}
                  onChange={(value) => updateDraft("sessionCleanupEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Frecuencia" hint="Programación de la tarea">
                  <CronInputField
                    value={draft.sessionCleanupCron}
                    onChange={(event) => updateDraft("sessionCleanupCron", event.target.value)}
                    onBlur={() => validateCronKey("sessionCleanupCron")}
                    onOpenPlanner={() => openCronPlanner("sessionCleanupCron", "Programación de limpieza de sesiones")}
                    placeholder="0 * * * *"
                    errorMessage={cronErrors.sessionCleanupCron}
                  />
                </MaintenanceField>
                <MaintenanceField label="Estrategia" hint="Qué acción conceptual debería aplicar la rutina">
                  <MaintenanceSelect
                    value={draft.sessionCleanupMode}
                    onChange={(event) => updateDraft("sessionCleanupMode", event.target.value)}
                  >
                    <option value="soft_logout">Marcar logout técnico</option>
                    <option value="revoke_idle">Revocar sesiones inactivas</option>
                    <option value="archive_only">Solo registrar hallazgos</option>
                  </MaintenanceSelect>
                </MaintenanceField>
              </div>
            </div>

            <div className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Limpieza de archivos temporales</h3>
                    <StatusBadge tone={draft.tempCleanupEnabled ? "active" : "inactive"}>
                      {draft.tempCleanupEnabled ? "Habilitada" : "Deshabilitada"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Controla la limpieza de archivos temporales y trazas generadas por procesamiento.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.tempCleanupEnabled}
                  onChange={(value) => updateDraft("tempCleanupEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Frecuencia" hint="Programación de la tarea">
                  <CronInputField
                    value={draft.tempCleanupCron}
                    onChange={(event) => updateDraft("tempCleanupCron", event.target.value)}
                    onBlur={() => validateCronKey("tempCleanupCron")}
                    onOpenPlanner={() => openCronPlanner("tempCleanupCron", "Programación de limpieza de temporales")}
                    placeholder="0 3 * * *"
                    errorMessage={cronErrors.tempCleanupCron}
                  />
                </MaintenanceField>
                <MaintenanceField label="Retención" hint="Días antes de limpiar">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="90"
                    value={draft.tempCleanupMaxAgeDays}
                    onChange={(event) => updateDraft("tempCleanupMaxAgeDays", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Observabilidad Técnica"
          icon="FaServer"
          description="Define alertas visuales para queue:maintenance y queue:dlq."
        >
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de queue:maintenance</h3>
                    <StatusBadge tone={draft.monitorMaintenanceQueueEnabled ? "info" : "inactive"}>
                      {draft.monitorMaintenanceQueueEnabled ? "Visible" : "Oculto"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Muestra alertas cuando se acumulan jobs en la cola de mantenimiento.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorMaintenanceQueueEnabled}
                  onChange={(value) => updateDraft("monitorMaintenanceQueueEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs acumulados antes de mostrar alerta">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.maintenanceQueueWarningThreshold}
                    onChange={(event) => updateDraft("maintenanceQueueWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:maintenance" disabled />
                </MaintenanceField>
              </div>
            </div>

            <div className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de DLQ</h3>
                    <StatusBadge tone={draft.monitorDlqEnabled ? "danger" : "inactive"}>
                      {draft.monitorDlqEnabled ? "Prioritario" : "Oculto"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Muestra alertas para jobs fallidos enviados a la cola DLQ.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorDlqEnabled}
                  onChange={(value) => updateDraft("monitorDlqEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs fallidos para elevar señal">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.dlqWarningThreshold}
                    onChange={(event) => updateDraft("dlqWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:dlq" disabled />
                </MaintenanceField>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Resumen de configuración"
        icon="FaClockRotateLeft"
        description="Vista rápida de lo que quedó definido actualmente en esta pantalla."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {maintenanceSummaryItems.map((item) => (
            <div
              key={item.key}
              className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{item.title}</h3>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
              <div className="mt-4 space-y-3">
                {item.details.map((detail) => (
                  <div key={`${item.key}-${detail.label}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{detail.label}</p>
                    <p className={`mt-1 text-sm ${TXT_TITLE}`}>{detail.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <ConfigActionBar
        hasChanges={hasChanges}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
};

const BackupsPanel = () => {
  const [draft, setDraft] = useState(() => clonePlainObject(INITIAL_BACKUPS_DRAFT));
  const [savedDraft, setSavedDraft] = useState(() => clonePlainObject(INITIAL_BACKUPS_DRAFT));
  const [historyItems, setHistoryItems] = useState(BACKUP_HISTORY_ITEMS);
  const [latestImportAnalysis, setLatestImportAnalysis] = useState(null);
  const [cronErrors, setCronErrors] = useState({});

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updatePolicyDraft = (policyId, key, value) => {
    setDraft((prev) => ({
      ...prev,
      policies: {
        ...prev.policies,
        [policyId]: {
          ...prev.policies[policyId],
          [key]: value,
        },
      },
    }));

    const errorKey = `${policyId}.${key}`;
    if (key === "cron" && cronErrors[errorKey]) {
      const validation = validateCronExpression(value);
      setCronErrors((prev) => ({
        ...prev,
        [errorKey]: validation.isValid ? "" : validation.message,
      }));
    }
  };

  const validatePolicyCron = (policyId, rawValue = draft.policies[policyId]?.cron) => {
    const validation = validateCronExpression(rawValue);
    const errorKey = `${policyId}.cron`;
    if (validation.normalizedValue && validation.normalizedValue !== rawValue) {
      setDraft((prev) => ({
        ...prev,
        policies: {
          ...prev.policies,
          [policyId]: {
            ...prev.policies[policyId],
            cron: validation.normalizedValue,
          },
        },
      }));
    }
    setCronErrors((prev) => ({
      ...prev,
      [errorKey]: validation.isValid ? "" : validation.message,
    }));
    return validation;
  };

  const openPolicyCronPlanner = (policyId, title) => {
    ModalManager.show({
      type: "custom",
      title,
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <CronPresetModal
          title={title}
          currentValue={draft.policies[policyId]?.cron}
          onClose={() => ModalManager.closeAll()}
          onSelect={(cronValue) => {
            updatePolicyDraft(policyId, "cron", cronValue);
            setCronErrors((prev) => ({ ...prev, [`${policyId}.cron`]: "" }));
            ModalManager.closeAll();
          }}
        />
      ),
    });
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const handleDiscard = () => {
    setDraft(clonePlainObject(savedDraft));
    setCronErrors({});
  };

  const handleSave = () => {
    const invalidEntries = BACKUP_POLICY_DEFINITIONS
      .map((policyDefinition) => [policyDefinition.id, validatePolicyCron(policyDefinition.id)])
      .filter(([, validation]) => !validation.isValid);

    if (invalidEntries.length) {
      toastError("Programación inválida", "Revisa las programaciones de respaldo antes de guardar.");
      return;
    }

    setSavedDraft(clonePlainObject(draft));
    toastSuccess("Respaldos actualizados", "Las políticas de respaldo quedaron actualizadas.");
  };

  const backupSummaryItems = [
    ...BACKUP_POLICY_DEFINITIONS.map((policyDefinition) => {
      const policy = savedDraft.policies[policyDefinition.id];
      return {
        key: `summary-${policyDefinition.id}`,
        title: policyDefinition.title,
        tone: policy.enabled ? "active" : "inactive",
        status: policy.enabled ? "Programado" : "Detenido",
        details: [
          { label: "Frecuencia", value: policy.cron || "—" },
          { label: "Almacenamiento", value: BACKUP_DESTINATION_LABELS[policy.destination] ?? policy.destination },
          { label: "Verificación", value: BACKUP_VERIFICATION_LABELS[policy.verificationMode] ?? policy.verificationMode },
          {
            label: "Notificación",
            value: policy.notifyByEmail
              ? `${policy.notifyRecipientName || "Destinatario"} <${policy.notifyRecipientEmail || "sin correo"}>`
              : "Sin correo",
          },
        ],
      };
    }),
    {
      key: "summary-retention",
      title: "Conservación común",
      tone: "info",
      status: `${savedDraft.backupRetentionDays} días`,
      details: [
        { label: "Historial", value: savedDraft.backupHistoryVisible ? "Visible" : "Oculto" },
        { label: "Purge", value: "Interno y silencioso" },
        { label: "Cola técnica", value: savedDraft.backupPurgeQueue || "—" },
        { label: "Ruta host", value: BACKUP_STORAGE_ROOT_HOST },
        { label: "Cobertura", value: "BD, MinIO y Full" },
      ],
    },
  ];

  const handleDownloadBackup = (item) => {
    toastSuccess("Descarga preparada", `Se preparó la descarga de "${item.name}".`);
  };

  const openImportPackageModal = () => {
    ModalManager.show({
      type: "custom",
      title: "Importar paquete externo",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <ImportBackupPackageModal
          onClose={() => ModalManager.closeAll()}
          onAnalyze={(file) => {
            ModalManager.closeAll();
            ModalManager.show({
              type: "custom",
              title: "Analizando paquete",
              size: "clientWide",
              showHeader: false,
              showFooter: false,
              closeOnBackdrop: false,
              content: <ImportBackupAnalysisLoadingModal />,
            });

            window.setTimeout(() => {
              const analysis = inferImportPackageAnalysis(file);
              setLatestImportAnalysis(analysis);
              ModalManager.closeAll();
              ModalManager.show({
                type: "custom",
                title: "Resumen del paquete",
                size: "clientWide",
                showHeader: false,
                showFooter: false,
                content: (
                  <ImportBackupSummaryModal
                    analysis={analysis}
                    onClose={() => ModalManager.closeAll()}
                    onImport={() => {
                      toastSuccess("Importación iniciada", "Proceso de importación iniciado.");
                      ModalManager.closeAll();
                      ModalManager.show({
                        type: "custom",
                        title: "Proceso de importación",
                        size: "clientWide",
                        showHeader: false,
                        showFooter: false,
                        closeOnBackdrop: false,
                        content: (
                          <ImportBackupExecutionModal
                            analysis={analysis}
                            onComplete={() => {
                              ModalManager.closeAll();
                              ModalManager.show({
                                type: "custom",
                                title: "Importación terminada",
                                size: "clientWide",
                                showHeader: false,
                                showFooter: false,
                                closeOnBackdrop: false,
                                content: (
                                  <CompletedRestartModal
                                    title="Importación terminada"
                                    description={
                                      analysis?.file?.name
                                        ? `El paquete "${analysis.file.name}" fue procesado correctamente.`
                                        : "El paquete seleccionado fue procesado correctamente."
                                    }
                                    onClose={() => ModalManager.closeAll()}
                                  />
                                ),
                              });
                            }}
                          />
                        ),
                      });
                    }}
                  />
                ),
              });
            }, 1400);
          }}
        />
      ),
    });
  };

  const handleRestoreBackup = (item) => {
    ModalManager.show({
      type: "custom",
      title: `Restaurar respaldo ${item.scope}`,
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <RestoreBackupModal
          item={item}
          onClose={() => ModalManager.closeAll()}
          onConfirm={async () => {
            ModalManager.closeAll();
            const confirmed = await ModalManager.confirm({
              title: `Confirmar restauración ${item.scope || "respaldo"}`,
              message: (
                <>
                  <p>{`¿Deseas restaurar el paquete "${item.name || "seleccionado"}"?`}</p>
                  <p className="mt-2">
                    {`Esta acción limpiará la persistencia vigente del ámbito ${item.scope || "seleccionado"} y cargará la información desde cero.`}
                  </p>
                </>
              ),
            });

            if (!confirmed) return;

            ModalManager.show({
              type: "custom",
              title: "Proceso de restauración",
              size: "clientWide",
              showHeader: false,
              showFooter: false,
              closeOnBackdrop: false,
              content: (
                <RestoreBackupExecutionModal
                  item={item}
                  onComplete={() => {
                    ModalManager.closeAll();
                    ModalManager.show({
                      type: "custom",
                      title: "Restauración terminada",
                      size: "clientWide",
                      showHeader: false,
                      showFooter: false,
                      closeOnBackdrop: false,
                      content: (
                        <CompletedRestartModal
                          title="Restauración terminada"
                          description={
                            item?.name
                              ? `El paquete "${item.name}" fue restaurado correctamente.`
                              : "El respaldo seleccionado fue restaurado correctamente."
                          }
                          onClose={() => ModalManager.closeAll()}
                        />
                      ),
                    });
                  }}
                />
              ),
            });
          }}
        />
      ),
    });
  };

  const handleDeleteBackup = async (item) => {
    const confirmed = await ModalManager.confirm({
      title: "Eliminar respaldo",
      message: `¿Deseas eliminar "${item.name}" del historial? Esta acción quitará el paquete listado de esta vista placeholder.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    setHistoryItems((prev) => prev.filter((candidate) => candidate.id !== item.id));
    toastSuccess("Respaldo eliminado", `Se eliminó "${item.name}" del historial visible.`);
  };

  return (
    <div className="space-y-6">
      {hasChanges ? <DraftModeNotice /> : null}

      <div className="grid grid-cols-1 gap-6">
        {BACKUP_POLICY_DEFINITIONS.map((policyDefinition) => {
          const policy = draft.policies[policyDefinition.id];
          const verificationLabel = BACKUP_VERIFICATION_LABELS[policy.verificationMode] ?? policy.verificationMode;
          return (
            <SectionCard
              key={policyDefinition.id}
              title={`Política ${policyDefinition.shortLabel}`}
              icon={policyDefinition.icon}
              description={policyDefinition.description}
            >
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                <div className="pb-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{policyDefinition.title}</h3>
                        <StatusBadge tone={policy.enabled ? "active" : "inactive"}>
                          {policy.enabled ? "Programado" : "Detenido"}
                        </StatusBadge>
                      </div>
                      <p className={`mt-2 text-sm ${TXT_BODY}`}>
                        Permite decidir qué se respalda y en qué horario, sin obligar a ejecutar todo junto.
                      </p>
                    </div>
                    <MaintenanceToggle
                      checked={policy.enabled}
                      onChange={(value) => updatePolicyDraft(policyDefinition.id, "enabled", value)}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <MaintenanceField label="Frecuencia" hint="Programación del respaldo">
                      <CronInputField
                        value={policy.cron}
                        onChange={(event) => updatePolicyDraft(policyDefinition.id, "cron", event.target.value)}
                        onBlur={() => validatePolicyCron(policyDefinition.id)}
                        onOpenPlanner={() => openPolicyCronPlanner(policyDefinition.id, `Programación de ${policyDefinition.title.toLowerCase()}`)}
                        placeholder="0 2 * * *"
                        errorMessage={cronErrors[`${policyDefinition.id}.cron`]}
                      />
                    </MaintenanceField>
                    <MaintenanceField label="Almacenamiento" hint="Siempre se guarda fuera de MinIO">
                      <MaintenanceInput
                        value={BACKUP_DESTINATION_LABELS[policy.destination] ?? policy.destination}
                        disabled
                      />
                    </MaintenanceField>
                    <MaintenanceField label="Formato" hint="Archivo generado por esta política">
                      <MaintenanceSelect
                        value={policy.fileFormat}
                        onChange={(event) => updatePolicyDraft(policyDefinition.id, "fileFormat", event.target.value)}
                      >
                        {policyDefinition.formatOptions.map((option) => (
                          <option key={`${policyDefinition.id}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </MaintenanceSelect>
                    </MaintenanceField>
                    <MaintenanceField label="Ruta backend" hint="Subcarpeta final dentro del volumen compartido">
                      <MaintenanceInput
                        value={policy.pathPrefix}
                        onChange={(event) => updatePolicyDraft(policyDefinition.id, "pathPrefix", event.target.value)}
                        placeholder={`${BACKUP_STORAGE_ROOT_CONTAINER}/${policyDefinition.id}`}
                      />
                    </MaintenanceField>
                  </div>
                </div>

                <div className="py-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Control posterior</h3>
                        <StatusBadge tone={policy.verificationMode === "none" ? "inactive" : "info"}>
                          {verificationLabel}
                        </StatusBadge>
                      </div>
                      <p className={`mt-2 text-sm ${TXT_BODY}`}>
                        Define qué revisar al terminar el respaldo y deja explícito el canal técnico que lo procesa.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                      <MaintenanceField label="Verificación" hint="Chequeo automático posterior a la ejecución">
                        <MaintenanceSelect
                          value={policy.verificationMode}
                          onChange={(event) => updatePolicyDraft(policyDefinition.id, "verificationMode", event.target.value)}
                        >
                          {BACKUP_VERIFICATION_OPTIONS.map((option) => (
                            <option key={`${policyDefinition.id}-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </MaintenanceSelect>
                      </MaintenanceField>
                      <MaintenanceField label="Origen" hint="Ámbito cubierto por esta política">
                        <MaintenanceInput value={policyDefinition.source} disabled />
                      </MaintenanceField>
                      <MaintenanceField label="Cola técnica" hint="Canal placeholder previsto">
                        <MaintenanceInput value={policyDefinition.queue} disabled />
                      </MaintenanceField>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Notificación por correo</h3>
                        <StatusBadge tone={policy.notifyByEmail ? "info" : "inactive"}>
                          {policy.notifyByEmail ? "Activa" : "No enviar"}
                        </StatusBadge>
                      </div>
                      <p className={`mt-2 text-sm ${TXT_BODY}`}>
                        Si está activa, se enviará un aviso al terminar el respaldo o su verificación asociada.
                      </p>
                    </div>
                    <MaintenanceToggle
                      checked={policy.notifyByEmail}
                      onChange={(value) => updatePolicyDraft(policyDefinition.id, "notifyByEmail", value)}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                    <MaintenanceField label="Nombre destinatario" hint="Persona o alias que recibirá el aviso">
                      <MaintenanceInput
                        value={policy.notifyRecipientName}
                        onChange={(event) => updatePolicyDraft(policyDefinition.id, "notifyRecipientName", event.target.value)}
                        placeholder="Operaciones"
                        disabled={!policy.notifyByEmail}
                      />
                    </MaintenanceField>
                    <MaintenanceField label="Correo destinatario" hint="Correo usado para la notificación">
                      <MaintenanceInput
                        type="email"
                        value={policy.notifyRecipientEmail}
                        onChange={(event) => updatePolicyDraft(policyDefinition.id, "notifyRecipientEmail", event.target.value)}
                        placeholder="operaciones@empresa.com"
                        disabled={!policy.notifyByEmail}
                      />
                    </MaintenanceField>
                  </div>
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard
        title="Conservación común"
        icon="FaShield"
        description="La retención se aplica igual a todos los respaldos almacenados en la carpeta compartida del backend."
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <MaintenanceField label="Retención" hint="Mismos días para BD, MinIO y Full">
              <MaintenanceInput
                type="number"
                min="1"
                max="365"
                value={draft.backupRetentionDays}
                onChange={(event) => updateDraft("backupRetentionDays", Number(event.target.value || 0))}
              />
            </MaintenanceField>
            <MaintenanceField label="Historial" hint="Visibilidad operativa del historial">
              <MaintenanceSelect
                value={draft.backupHistoryVisible ? "visible" : "hidden"}
                onChange={(event) => updateDraft("backupHistoryVisible", event.target.value === "visible")}
              >
                <option value="visible">Visible</option>
                <option value="hidden">Oculto</option>
              </MaintenanceSelect>
            </MaintenanceField>
            <MaintenanceField label="Purge interno" hint="Tarea silenciosa de mantenimiento">
              <MaintenanceInput value={draft.backupPurgeQueue} disabled />
            </MaintenanceField>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50/70 px-5 py-4 dark:border-gray-700 dark:bg-slate-900/30">
            <p className={`text-sm ${TXT_BODY}`}>
              Los paquetes con más de {draft.backupRetentionDays} días serán eliminados automáticamente por una tarea interna de mantenimiento.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Resumen de configuración"
        icon="FaClockRotateLeft"
        description="Vista rápida de la última versión guardada para cada política y la conservación común."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {backupSummaryItems.map((item) => (
            <div
              key={item.key}
              className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{item.title}</h3>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
              <div className="mt-4 space-y-3">
                {item.details.map((detail) => (
                  <div key={`${item.key}-${detail.label}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{detail.label}</p>
                    <p className={`mt-1 text-sm ${TXT_TITLE}`}>{detail.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Historial de respaldos"
        icon="FaClockRotateLeft"
        description="Consulta respaldos disponibles y usa acciones rápidas para descargar, restaurar o eliminar."
      >
        <div className="space-y-5">
          {!savedDraft.backupHistoryVisible ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
              <p className={`text-sm ${TXT_BODY}`}>
                El historial quedó marcado como oculto en la configuración guardada. Esta tabla sigue visible aquí porque estamos en la vista administrativa del placeholder.
              </p>
            </div>
          ) : null}

          {!historyItems.length ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
              <p className={`text-sm ${TXT_BODY}`}>No hay respaldos visibles en el historial.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Fecha</th>
                    <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Tipo</th>
                    <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Archivo</th>
                    <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Origen</th>
                    <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Tamaño</th>
                    <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Estado</th>
                    <th className={`py-3 text-right font-semibold ${TXT_META}`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 align-top dark:border-gray-700/60"
                    >
                      <td className="py-4 pr-4">
                        <p className={`font-medium ${TXT_TITLE}`}>{formatDateTime(item.createdAt)}</p>
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge tone={item.scope === "FULL" ? "warning" : item.scope === "BD" ? "info" : "active"}>
                          {item.scope}
                        </StatusBadge>
                      </td>
                      <td className="py-4 pr-4">
                        <p className={`font-semibold ${TXT_TITLE}`}>{item.name}</p>
                        <p className={`mt-1 text-xs ${TXT_META}`}>{item.storagePath}</p>
                      </td>
                      <td className="py-4 pr-4">
                        <p className={`font-medium ${TXT_TITLE}`}>{item.source}</p>
                      </td>
                      <td className="py-4 pr-4">
                        <p className={`font-medium ${TXT_TITLE}`}>{formatBytes(item.sizeBytes)}</p>
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                      </td>
                      <td className="py-4 text-right">
                        <div className="ml-auto grid w-[168px] grid-cols-3 gap-2">
                          <ActionButton
                            variant="soft"
                            size="xs"
                            icon={<Icon name="FaDownload" />}
                            tooltip="Descargar respaldo"
                            onClick={() => handleDownloadBackup(item)}
                            className="w-full hover:scale-100 active:scale-100"
                          />
                        <ActionButton
                          variant="soft"
                          size="xs"
                          icon={<Icon name="rotate" />}
                          tooltip="Restaurar respaldo"
                          onClick={() => handleRestoreBackup(item)}
                          className="w-full hover:scale-100 active:scale-100"
                        />
                          <ActionButton
                            variant="soft"
                            size="xs"
                            icon={<Icon name="FaTrash" />}
                            tooltip="Eliminar respaldo"
                            onClick={() => handleDeleteBackup(item)}
                            className="w-full hover:scale-100 active:scale-100"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Importar paquete externo"
        icon="FaFolderOpen"
        description="Inicia un flujo guiado para cargar, analizar y confirmar la importación de un paquete externo."
        actions={(
          <ActionButton
            label="Importar"
            variant="primary"
            size="sm"
            onClick={openImportPackageModal}
          />
        )}
      >
        {latestImportAnalysis ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Último paquete analizado</h3>
              <StatusBadge tone="info">{latestImportAnalysis.scope}</StatusBadge>
            </div>
            <p className={`mt-2 text-sm ${TXT_BODY}`}>
              Último archivo revisado por el flujo de análisis previo a importación.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <MaintenanceField label="Archivo" hint="">
                <MaintenanceInput value={latestImportAnalysis.file.name} disabled />
              </MaintenanceField>
              <MaintenanceField label="Formato" hint="">
                <MaintenanceInput value={latestImportAnalysis.format} disabled />
              </MaintenanceField>
              <MaintenanceField label="Tamaño" hint="">
                <MaintenanceInput value={formatBytes(latestImportAnalysis.file.size)} disabled />
              </MaintenanceField>
              <MaintenanceField label="Impacto" hint="">
                <MaintenanceInput value="Reemplaza persistencia anterior" disabled />
              </MaintenanceField>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <ConfigActionBar
        hasChanges={hasChanges}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
};

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
        <MaintenancePanel />
      )}

      {activeTab === "backups" && (
        <BackupsPanel />
      )}
    </div>
  );
};

export default SystemSettings;
