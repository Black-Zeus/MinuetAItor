import React, { useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import { SMTP_TEST_IDLE_MESSAGE, SmtpTestDialogPanel } from "@/pages/system/SmtpConfigModal";
import {
  BACKUP_POLICY_DEFINITIONS,
  INITIAL_BACKUPS_DRAFT,
  INITIAL_MAINTENANCE_DRAFT,
  StatusBadge,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
  describeCronExpression,
  formatDateTime,
  getProviderLabel,
  maskTokenHint,
  statusClasses,
} from "@/pages/system/SystemSettingsShared";
import smtpConfigService from "@/services/smtpConfigService";

const normalizeMaintenanceSummaryConfig = (config) => ({
  ...INITIAL_MAINTENANCE_DRAFT,
  ...(config || {}),
});

const normalizeBackupsSummaryConfig = (config) => ({
  ...INITIAL_BACKUPS_DRAFT,
  ...(config || {}),
  policies: {
    ...INITIAL_BACKUPS_DRAFT.policies,
    ...(config?.policies || {}),
  },
});

const scheduleBadgeTone = (enabled) => (enabled ? "active" : "inactive");

const ScheduleItem = ({ icon, title, enabled, cron, description }) => {
  const cronDescription = describeCronExpression(cron || "");
  return (
    <div className="rounded-2xl border border-gray-100 bg-slate-50/80 px-4 py-4 dark:border-gray-700/80 dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name={icon} className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
            <p className={`text-sm font-semibold ${TXT_TITLE}`}>{title}</p>
          </div>
          <p className={`mt-1 text-xs ${TXT_BODY}`}>{description}</p>
        </div>
        <StatusBadge tone={scheduleBadgeTone(enabled)}>{enabled ? "Programada" : "Inactiva"}</StatusBadge>
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-slate-950/30">
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Cron</p>
        <p className={`mt-1 text-sm font-medium ${TXT_TITLE}`}>{cron || "—"}</p>
        <p className={`mt-1 text-xs ${TXT_META}`}>{cronDescription.text}</p>
      </div>
    </div>
  );
};

export const SendSmtpTestModal = ({ config, onClose, onSent }) => {
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

export const SummaryPanel = ({ smtpItems, aiItems, maintenanceConfig, backupsConfig }) => {
  const activeCount = smtpItems.filter((item) => item.isActive).length;
  const inactiveCount = smtpItems.length - activeCount;
  const aiActiveCount = aiItems.filter((item) => item.isActive).length;
  const aiInactiveCount = aiItems.length - aiActiveCount;
  const activeSmtp = smtpItems.find((item) => item.isActive) ?? null;
  const activeAi = aiItems.find((item) => item.isActive) ?? null;
  const aiPendingValidationCount = aiItems.filter((item) => item.validationStatus && item.validationStatus !== "valid").length;
  const configuredChannels = Number(Boolean(activeSmtp)) + Number(Boolean(activeAi));
  const maintenanceSummary = normalizeMaintenanceSummaryConfig(maintenanceConfig);
  const backupsSummary = normalizeBackupsSummaryConfig(backupsConfig);
  const enabledBackupPolicies = BACKUP_POLICY_DEFINITIONS.filter(
    (policyDefinition) => backupsSummary.policies?.[policyDefinition.id]?.enabled
  ).length;
  const scheduledTasksCount = Number(Boolean(maintenanceSummary.sessionCleanupEnabled))
    + Number(Boolean(maintenanceSummary.tempCleanupEnabled))
    + enabledBackupPolicies;
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

      <div className="overflow-hidden rounded-[26px] border border-gray-200/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Icon name="FaClock" className="h-5 w-5" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${TXT_TITLE}`}>Tareas programadas</h3>
                <p className={`mt-1 text-sm ${TXT_BODY}`}>
                  Vista rápida de automatizaciones activas en mantenimiento y respaldos.
                </p>
              </div>
            </div>
            <StatusBadge tone={scheduledTasksCount ? "active" : "inactive"}>
              {scheduledTasksCount} activas
            </StatusBadge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className={`text-sm font-semibold ${TXT_TITLE}`}>Mantenimiento</p>
              <p className={`mt-1 text-xs ${TXT_META}`}>Rutinas técnicas que el scheduler dispara contra el backend.</p>
            </div>
            <ScheduleItem
              icon="FaClock"
              title="Limpieza de sesiones"
              enabled={maintenanceSummary.sessionCleanupEnabled}
              cron={maintenanceSummary.sessionCleanupCron}
              description="Cierre o limpieza controlada de sesiones técnicas antiguas."
            />
            <ScheduleItem
              icon="FaGears"
              title="Limpieza de temporales"
              enabled={maintenanceSummary.tempCleanupEnabled}
              cron={maintenanceSummary.tempCleanupCron}
              description={`Elimina archivos temporales con retención de ${maintenanceSummary.tempCleanupMaxAgeDays} días.`}
            />
          </div>

          <div className="space-y-4">
            <div>
              <p className={`text-sm font-semibold ${TXT_TITLE}`}>Respaldos</p>
              <p className={`mt-1 text-xs ${TXT_META}`}>Políticas automáticas para base de datos, adjuntos y paquetes completos.</p>
            </div>
            {BACKUP_POLICY_DEFINITIONS.map((policyDefinition) => {
              const policy = backupsSummary.policies?.[policyDefinition.id] || {};
              return (
                <ScheduleItem
                  key={policyDefinition.id}
                  icon={policyDefinition.icon}
                  title={policyDefinition.title}
                  enabled={Boolean(policy.enabled)}
                  cron={policy.cron}
                  description={policyDefinition.description}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SmtpTable = ({ items, isLoading, onEdit, onActivate, onSend, onDelete }) => {
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

export const AIProviderTable = ({ items, isLoading, providerLabelMap, onEdit, onValidate, onToggleActive, onDelete }) => {
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
