import React, { useEffect, useRef, useState } from "react";

import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
import { toastError, toastInfo, toastSuccess } from "@/components/common/toast/toastHelpers";
import Icon from "@/components/ui/icon/iconManager";
import {
  clonePlainObject,
  ConfigActionBar,
  CronInputField,
  DraftModeNotice,
  INITIAL_MAINTENANCE_DRAFT,
  MaintenanceField,
  MaintenanceInput,
  MaintenanceSelect,
  MaintenanceToggle,
  SectionCard,
  StatusBadge,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
  formatDateTime,
  openCronPlannerModal,
  validateCronExpression,
} from "@/pages/system/SystemSettingsShared";
import systemMaintenanceService from "@/services/systemMaintenanceService";

const SYSTEM_MAINTENANCE_RUNTIME_EVENT = "system-maintenance-runtime-update";

const RUNTIME_STATUS_LABELS = {
  queued: "En cola",
  running: "En curso",
  success: "OK",
  error: "Error",
  warning: "Advertencia",
};

const RUNTIME_STATUS_TONES = {
  queued: "info",
  running: "warning",
  success: "active",
  error: "danger",
  warning: "warning",
};

const ACTIVE_RUNTIME_STATUSES = new Set(["queued", "running"]);

const toDraftShape = (payload) => ({
  sessionCleanupEnabled: Boolean(payload?.sessionCleanupEnabled),
  sessionCleanupCron: String(payload?.sessionCleanupCron || INITIAL_MAINTENANCE_DRAFT.sessionCleanupCron),
  sessionCleanupMode: String(payload?.sessionCleanupMode || INITIAL_MAINTENANCE_DRAFT.sessionCleanupMode),
  tempCleanupEnabled: Boolean(payload?.tempCleanupEnabled),
  tempCleanupCron: String(payload?.tempCleanupCron || INITIAL_MAINTENANCE_DRAFT.tempCleanupCron),
  tempCleanupMaxAgeDays: Number(payload?.tempCleanupMaxAgeDays ?? INITIAL_MAINTENANCE_DRAFT.tempCleanupMaxAgeDays),
  monitorMaintenanceQueueEnabled: Boolean(payload?.monitorMaintenanceQueueEnabled),
  maintenanceQueueWarningThreshold: Number(payload?.maintenanceQueueWarningThreshold ?? INITIAL_MAINTENANCE_DRAFT.maintenanceQueueWarningThreshold),
  monitorMinutesQueueEnabled: Boolean(payload?.monitorMinutesQueueEnabled ?? INITIAL_MAINTENANCE_DRAFT.monitorMinutesQueueEnabled),
  minutesQueueWarningThreshold: Number(payload?.minutesQueueWarningThreshold ?? INITIAL_MAINTENANCE_DRAFT.minutesQueueWarningThreshold),
  monitorEmailQueueEnabled: Boolean(payload?.monitorEmailQueueEnabled ?? INITIAL_MAINTENANCE_DRAFT.monitorEmailQueueEnabled),
  emailQueueWarningThreshold: Number(payload?.emailQueueWarningThreshold ?? INITIAL_MAINTENANCE_DRAFT.emailQueueWarningThreshold),
  monitorPdfQueueEnabled: Boolean(payload?.monitorPdfQueueEnabled ?? INITIAL_MAINTENANCE_DRAFT.monitorPdfQueueEnabled),
  pdfQueueWarningThreshold: Number(payload?.pdfQueueWarningThreshold ?? INITIAL_MAINTENANCE_DRAFT.pdfQueueWarningThreshold),
  monitorDlqEnabled: Boolean(payload?.monitorDlqEnabled),
  dlqWarningThreshold: Number(payload?.dlqWarningThreshold ?? INITIAL_MAINTENANCE_DRAFT.dlqWarningThreshold),
});

const describeRuntime = (runtime) => {
  const rawStatus = runtime?.lastStatus ?? "";
  const statusLabel = RUNTIME_STATUS_LABELS[rawStatus] ?? "Sin ejecuciones";
  const statusTone = RUNTIME_STATUS_TONES[rawStatus] ?? "inactive";
  const timestamp = runtime?.lastFinishedAt || runtime?.lastStartedAt || runtime?.lastEnqueuedAt;
  return {
    rawStatus,
    statusLabel,
    statusTone,
    timestampLabel: timestamp ? formatDateTime(timestamp) : "Sin registros",
    message: runtime?.lastMessage || "Todavía no hay ejecuciones registradas para esta rutina.",
    enqueuedAtLabel: formatDateTime(runtime?.lastEnqueuedAt),
    startedAtLabel: formatDateTime(runtime?.lastStartedAt),
    finishedAtLabel: formatDateTime(runtime?.lastFinishedAt),
    affectedCountLabel:
      typeof runtime?.affectedCount === "number" ? String(runtime.affectedCount) : "—",
  };
};

const RuntimeProgressCard = ({ runtime, detail }) => (
  <div className="mt-4 overflow-hidden rounded-[22px] border border-gray-200/70 bg-white/55 shadow-sm dark:border-gray-700/70 dark:bg-slate-950/20">
    <div className="flex flex-col gap-3 border-b border-gray-200/70 px-4 py-4 dark:border-gray-700/70 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${TXT_META}`}>Seguimiento de ejecución</p>
        <p className={`mt-2 text-sm leading-6 ${TXT_TITLE}`}>{runtime.message}</p>
        <p className={`mt-2 text-xs ${TXT_META}`}>{detail}</p>
      </div>
      <div className="shrink-0">
        <StatusBadge tone={runtime.statusTone}>{runtime.statusLabel}</StatusBadge>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-px bg-gray-200/70 dark:bg-gray-700/70 xl:grid-cols-4">
      <div className="bg-white/70 px-4 py-3 dark:bg-slate-950/30">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${TXT_META}`}>Encolado</p>
        <p className={`mt-1 text-sm ${TXT_TITLE}`}>{runtime.enqueuedAtLabel}</p>
      </div>
      <div className="bg-white/70 px-4 py-3 dark:bg-slate-950/30">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${TXT_META}`}>Inicio real</p>
        <p className={`mt-1 text-sm ${TXT_TITLE}`}>{runtime.startedAtLabel}</p>
      </div>
      <div className="bg-white/70 px-4 py-3 dark:bg-slate-950/30">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${TXT_META}`}>Fin real</p>
        <p className={`mt-1 text-sm ${TXT_TITLE}`}>{runtime.finishedAtLabel}</p>
      </div>
      <div className="bg-white/70 px-4 py-3 dark:bg-slate-950/30">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${TXT_META}`}>Registros afectados</p>
        <p className={`mt-1 text-sm ${TXT_TITLE}`}>{runtime.affectedCountLabel}</p>
      </div>
    </div>
  </div>
);

export const MaintenancePanel = () => {
  const [draft, setDraft] = useState(() => clonePlainObject(INITIAL_MAINTENANCE_DRAFT));
  const [savedDraft, setSavedDraft] = useState(() => clonePlainObject(INITIAL_MAINTENANCE_DRAFT));
  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [cronErrors, setCronErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [runningNowAction, setRunningNowAction] = useState("");
  const [lastStatusRefreshAt, setLastStatusRefreshAt] = useState("");
  const runtimeRequestRef = useRef(null);

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
    openCronPlannerModal({
      modalTitle: title,
      currentValue: draft[key],
      ModalManager,
      onSelect: (cronValue) => {
        updateDraft(key, cronValue);
        setCronErrors((prev) => ({ ...prev, [key]: "" }));
        ModalManager.closeAll();
      },
    });
  };

  const loadRuntimeStatus = async () => {
    if (runtimeRequestRef.current) {
      return runtimeRequestRef.current;
    }

    const requestPromise = (async () => {
      try {
        const status = await systemMaintenanceService.getStatus();
        setRuntimeStatus(status);
        setLastStatusRefreshAt(new Date().toISOString());
        return status;
      } finally {
        runtimeRequestRef.current = null;
      }
    })();

    runtimeRequestRef.current = requestPromise;
    return requestPromise;
  };

  const loadMaintenanceConfig = async () => {
    setIsLoading(true);
    try {
      const [config, status] = await Promise.all([
        systemMaintenanceService.getConfig(),
        systemMaintenanceService.getStatus(),
      ]);
      const nextDraft = toDraftShape(config);
      setDraft(clonePlainObject(nextDraft));
      setSavedDraft(clonePlainObject(nextDraft));
      setRuntimeStatus(status);
      setLastStatusRefreshAt(new Date().toISOString());
      setCronErrors({});
    } catch (error) {
      toastError(
        "No se pudo cargar mantenimiento",
        error?.message ?? "No fue posible obtener la configuración actual del submódulo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!isMounted) return;
      await loadMaintenanceConfig();
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleRuntimeEvent = () => {
      loadRuntimeStatus().catch(() => {});
    };

    window.addEventListener(SYSTEM_MAINTENANCE_RUNTIME_EVENT, handleRuntimeEvent);
    return () => {
      window.removeEventListener(SYSTEM_MAINTENANCE_RUNTIME_EVENT, handleRuntimeEvent);
    };
  }, []);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const isRunNowBlocked = hasChanges || isSaving || Boolean(runningNowAction);

  const handleDiscard = () => {
    setDraft(clonePlainObject(savedDraft));
    setCronErrors({});
  };

  const handleSave = async () => {
    if (isSaving) return;

    const cronKeys = ["sessionCleanupCron", "tempCleanupCron"];
    const invalidEntries = cronKeys
      .map((key) => [key, validateCronKey(key, draft[key])])
      .filter(([, validation]) => !validation.isValid);

    if (invalidEntries.length) {
      toastError("Programación inválida", "Revisa los campos de programación antes de guardar.");
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: "Guardar cambios de mantenimiento",
      message: "¿Deseas guardar la configuración de mantenimiento? Los cambios del borrador pasarán a ser la versión activa de esta pantalla.",
      confirmText: "Guardar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updated = await systemMaintenanceService.update(draft);
      const nextDraft = toDraftShape(updated);
      setDraft(clonePlainObject(nextDraft));
      setSavedDraft(clonePlainObject(nextDraft));
      await loadRuntimeStatus();
      toastSuccess(
        "Mantenimiento actualizado",
        "La configuración quedó persistida. El scheduler la aplicará en su siguiente tick."
      );
    } catch (error) {
      toastError("No se pudo guardar mantenimiento", error?.message ?? "La actualización no pudo completarse.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async (target) => {
    if (runningNowAction) return;

    if (hasChanges) {
      toastInfo(
        "Guarda el borrador antes de ejecutar",
        "Ejecutar ahora usa la configuración persistida. Guarda o descarta tus cambios para evitar correr una versión distinta."
      );
      return;
    }

    const isSessionCleanup = target === "session_cleanup";
    const title = isSessionCleanup ? "Ejecutar limpieza de sesiones" : "Ejecutar limpieza de temporales";
    const message = isSessionCleanup
      ? "Se encolará una ejecución manual usando la estrategia guardada actualmente, sin depender del cron."
      : "Se encolará una ejecución manual usando la retención guardada actualmente, sin depender del cron.";

    const confirmed = await ModalManager.confirm({
      title,
      message,
      confirmText: "Ejecutar ahora",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    setRunningNowAction(target);
    try {
      const response = isSessionCleanup
        ? await systemMaintenanceService.runSessionCleanupNow()
        : await systemMaintenanceService.runTempCleanupNow();
      await loadRuntimeStatus();
      toastSuccess(
        isSessionCleanup ? "Limpieza de sesiones encolada" : "Limpieza de temporales encolada",
        response?.message ?? "La rutina quedó enviada a queue:maintenance."
      );
    } catch (error) {
      toastError(
        isSessionCleanup ? "No se pudo ejecutar la limpieza de sesiones" : "No se pudo ejecutar la limpieza de temporales",
        error?.message ?? "La solicitud manual no pudo encolarse."
      );
    } finally {
      setRunningNowAction("");
    }
  };

  const sessionRuntime = describeRuntime(runtimeStatus?.sessionCleanup);
  const tempRuntime = describeRuntime(runtimeStatus?.tempCleanup);
  const hasActiveRuntime =
    ACTIVE_RUNTIME_STATUSES.has(sessionRuntime.rawStatus) ||
    ACTIVE_RUNTIME_STATUSES.has(tempRuntime.rawStatus);

  useEffect(() => {
    if (isLoading) return undefined;

    const pollMs = hasActiveRuntime ? 5000 : 30000;
    const intervalId = window.setInterval(() => {
      loadRuntimeStatus().catch(() => {});
    }, pollMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasActiveRuntime, isLoading]);

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
        { label: "Última ejecución", value: sessionRuntime.timestampLabel },
        { label: "Último estado", value: sessionRuntime.statusLabel },
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
        { label: "Última ejecución", value: tempRuntime.timestampLabel },
        { label: "Último estado", value: tempRuntime.statusLabel },
      ],
    },
    {
      key: "summary-queues",
      title: "Observabilidad de colas",
      tone:
        savedDraft.monitorMaintenanceQueueEnabled ||
        savedDraft.monitorMinutesQueueEnabled ||
        savedDraft.monitorEmailQueueEnabled ||
        savedDraft.monitorPdfQueueEnabled ||
        savedDraft.monitorDlqEnabled
          ? "info"
          : "inactive",
      status:
        [
          savedDraft.monitorMinutesQueueEnabled,
          savedDraft.monitorEmailQueueEnabled,
          savedDraft.monitorMaintenanceQueueEnabled,
          savedDraft.monitorPdfQueueEnabled,
          savedDraft.monitorDlqEnabled,
        ].filter(Boolean).length > 0
          ? "Monitoreo activo"
          : "Monitoreo inactivo",
      details: [
        {
          label: "queue:minutes",
          value: savedDraft.monitorMinutesQueueEnabled
            ? `Activa / umbral ${savedDraft.minutesQueueWarningThreshold}`
            : "Inactiva",
        },
        {
          label: "queue:email",
          value: savedDraft.monitorEmailQueueEnabled
            ? `Activa / umbral ${savedDraft.emailQueueWarningThreshold}`
            : "Inactiva",
        },
        {
          label: "queue:maintenance",
          value: savedDraft.monitorMaintenanceQueueEnabled
            ? `Activa / umbral ${savedDraft.maintenanceQueueWarningThreshold}`
            : "Inactiva",
        },
        {
          label: "queue:pdf",
          value: savedDraft.monitorPdfQueueEnabled
            ? `Activa / umbral ${savedDraft.pdfQueueWarningThreshold}`
            : "Inactiva",
        },
        {
          label: "queue:dlq",
          value: savedDraft.monitorDlqEnabled ? `Activa / umbral ${savedDraft.dlqWarningThreshold}` : "Inactiva",
        },
      ],
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
        <p className={`text-sm ${TXT_BODY}`}>Cargando configuración de mantenimiento...</p>
      </div>
    );
  }

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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Limpieza de sesiones</h3>
                    <StatusBadge tone={draft.sessionCleanupEnabled ? "active" : "inactive"}>
                      {draft.sessionCleanupEnabled ? "Habilitada" : "Deshabilitada"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Controla la limpieza de sesiones registradas y su tratamiento operativo.
                  </p>
                  <p className={`mt-2 text-xs ${TXT_META}`}>Último resultado: {sessionRuntime.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 self-start">
                  <ActionButton
                    label={runningNowAction === "session_cleanup" ? "Ejecutando..." : "Ejecutar ahora"}
                    variant="soft"
                    size="sm"
                    icon={<Icon name="play" />}
                    onClick={() => handleRunNow("session_cleanup")}
                    disabled={isRunNowBlocked}
                    tooltip={
                      hasChanges
                        ? "Guarda o descarta el borrador antes de ejecutar"
                        : "Encola una ejecución manual usando la configuración guardada"
                    }
                  />
                  <MaintenanceToggle
                    checked={draft.sessionCleanupEnabled}
                    onChange={(value) => updateDraft("sessionCleanupEnabled", value)}
                  />
                </div>
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

              <RuntimeProgressCard
                runtime={sessionRuntime}
                detail="La ejecución manual usa la configuración persistida y no depende del cron."
              />
            </div>

            <div className="py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Limpieza de archivos temporales</h3>
                    <StatusBadge tone={draft.tempCleanupEnabled ? "active" : "inactive"}>
                      {draft.tempCleanupEnabled ? "Habilitada" : "Deshabilitada"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Controla la limpieza de archivos temporales y trazas generadas por procesamiento.
                  </p>
                  <p className={`mt-2 text-xs ${TXT_META}`}>Último resultado: {tempRuntime.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 self-start">
                  <ActionButton
                    label={runningNowAction === "temp_cleanup" ? "Ejecutando..." : "Ejecutar ahora"}
                    variant="soft"
                    size="sm"
                    icon={<Icon name="play" />}
                    onClick={() => handleRunNow("temp_cleanup")}
                    disabled={isRunNowBlocked}
                    tooltip={
                      hasChanges
                        ? "Guarda o descarta el borrador antes de ejecutar"
                        : "Encola una ejecución manual usando la configuración guardada"
                    }
                  />
                  <MaintenanceToggle
                    checked={draft.tempCleanupEnabled}
                    onChange={(value) => updateDraft("tempCleanupEnabled", value)}
                  />
                </div>
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

              <RuntimeProgressCard
                runtime={tempRuntime}
                detail="La ejecución manual usa la configuración persistida y no depende del cron."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Observabilidad Técnica"
          icon="FaServer"
          description="Centraliza umbrales y activación de alertas; la lectura de carga actual vive en la pestaña Colas."
          actions={(
            <div className="flex flex-wrap items-center justify-end gap-3">
              <StatusBadge tone={hasActiveRuntime ? "warning" : "inactive"}>
                {hasActiveRuntime ? "Refresco rápido 5s" : "Refresco normal 30s"}
              </StatusBadge>
              <p className={`text-xs ${TXT_META}`}>Última lectura: {formatDateTime(lastStatusRefreshAt)}</p>
            </div>
          )}
        >
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de queue:maintenance</h3>
                    <StatusBadge tone={draft.monitorMaintenanceQueueEnabled ? "info" : "inactive"}>
                      {draft.monitorMaintenanceQueueEnabled ? "Activa" : "Inactiva"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Si está activa, eleva alertas operativas cuando la cola supera su umbral y puede notificar por campana y correo.
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

            <div className="py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de queue:minutes</h3>
                    <StatusBadge tone={draft.monitorMinutesQueueEnabled ? "info" : "inactive"}>
                      {draft.monitorMinutesQueueEnabled ? "Activa" : "Inactiva"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Si está activa, vigila la cola principal de minutas y dispara alertas cuando se acumula carga sobre el umbral.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorMinutesQueueEnabled}
                  onChange={(value) => updateDraft("monitorMinutesQueueEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs acumulados antes de mostrar alerta">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.minutesQueueWarningThreshold}
                    onChange={(event) => updateDraft("minutesQueueWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:minutes" disabled />
                </MaintenanceField>
              </div>
            </div>

            <div className="py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de queue:email</h3>
                    <StatusBadge tone={draft.monitorEmailQueueEnabled ? "info" : "inactive"}>
                      {draft.monitorEmailQueueEnabled ? "Activa" : "Inactiva"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Si está activa, vigila el despacho de correo y notificaciones encoladas para alertar acumulaciones anómalas.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorEmailQueueEnabled}
                  onChange={(value) => updateDraft("monitorEmailQueueEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs acumulados antes de mostrar alerta">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.emailQueueWarningThreshold}
                    onChange={(event) => updateDraft("emailQueueWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:email" disabled />
                </MaintenanceField>
              </div>
            </div>

            <div className="py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de queue:pdf</h3>
                    <StatusBadge tone={draft.monitorPdfQueueEnabled ? "info" : "inactive"}>
                      {draft.monitorPdfQueueEnabled ? "Activa" : "Inactiva"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Si está activa, vigila el renderizado y la publicación de artefactos PDF para alertar acumulaciones anómalas.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorPdfQueueEnabled}
                  onChange={(value) => updateDraft("monitorPdfQueueEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs acumulados antes de mostrar alerta">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.pdfQueueWarningThreshold}
                    onChange={(event) => updateDraft("pdfQueueWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:pdf" disabled />
                </MaintenanceField>
              </div>
            </div>

            <div className="pt-6 pb-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de DLQ</h3>
                    <StatusBadge tone={draft.monitorDlqEnabled ? "danger" : "inactive"}>
                      {draft.monitorDlqEnabled ? "Activa" : "Inactiva"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Si está activa, prioriza los jobs fallidos enviados a la DLQ y dispara alertas cuando la cola supera su umbral.
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
        saveLabel={isSaving ? "Guardando..." : "Guardar cambios"}
        cleanMessage="La configuración persistida ya está activa. El scheduler la aplicará en su siguiente tick."
      />
    </div>
  );
};
