import React, { useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const TABS = [
  {
    id: "summary",
    label: "Resumen",
    icon: "FaGaugeHigh",
    description: "Estado general y procesos",
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
    description: "Tareas automaticas y scheduler",
  },
  {
    id: "backups",
    label: "Respaldos",
    icon: "FaDatabase",
    description: "Politicas e historial de backup",
  },
];

const summaryStats = {
  servicios: 3,
  workers: 2,
  colas: 4,
  integraciones: 2,
};

const summaryCards = [
  {
    title: "Backend API",
    icon: "FaServer",
    status: "Operativo",
    color: "green",
    description: "Referencia para exponer salud del backend y disponibilidad de endpoints base.",
    items: [
      { label: "Health check", value: "OK", tone: "green" },
      { label: "Ready check", value: "OK", tone: "green" },
      { label: "Tiempo de respuesta", value: "184 ms", tone: "primary" },
      { label: "Ultimo evento", value: "2026-03-13 09:42", tone: "gray" },
    ],
  },
  {
    title: "Workers y colas",
    icon: "FaGears",
    status: "Estable",
    color: "primary",
    description: "Espacio para mostrar workers activos, jobs pendientes y reintentos.",
    items: [
      { label: "Worker negocio/IA", value: "Activo", tone: "green" },
      { label: "PDF worker", value: "Activo", tone: "green" },
      { label: "Jobs en cola", value: "12", tone: "primary" },
      { label: "Reintentos", value: "1", tone: "purple" },
    ],
  },
  {
    title: "Versionado",
    icon: "FaBolt",
    status: "Placeholder",
    color: "gray",
    description: "Aqui luego puedes publicar version visible, build activo o fecha de despliegue.",
    items: [
      { label: "Version app", value: "v0.9.4", tone: "gray" },
      { label: "Release actual", value: "2026.03-RC1", tone: "primary" },
      { label: "Ultima actualizacion", value: "2026-03-12 18:10", tone: "gray" },
      { label: "Canal", value: "Interno", tone: "purple" },
    ],
  },
];

const integrationCards = [
  {
    title: "SMTP",
    icon: "FaEnvelope",
    color: "primary",
    description: "Configuracion operativa para correo transaccional y notificaciones salientes.",
    fields: [
      { label: "Host", value: "smtp.tu-dominio.com" },
      { label: "Puerto", value: "587" },
      { label: "Remitente", value: "notificaciones@tu-dominio.com" },
      { label: "Seguridad", value: "TLS habilitado" },
      { label: "Usuario", value: "mailer.service" },
      { label: "Timeout", value: "15 s" },
    ],
    note: "Luego puedes agregar prueba de envio y validacion de credenciales.",
    status: [
      { label: "Conexion", value: "Verificada hace 8 min", tone: "green" },
      { label: "Ultimo envio", value: "2026-03-13 09:37", tone: "primary" },
      { label: "Errores 24h", value: "0", tone: "gray" },
    ],
  },
  {
    title: "IA",
    icon: "FaBrain",
    color: "purple",
    description: "Configuracion visible para proveedor, modelo y token de integracion.",
    fields: [
      { label: "Proveedor", value: "OpenAI" },
      { label: "Modelo", value: "gpt-4o" },
      { label: "Token", value: "sk-...oculto...9K2" },
      { label: "Prompt", value: "system_prompt_v08.txt" },
      { label: "Temperatura", value: "0.0" },
      { label: "Max tokens", value: "16000" },
    ],
    note: "Tambien puede incluir una prueba controlada de conexion.",
    status: [
      { label: "Conexion", value: "Disponible", tone: "green" },
      { label: "Ultima prueba", value: "2026-03-13 09:30", tone: "primary" },
      { label: "Consumo estimado", value: "128 req/dia", tone: "purple" },
    ],
  },
];

const queueRows = [
  { name: "queue:minutes", pending: 6, processing: 1, failed: 0, updatedAt: "09:42" },
  { name: "queue:pdf", pending: 3, processing: 1, failed: 0, updatedAt: "09:41" },
  { name: "queue:mail", pending: 2, processing: 0, failed: 0, updatedAt: "09:39" },
  { name: "queue:maintenance", pending: 1, processing: 0, failed: 1, updatedAt: "09:18" },
];

const recentEvents = [
  { time: "09:42", title: "Backend health check", detail: "Respuesta OK en 184 ms", tone: "green" },
  { time: "09:39", title: "Correo SMTP de prueba", detail: "Enviado correctamente a admin@demo.cl", tone: "primary" },
  { time: "09:30", title: "Prueba de IA", detail: "Conexion con OpenAI validada", tone: "purple" },
  { time: "09:18", title: "Cola maintenance", detail: "1 job fallo y quedo marcado para revision", tone: "gray" },
];

const maintenanceTasks = [
  {
    name: "Limpieza de temporales",
    enabled: true,
    frequency: "Cada 6 horas",
    lastRun: "2026-03-13 06:00",
    nextRun: "2026-03-13 12:00",
    result: "OK",
    detail: "Elimina archivos temporales de procesamiento y previsualizacion.",
  },
  {
    name: "Expiracion de tokens OTP",
    enabled: true,
    frequency: "Cada 15 min",
    lastRun: "2026-03-13 09:30",
    nextRun: "2026-03-13 09:45",
    result: "OK",
    detail: "Revoca tokens vencidos de acceso publico y reseteo de contrasena.",
  },
  {
    name: "Reintento de jobs fallidos",
    enabled: false,
    frequency: "Manual",
    lastRun: "2026-03-12 18:10",
    nextRun: "-",
    result: "Desactivado",
    detail: "Reevalua jobs que quedaron en error recuperable.",
  },
  {
    name: "Limpieza de sesiones vencidas",
    enabled: true,
    frequency: "Diario 02:00",
    lastRun: "2026-03-13 02:00",
    nextRun: "2026-03-14 02:00",
    result: "OK",
    detail: "Elimina sesiones expiradas y reduce ruido operativo.",
  },
];

const backupPolicies = [
  { label: "Frecuencia", value: "Diaria" },
  { label: "Hora programada", value: "03:30" },
  { label: "Retencion", value: "15 dias" },
  { label: "Destino", value: "Bucket interno backups/minuet" },
  { label: "Compresion", value: "Habilitada" },
  { label: "Cifrado", value: "AES-256" },
];

const backupHistory = [
  { date: "2026-03-13 03:30", type: "Programado", size: "1.2 GB", duration: "04m 18s", status: "Exitoso" },
  { date: "2026-03-12 03:30", type: "Programado", size: "1.2 GB", duration: "04m 09s", status: "Exitoso" },
  { date: "2026-03-11 15:12", type: "Manual", size: "1.1 GB", duration: "05m 02s", status: "Exitoso" },
  { date: "2026-03-10 03:30", type: "Programado", size: "1.1 GB", duration: "02m 11s", status: "Con advertencias" },
];

const colorClasses = {
  primary: "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400",
  green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  gray: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
};

const Header = () => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
        <Icon name="FaGears" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
        Sistema
      </h1>
      <p className={`${TXT_BODY} mt-2 transition-theme`}>
        Placeholder del módulo para evaluar su diagramación dentro del lenguaje visual actual.
      </p>
    </div>

    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-theme">
      <Icon name="FaClockRotateLeft" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
      <span className={`text-sm ${TXT_META} transition-theme`}>Sin datos en vivo</span>
    </div>
  </div>
);

const StatsCard = ({ icon, label, value, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-theme">
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm ${TXT_META}`}>{label}</p>
        <p className={`text-2xl font-bold ${TXT_TITLE} mt-1 transition-theme`}>{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${colorClasses[color] ?? colorClasses.gray}`}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const Stats = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <StatsCard icon="FaServer" label="Servicios visibles" value={summaryStats.servicios} color="green" />
    <StatsCard icon="FaGears" label="Workers" value={summaryStats.workers} color="primary" />
    <StatsCard icon="FaListCheck" label="Colas monitoreadas" value={summaryStats.colas} color="purple" />
    <StatsCard icon="FaCloud" label="Integraciones" value={summaryStats.integraciones} color="gray" />
  </div>
);

const TabNav = ({ activeTab, onTabChange }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-theme overflow-hidden">
    <div className="flex items-stretch">
      {TABS.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const isFirst = idx === 0;
        const isLast = idx === TABS.length - 1;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={[
              "flex-1 flex items-center gap-2.5 px-4 py-4 transition-all",
              isFirst ? "rounded-l-xl" : "",
              isLast ? "rounded-r-xl" : "",
              idx > 0 ? "border-l border-gray-200 dark:border-gray-700" : "",
              isActive
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200",
            ].join(" ")}
          >
            <span
              className={[
                "w-0.5 h-7 rounded-full shrink-0 transition-all",
                isActive ? "bg-primary-500 dark:bg-primary-400" : "bg-transparent",
              ].join(" ")}
            />

            <Icon
              name={tab.icon}
              className={[
                "w-4 h-4 shrink-0",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-400 dark:text-gray-500",
              ].join(" ")}
            />

            <div className="text-left min-w-0">
              <p className={`text-sm font-semibold leading-tight ${isActive ? "text-primary-700 dark:text-primary-300" : ""}`}>
                {tab.label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                {tab.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const SectionCard = ({ title, icon, description, children, footer }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h2 className={`text-lg font-bold ${TXT_TITLE} transition-theme`}>{title}</h2>
        <p className={`text-sm ${TXT_BODY} mt-1 transition-theme`}>{description}</p>
      </div>
    </div>

    <div className="mt-5">
      {children}
    </div>

    {footer ? (
      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/60">
        <p className={`text-xs ${TXT_META} transition-theme`}>{footer}</p>
      </div>
    ) : null}
  </div>
);

const StatusPill = ({ tone = "gray", children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses[tone] ?? colorClasses.gray}`}>
    {children}
  </span>
);

const ToggleMock = ({ enabled }) => (
  <button
    type="button"
    className={[
      "relative inline-flex h-6 w-11 rounded-full transition-colors",
      enabled ? "bg-primary-500 dark:bg-primary-600" : "bg-gray-300 dark:bg-gray-600",
    ].join(" ")}
  >
    <span
      className={[
        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5",
        enabled ? "translate-x-5" : "translate-x-0.5",
      ].join(" ")}
    />
  </button>
);

const SummaryPanel = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {summaryCards.map((item) => (
        <SectionCard
          key={item.title}
          title={item.title}
          icon={item.icon}
          description={item.description}
          footer={`Estado actual: ${item.status}`}
        >
          <div className="space-y-3">
            {item.items.map((row) => (
              <div
                key={`${item.title}-${row.label}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700/50 transition-theme"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${colorClasses[item.color] ?? colorClasses.gray}`}>
                    <Icon name="FaCheckCircle" className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-sm ${TXT_TITLE} transition-theme`}>{row.label}</span>
                </div>
                <StatusPill tone={row.tone}>{row.value}</StatusPill>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <SectionCard
        title="Detalle de colas"
        icon="FaListCheck"
        description="Ejemplo de formato para ver backlog, procesamiento y fallos recientes."
        footer="Este bloque puede alimentarse desde Redis o desde un endpoint agregado del backend."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Cola</th>
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Pendientes</th>
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Procesando</th>
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Fallidos</th>
                <th className={`text-left py-2 ${TXT_META}`}>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {queueRows.map((row) => (
                <tr key={row.name} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className={`py-3 pr-3 font-medium ${TXT_TITLE}`}>{row.name}</td>
                  <td className={`py-3 pr-3 ${TXT_BODY}`}>{row.pending}</td>
                  <td className={`py-3 pr-3 ${TXT_BODY}`}>{row.processing}</td>
                  <td className="py-3 pr-3">
                    <StatusPill tone={row.failed > 0 ? "purple" : "green"}>{row.failed}</StatusPill>
                  </td>
                  <td className={`py-3 ${TXT_META}`}>{row.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Eventos recientes"
        icon="FaClockRotateLeft"
        description="Ejemplo de timeline corto con señales operativas que un administrador puede revisar rapido."
        footer="No reemplaza auditoria formal; es solo resumen operativo del modulo."
      >
        <div className="space-y-3">
          {recentEvents.map((event) => (
            <div
              key={`${event.time}-${event.title}`}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700/50 transition-theme"
            >
              <div className="pt-0.5">
                <StatusPill tone={event.tone}>{event.time}</StatusPill>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>{event.title}</p>
                <p className={`text-sm ${TXT_BODY} mt-1 transition-theme`}>{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  </div>
);

const IntegrationPanel = () => (
  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
    {integrationCards.map((item) => (
      <SectionCard
        key={item.title}
        title={item.title}
        icon={item.icon}
        description={item.description}
        footer={item.note}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {item.status.map((badge) => (
              <StatusPill key={`${item.title}-${badge.label}`} tone={badge.tone}>
                {badge.label}: {badge.value}
              </StatusPill>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {item.fields.map((field) => (
              <div
                key={`${item.title}-${field.label}`}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 transition-theme"
              >
                <p className={`text-xs font-medium uppercase tracking-wide ${TXT_META} transition-theme`}>
                  {field.label}
                </p>
                <p className={`text-sm font-semibold ${TXT_TITLE} mt-2 break-all transition-theme`}>
                  {field.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 transition-theme">
            <p className={`text-xs font-medium uppercase tracking-wide ${TXT_META} transition-theme`}>
              Acciones sugeridas
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-theme"
              >
                Probar conexion
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-theme"
              >
                Editar configuracion
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
    ))}
  </div>
);

const MaintenancePanel = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <StatsCard icon="FaGears" label="Tareas registradas" value={maintenanceTasks.length} color="primary" />
      <StatsCard icon="FaCheckCircle" label="Activas" value={maintenanceTasks.filter((t) => t.enabled).length} color="green" />
      <StatsCard icon="FaPauseCircle" label="Desactivadas" value={maintenanceTasks.filter((t) => !t.enabled).length} color="gray" />
    </div>

    <SectionCard
      title="Tareas de mantenimiento"
      icon="FaGears"
      description="Mockup de tareas automaticas que podrian activarse, desactivarse o ejecutarse manualmente."
      footer="Este bloque te permite visualizar el valor operativo real del modulo."
    >
      <div className="space-y-3">
        {maintenanceTasks.map((task) => (
          <div
            key={task.name}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 transition-theme"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>{task.name}</p>
                  <StatusPill tone={task.enabled ? "green" : "gray"}>{task.result}</StatusPill>
                </div>
                <p className={`text-sm ${TXT_BODY} mt-1 transition-theme`}>{task.detail}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xs ${TXT_META} transition-theme`}>Activa</span>
                <ToggleMock enabled={task.enabled} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div>
                <p className={`text-xs uppercase tracking-wide ${TXT_META}`}>Frecuencia</p>
                <p className={`text-sm font-medium ${TXT_TITLE} mt-1`}>{task.frequency}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wide ${TXT_META}`}>Ultima ejecucion</p>
                <p className={`text-sm font-medium ${TXT_TITLE} mt-1`}>{task.lastRun}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wide ${TXT_META}`}>Proxima ejecucion</p>
                <p className={`text-sm font-medium ${TXT_TITLE} mt-1`}>{task.nextRun}</p>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-theme"
                >
                  Ejecutar ahora
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-theme"
                >
                  Ver detalle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  </div>
);

const BackupsPanel = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <StatsCard icon="FaDatabase" label="Politica activa" value="1" color="primary" />
      <StatsCard icon="FaCheckCircle" label="Ultimo backup" value="Exitoso" color="green" />
      <StatsCard icon="FaClockRotateLeft" label="Retencion actual" value="15 dias" color="gray" />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <SectionCard
        title="Politica de respaldo"
        icon="FaDatabase"
        description="Mockup de parametros globales para respaldos programados."
        footer="Estos controles podrian guardarse en base de datos o en configuracion administrable."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {backupPolicies.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 transition-theme"
            >
              <p className={`text-xs font-medium uppercase tracking-wide ${TXT_META} transition-theme`}>
                {item.label}
              </p>
              <p className={`text-sm font-semibold ${TXT_TITLE} mt-2 transition-theme`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-theme"
          >
            Ejecutar respaldo ahora
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-theme"
          >
            Editar politica
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Historial reciente"
        icon="FaClockRotateLeft"
        description="Ejemplo de historial para validar si el formato aporta valor operativo."
        footer="Idealmente incluiria descarga de logs o detalle de errores."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Fecha</th>
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Tipo</th>
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Tamano</th>
                <th className={`text-left py-2 pr-3 ${TXT_META}`}>Duracion</th>
                <th className={`text-left py-2 ${TXT_META}`}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {backupHistory.map((row) => (
                <tr key={`${row.date}-${row.type}`} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className={`py-3 pr-3 font-medium ${TXT_TITLE}`}>{row.date}</td>
                  <td className={`py-3 pr-3 ${TXT_BODY}`}>{row.type}</td>
                  <td className={`py-3 pr-3 ${TXT_BODY}`}>{row.size}</td>
                  <td className={`py-3 pr-3 ${TXT_BODY}`}>{row.duration}</td>
                  <td className="py-3">
                    <StatusPill tone={row.status === "Exitoso" ? "green" : "purple"}>{row.status}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  </div>
);

const ContextNote = ({ text }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 transition-theme">
    <p className={`text-sm ${TXT_BODY} transition-theme`}>{text}</p>
  </div>
);

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState("summary");

  useDocumentTitle("Configuracion del Sistema");

  return (
    <div className="space-y-6">
      <Header />
      <Stats />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "summary" && (
        <>
          <ContextNote text="Esta pestaña quedaría enfocada en un resumen operativo de alto nivel: salud general, workers, colas y señales básicas de funcionamiento." />
          <SummaryPanel />
        </>
      )}

      {activeTab === "integrations" && (
        <>
          <ContextNote text="Esta pestaña está reservada para configuraciones globales que sí podrían cambiar con más frecuencia, como SMTP e IA, sin mezclar infraestructura estable." />
          <IntegrationPanel />
        </>
      )}

      {activeTab === "maintenance" && (
        <>
          <ContextNote text="Esta pestaña ejemplifica el valor operativo del modulo: visualizar tareas automaticas, entender que hace la cola de mantenimiento y decidir si ciertas rutinas deben ejecutarse, pausarse o revisarse." />
          <MaintenancePanel />
        </>
      )}

      {activeTab === "backups" && (
        <>
          <ContextNote text="Esta pestaña ilustra como un administrador podria configurar politicas de respaldo, disparar ejecuciones manuales y revisar el historial reciente sin salir del sistema." />
          <BackupsPanel />
        </>
      )}
    </div>
  );
};

export default SystemSettings;
