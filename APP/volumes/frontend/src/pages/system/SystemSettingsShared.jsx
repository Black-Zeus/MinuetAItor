import React from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { formatNullableDateTime } from "@/utils/formats";

export const TXT_TITLE = "text-gray-900 dark:text-white";
export const TXT_BODY = "text-gray-600 dark:text-gray-300";
export const TXT_META = "text-gray-500 dark:text-gray-400";

export const TABS = [
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
    description: "Rutinas y limpieza operativa",
  },
  {
    id: "commissioning",
    label: "Puesta en marcha",
    icon: "FaRocket",
    description: "Checklist y bloqueo inicial",
  },
  {
    id: "backups",
    label: "Respaldos",
    icon: "FaDatabase",
    description: "Políticas y conservación",
  },
  {
    id: "queues",
    label: "Colas",
    icon: "FaServer",
    description: "Redis y estado operativo",
  },
];

export const formatDateTime = (value) => {
  return formatNullableDateTime(value);
};

export const statusClasses = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  info: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export const FALLBACK_PROVIDER_LABELS = {
  openai: "OpenAI / ChatGPT",
  anthropic: "Anthropic / Claude",
  deepseek: "DeepSeek",
  perplexity: "Perplexity",
  ollama_local: "Ollama local",
  ollama_remote: "Ollama remoto",
  custom: "Custom",
};

export const getProviderLabel = (providerType, providerLabelMap = {}) =>
  providerLabelMap?.[providerType] ?? FALLBACK_PROVIDER_LABELS[providerType] ?? providerType ?? "—";

export const maskTokenHint = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Sin token";
  if (raw.includes("*****")) {
    const [head, tail] = raw.split("*****");
    return `${String(head || "").slice(0, 3)}*****${String(tail || "").slice(-3)}`;
  }
  return `${raw.slice(0, 3)}*****${raw.slice(-3)}`;
};

export const formatBytes = (value) => {
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

export const clonePlainObject = (value) => JSON.parse(JSON.stringify(value));
export const BACKUP_STORAGE_ROOT_CONTAINER = "/app/remote_data/backups";
export const BACKUP_STORAGE_ROOT_HOST = "./APP/data/backend_data/backups";

export const INITIAL_MAINTENANCE_DRAFT = {
  sessionCleanupEnabled: true,
  sessionCleanupCron: "0 * * * *",
  sessionCleanupMode: "soft_logout",
  tempCleanupEnabled: true,
  tempCleanupCron: "0 3 * * *",
  tempCleanupMaxAgeDays: 7,
  monitorMaintenanceQueueEnabled: true,
  maintenanceQueueWarningThreshold: 25,
  monitorMinutesQueueEnabled: true,
  minutesQueueWarningThreshold: 5,
  monitorEmailQueueEnabled: true,
  emailQueueWarningThreshold: 20,
  monitorPdfQueueEnabled: true,
  pdfQueueWarningThreshold: 10,
  monitorDlqEnabled: true,
  dlqWarningThreshold: 10,
  accessRequestEnabled: true,
};

export const INITIAL_BACKUPS_DRAFT = {
  backupRetentionDays: 14,
  backupHistoryVisible: true,
  backupPurgeQueue: "queue:backups / backup_purge",
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

export const BACKUP_POLICY_DEFINITIONS = [
  {
    id: "database",
    title: "Base de datos",
    shortLabel: "BD",
    icon: "FaDatabase",
    source: "MariaDB",
    queue: "queue:backups / db_backup",
    description: "Respalda la base de datos operativa para restauraciones de estructura y datos.",
    formatOptions: [
      { value: "sql_gzip", label: "SQL comprimido (.sql.gz)" },
      { value: "sql_plain", label: "SQL plano (.sql)" },
    ],
  },
  {
    id: "objects",
    title: "Adjuntos",
    shortLabel: "Adjuntos",
    icon: "paperclip",
    source: "Adjuntos y artefactos",
    queue: "queue:backups / object_backup",
    description: "Respalda adjuntos y artefactos almacenados fuera de la base de datos.",
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
    queue: "queue:backups / full_backup",
    description: "Agrupa un paquete integral para restauración completa del sistema.",
    formatOptions: [
      { value: "tar_gzip", label: "Tar comprimido (.tar.gz)" },
      { value: "zip_bundle", label: "Paquete zip (.zip)" },
    ],
  },
];

export const BACKUP_VERIFICATION_OPTIONS = [
  { value: "none", label: "Solo registrar ejecución" },
  { value: "inventory", label: "Verificar inventario de archivos" },
  { value: "manifest", label: "Verificar manifiesto del paquete" },
  { value: "checksum", label: "Validar checksum final" },
];

export const BACKUP_VERIFICATION_LABELS = {
  none: "Solo registro",
  inventory: "Inventario",
  manifest: "Manifiesto",
  checksum: "Checksum",
};

export const BACKUP_DESTINATION_LABELS = {
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

export const normalizeCronExpression = (value) => String(value || "").trim().replace(/\s+/g, " ");

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

export const validateCronExpression = (value) => {
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

export const describeCronExpression = (value) => {
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

export const inferImportPackageAnalysis = (file) => {
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
      scope: "Adjuntos",
      source: "Adjuntos y artefactos",
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

export const BACKUP_HISTORY_ITEMS = [];

export const Header = () => (
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

export const TabNav = ({ activeTab, onTabChange, tabs = TABS }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className={tabs.length === 1 ? "grid grid-cols-1" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6"}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={[
              "border-b border-r border-gray-200 px-5 py-4 text-left transition-colors last:border-r-0 dark:border-gray-700",
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

export const SectionCard = ({ title, icon, description, actions = null, children }) => (
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

export const StatusBadge = ({ tone, children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[tone] ?? statusClasses.inactive}`}>
    {children}
  </span>
);

export const MaintenanceToggle = ({ checked, onChange, disabled = false }) => (
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

export const MaintenanceField = ({ label, hint, children }) => (
  <label className="block">
    <span className={`block text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{label}</span>
    {hint ? <span className={`mt-1 block text-xs ${TXT_META}`}>{hint}</span> : null}
    <div className="mt-3">{children}</div>
  </label>
);

export const MaintenanceInput = ({ invalid = false, className = "", ...props }) => (
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

export const MaintenanceSelect = ({ className = "", ...props }) => (
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

const CronPresetModal = ({ title, currentValue, onSelect }) => (
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

export const CronInputField = ({
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

export const openCronPlannerModal = ({ modalTitle, currentValue, onSelect, ModalManager }) => {
  ModalManager.show({
    type: "custom",
    title: modalTitle,
    size: "clientWide",
    showHeader: false,
    showFooter: false,
    content: (
      <CronPresetModal
        title={modalTitle}
        currentValue={currentValue}
        onSelect={onSelect}
      />
    ),
  });
};

export const ConfigActionBar = ({
  hasChanges,
  onDiscard,
  onSave,
  saveLabel = "Guardar cambios",
  dirtyMessage = "Estás editando un borrador. Los cambios se aplicarán recién al guardar.",
  cleanMessage = "La última configuración guardada sigue activa hasta que edites algo nuevo.",
  saveDisabled = false,
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
        disabled={!hasChanges || saveDisabled}
      />
    </div>
  </div>
);

export const DraftModeNotice = () => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/10">
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
  </div>
);
