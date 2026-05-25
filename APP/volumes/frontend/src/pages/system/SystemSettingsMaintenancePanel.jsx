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
const OPERATION_MODE_LABELS = {
  normal: "Normal",
  read_only: "Solo lectura",
  maintenance: "Mantenimiento",
};
const OPERATION_MODE_TONES = {
  normal: "active",
  read_only: "warning",
  maintenance: "danger",
};
const OPERATION_REASON_OPTIONS = {
  read_only: [
    "Solo lectura por validación de auditoría.",
    "Solo lectura por revisión operativa.",
    "Solo lectura previo a ventana de mantenimiento.",
    "Solo lectura por verificación posterior a restauración.",
  ],
  maintenance: [
    "Modo mantenimiento activado administrativamente.",
    "Mantenimiento por recuperación o restauración.",
    "Mantenimiento por validación de respaldos.",
    "Mantenimiento por intervención operativa programada.",
  ],
};

const OperationModeReasonModal = ({ mode, onCancel, onConfirm }) => {
  const label = OPERATION_MODE_LABELS[mode] || mode;
  const options = OPERATION_REASON_OPTIONS[mode] || [];
  const defaultReason = options[0] || `Modo ${label} activado administrativamente.`;
  const [selectedReason, setSelectedReason] = useState(defaultReason);
  const [customReason, setCustomReason] = useState("");
  const isOther = selectedReason === "__other__";
  const finalReason = (isOther ? customReason : selectedReason).trim();

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
        <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Activar modo {label}</h2>
        <p className={`mt-2 text-sm ${TXT_BODY}`}>
          Registra el motivo operativo. Este texto quedará asociado al estado del sistema y visible para administración.
        </p>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="space-y-3">
          {options.map((reason) => (
            <label
              key={reason}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
                selectedReason === reason
                  ? "border-primary-400 bg-primary-50/60 dark:border-primary-600 dark:bg-primary-900/20"
                  : "border-gray-200 bg-white hover:border-primary-300 dark:border-gray-700 dark:bg-gray-800",
              ].join(" ")}
            >
              <input
                type="radio"
                name="operation-reason"
                checked={selectedReason === reason}
                onChange={() => setSelectedReason(reason)}
                className="mt-1"
              />
              <span className={`text-sm ${TXT_TITLE}`}>{reason}</span>
            </label>
          ))}

          <label
            className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
              isOther
                ? "border-primary-400 bg-primary-50/60 dark:border-primary-600 dark:bg-primary-900/20"
                : "border-gray-200 bg-white hover:border-primary-300 dark:border-gray-700 dark:bg-gray-800",
            ].join(" ")}
          >
            <input
              type="radio"
              name="operation-reason"
              checked={isOther}
              onChange={() => setSelectedReason("__other__")}
              className="mt-1"
            />
            <span className={`text-sm ${TXT_TITLE}`}>Otro motivo</span>
          </label>
        </div>

        {isOther ? (
          <MaintenanceField label="Motivo personalizado" hint="Describe brevemente por qué se activa este modo.">
            <textarea
              value={customReason}
              onChange={(event) => setCustomReason(event.target.value)}
              rows={4}
              maxLength={500}
              autoFocus
              className={[
                "w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition",
                "focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900/40",
              ].join(" ")}
              placeholder={`Ej: ${defaultReason}`}
            />
          </MaintenanceField>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-700 sm:flex-row sm:justify-end">
        <ActionButton
          label="Cancelar"
          variant="soft"
          size="sm"
          onClick={onCancel}
        />
        <ActionButton
          label={`Activar ${label}`}
          variant={mode === "maintenance" ? "danger" : "warning"}
          size="sm"
          icon={<Icon name={mode === "maintenance" ? "FaShield" : "FaLock"} />}
          disabled={!finalReason}
          onClick={() => onConfirm(finalReason)}
        />
      </div>
    </div>
  );
};

const openOperationModeReasonModal = ({ mode }) =>
  new Promise((resolve) => {
    const handleClose = (value = null) => {
      ModalManager.closeAll();
      resolve(value);
    };

    ModalManager.show({
      type: "custom",
      title: `Activar modo ${OPERATION_MODE_LABELS[mode] || mode}`,
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <OperationModeReasonModal
          mode={mode}
          onCancel={() => handleClose(null)}
          onConfirm={(reason) => handleClose(reason)}
        />
      ),
    });
  });

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
  const [isChangingOperationMode, setIsChangingOperationMode] = useState(false);
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

  const handleOperationModeChange = async (mode) => {
    if (isChangingOperationMode) return;
    const label = OPERATION_MODE_LABELS[mode] || mode;
    let reason = "";

    if (mode === "normal") {
      const confirmed = await ModalManager.confirm({
        title: "Volver a modo normal",
        message: "¿Deseas retirar el bloqueo operativo y permitir nuevamente el uso normal del sistema?",
        confirmText: "Volver a normal",
        cancelText: "Cancelar",
      });
      if (!confirmed) return;
    } else {
      reason = await openOperationModeReasonModal({ mode });
      if (!reason) return;
    }

    setIsChangingOperationMode(true);
    try {
      await systemMaintenanceService.setOperationMode(mode, reason);
      await loadRuntimeStatus();
      window.dispatchEvent(new CustomEvent(SYSTEM_MAINTENANCE_RUNTIME_EVENT));
      toastSuccess("Modo operativo actualizado", `El sistema quedó en modo ${label}.`);
    } catch (error) {
      toastError("No se pudo cambiar el modo", error?.message ?? "La solicitud no pudo completarse.");
    } finally {
      setIsChangingOperationMode(false);
    }
  };

  const sessionRuntime = describeRuntime(runtimeStatus?.sessionCleanup);
  const tempRuntime = describeRuntime(runtimeStatus?.tempCleanup);
  const operationState = runtimeStatus?.operationState || { mode: "normal" };
  const operationMode = operationState.mode || "normal";
  const operationReason = String(operationState.reason || "").trim();
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

      <SectionCard
        title="Modo operativo del sitio"
        icon="FaShield"
        description="Permite cerrar administrativamente el acceso y detener escrituras usando el mismo marker operativo que utilizan las restauraciones."
        actions={(
          <StatusBadge tone={OPERATION_MODE_TONES[operationMode] || "inactive"}>
            {OPERATION_MODE_LABELS[operationMode] || operationMode}
          </StatusBadge>
        )}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MaintenanceField label="Estado actual" hint="Modo aplicado por marker">
            <MaintenanceInput value={OPERATION_MODE_LABELS[operationMode] || operationMode} disabled />
          </MaintenanceField>
          <MaintenanceField label="Origen" hint="Fuente del estado operativo">
            <MaintenanceInput value={operationState.source || "default"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Inicio" hint="Momento de activación">
            <MaintenanceInput value={formatDateTime(operationState.startedAt)} disabled />
          </MaintenanceField>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-900/20">
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Motivo registrado</p>
          <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
            {operationReason || "Sin bloqueo operativo activo."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Solo lectura"
            variant="warning"
            size="sm"
            icon={<Icon name="FaLock" />}
            disabled={isChangingOperationMode || operationMode === "read_only"}
            onClick={() => handleOperationModeChange("read_only")}
          />
          <ActionButton
            label="Mantenimiento"
            variant="danger"
            size="sm"
            icon={<Icon name="FaShield" />}
            disabled={isChangingOperationMode || operationMode === "maintenance"}
            onClick={() => handleOperationModeChange("maintenance")}
          />
          <ActionButton
            label="Modo normal"
            variant="success"
            size="sm"
            icon={<Icon name="check" />}
            disabled={isChangingOperationMode || operationMode === "normal"}
            onClick={() => handleOperationModeChange("normal")}
          />
        </div>
      </SectionCard>

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
