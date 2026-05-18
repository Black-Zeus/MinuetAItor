import React, { useEffect, useMemo, useRef, useState } from "react";

import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError } from "@/components/common/toast/toastHelpers";
import {
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
} from "@/pages/system/SystemSettingsShared";
import systemQueueService from "@/services/systemQueueService";

const REFRESH_UNITS = {
  seconds: {
    label: "segundos",
    multiplier: 1000,
  },
  minutes: {
    label: "minutos",
    multiplier: 60000,
  },
};

const formatRefreshCountdown = (secondsRemaining) => {
  const totalSeconds = Math.max(0, Number(secondsRemaining || 0));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

const getRefreshIntervalMs = (amount, unit) => {
  const normalizedAmount = Math.max(1, Number(amount || 1));
  const definition = REFRESH_UNITS[unit] ?? REFRESH_UNITS.seconds;
  return normalizedAmount * definition.multiplier;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getLoadPercent = (item) => {
  const rawValue = Number(item?.loadPercent ?? 0);
  if (Number.isFinite(rawValue)) {
    return Math.max(0, rawValue);
  }
  const threshold = Math.max(0, Number(item?.warningThreshold ?? 0));
  const size = Math.max(0, Number(item?.size ?? 0));
  if (!threshold) return 0;
  return (size / threshold) * 100;
};

const getLoadSignal = (percent, monitoringEnabled) => {
  if (!monitoringEnabled) {
    return {
      label: "Monitoreo inactivo",
      dotClass: "bg-slate-400 dark:bg-slate-500",
      barClass: "bg-slate-400 dark:bg-slate-500",
    };
  }
  if (percent <= 60) {
    return {
      label: "Carga saludable",
      dotClass: "bg-emerald-500",
      barClass: "bg-emerald-500",
    };
  }
  if (percent <= 80) {
    return {
      label: "Carga en observación",
      dotClass: "bg-amber-500",
      barClass: "bg-amber-500",
    };
  }
  if (percent <= 100) {
    return {
      label: "Carga crítica",
      dotClass: "bg-rose-500",
      barClass: "bg-rose-500",
    };
  }
  return {
    label: "Carga sobre umbral",
    dotClass: "bg-fuchsia-500",
    barClass: "bg-fuchsia-500",
  };
};

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const buildAlertTooltip = (item) => {
  const alertState = item?.alertState || {};
  const lines = [];

  if (!item?.monitoringEnabled) {
    lines.push("Monitoreo inactivo");
  } else if (alertState?.alertActive) {
    lines.push("Alerta operativa activa");
  } else {
    lines.push("Sin alerta activa");
  }

  if (alertState?.lastAlertAt) {
    lines.push(`Última saturación: ${formatDateTime(alertState.lastAlertAt)}`);
  }
  if (alertState?.lastAlertMailSentAt) {
    lines.push(`Correo de alerta enviado: ${formatDateTime(alertState.lastAlertMailSentAt)}`);
  }
  if (alertState?.lastRecoveredAt) {
    lines.push(`Última normalización: ${formatDateTime(alertState.lastRecoveredAt)}`);
  }
  if (alertState?.lastRecoveryMailSentAt) {
    lines.push(`Correo de normalización enviado: ${formatDateTime(alertState.lastRecoveryMailSentAt)}`);
  }

  return lines.join(" • ");
};

const QueueLoadBar = ({ percent, monitoringEnabled, barClass }) => {
  const progressWidth = percent > 100 ? 100 : (clamp(percent, 0, 100) / 110) * 100;
  const greenWidth = (60 / 110) * 100;
  const amberWidth = (20 / 110) * 100;
  const redWidth = (20 / 110) * 100;
  const fuchsiaWidth = (10 / 110) * 100;

  if (!monitoringEnabled) {
    return (
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700/80">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 h-2.5 overflow-hidden rounded-full">
      <div className="relative h-full w-full overflow-hidden rounded-full bg-gray-200/60 dark:bg-gray-700/60">
        <div className="absolute inset-0 flex">
          <div className="h-full bg-emerald-500/18" style={{ width: `${greenWidth}%` }} />
          <div className="h-full bg-amber-500/18" style={{ width: `${amberWidth}%` }} />
          <div className="h-full bg-rose-500/18" style={{ width: `${redWidth}%` }} />
          <div className="h-full bg-fuchsia-500/18" style={{ width: `${fuchsiaWidth}%` }} />
        </div>
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${barClass}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
};

const QueueDetailsModal = ({ item }) => {
  const percent = getLoadPercent(item);
  const loadSignal = getLoadSignal(percent, item?.monitoringEnabled);
  const alertState = item?.alertState || {};

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200/70 pb-4 dark:border-gray-700/70">
        <div className="min-w-0">
          <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>{item?.label}</h2>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>{item?.description}</p>
          <p className={`mt-2 font-mono text-xs ${TXT_META}`}>{item?.queue}</p>
          <p className={`mt-2 text-xs ${TXT_META}`}>Última actividad: {formatDateTime(item?.lastActivityAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 py-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Carga actual</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${loadSignal.dotClass}`} />
              <p className={`text-2xl font-semibold ${TXT_TITLE}`}>{formatPercent(percent)}</p>
              <p className={`text-sm ${TXT_BODY}`}>{item?.size} en cola / umbral {item?.warningThreshold}</p>
            </div>
            <QueueLoadBar
              percent={percent}
              monitoringEnabled={item?.monitoringEnabled}
              barClass={loadSignal.barClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Última actividad</p>
              <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(item?.lastActivityAt)}</p>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Monitoreo</p>
              <p className={`mt-1 text-sm ${TXT_TITLE}`}>{item?.monitoringEnabled ? "Activo" : "Inactivo"}</p>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Estado de alerta</p>
              <p className={`mt-1 text-sm ${TXT_TITLE}`}>{alertState?.alertActive ? "Alerta activa" : "Sin alerta activa"}</p>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Consumer</p>
              <p className={`mt-1 text-sm ${TXT_TITLE}`}>{item?.consumer}</p>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Prioridad</p>
              <p className={`mt-1 text-sm ${TXT_TITLE}`}>{item?.priority}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Trazabilidad de eventos</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className={`text-xs ${TXT_META}`}>Última saturación</p>
                <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(alertState?.lastAlertAt)}</p>
              </div>
              <div>
                <p className={`text-xs ${TXT_META}`}>Correo de alerta</p>
                <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(alertState?.lastAlertMailSentAt)}</p>
              </div>
              <div>
                <p className={`text-xs ${TXT_META}`}>Última normalización</p>
                <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(alertState?.lastRecoveredAt)}</p>
              </div>
              <div>
                <p className={`text-xs ${TXT_META}`}>Correo de normalización</p>
                <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(alertState?.lastRecoveryMailSentAt)}</p>
              </div>
            </div>
          </div>

          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Job types</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Array.isArray(item?.jobTypes) ? item.jobTypes : []).map((jobType) => (
                <span
                  key={`${item?.queue}-${jobType}`}
                  className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 font-mono text-xs font-semibold text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                >
                  {jobType}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const openQueueDetailsModal = (item) => {
  ModalManager.custom({
    title: `Detalle de ${item?.label || "cola"}`,
    size: "large",
    content: <QueueDetailsModal item={item} />,
    showFooter: false,
  });
};

const QueueRow = ({ item }) => {
  const percent = getLoadPercent(item);
  const loadSignal = getLoadSignal(percent, item?.monitoringEnabled);
  const alertState = item?.alertState || {};

  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200/80 bg-slate-50/70 px-4 py-4 dark:border-gray-700/80 dark:bg-slate-900/40 lg:grid-cols-[1.55fr_1fr_1fr_0.4fr]">
      <div>
        <h3 className={`text-sm font-semibold ${TXT_TITLE}`}>{item.label}</h3>
        <p className={`mt-2 text-sm ${TXT_BODY}`}>{item.description}</p>
        <p className={`mt-2 font-mono text-xs ${TXT_META}`}>{item.queue}</p>
        <p className={`mt-2 text-xs ${TXT_META}`}>Última actividad: {formatDateTime(item?.lastActivityAt)}</p>
      </div>

      <div className="flex flex-col items-center text-center">
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Carga</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className={`h-3 w-3 rounded-full ${loadSignal.dotClass}`} title={loadSignal.label} />
          <p className={`text-2xl font-semibold ${TXT_TITLE}`}>{formatPercent(percent)}</p>
        </div>
        <p className={`mt-2 text-xs ${TXT_META}`}>{item.size} en cola / umbral {item.warningThreshold}</p>
        <div className="w-full max-w-[280px]">
          <QueueLoadBar
            percent={percent}
            monitoringEnabled={item?.monitoringEnabled}
            barClass={loadSignal.barClass}
          />
        </div>
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Monitoreo y alertas</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusBadge tone={item.monitoringEnabled ? "active" : "inactive"}>
            {item.monitoringEnabled ? "Activa" : "Inactiva"}
          </StatusBadge>
          <span className={`h-3 w-3 rounded-full ${loadSignal.dotClass}`} title={loadSignal.label} />
          <span title={alertState.alertActive ? "Alerta activa en campana" : "Sin alerta activa"}>
            <Icon
              name="bell"
              className={`h-4 w-4 ${alertState.alertActive ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}`}
            />
          </span>
          <span title={alertState.lastAlertMailSentAt ? `Correo de alerta enviado: ${formatDateTime(alertState.lastAlertMailSentAt)}` : "Sin correo de alerta registrado"}>
            <Icon
              name="envelope"
              className={`h-4 w-4 ${alertState.lastAlertMailSentAt ? "text-sky-500" : "text-slate-400 dark:text-slate-500"}`}
            />
          </span>
          <span title={alertState.lastRecoveredAt ? `Normalización registrada: ${formatDateTime(alertState.lastRecoveredAt)}` : "Sin normalización registrada"}>
            <Icon
              name="checkCircle"
              className={`h-4 w-4 ${alertState.lastRecoveredAt ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"}`}
            />
          </span>
        </div>
        <p className={`mt-3 text-xs ${TXT_META}`}>{buildAlertTooltip(item)}</p>
      </div>

      <div className="flex items-start justify-end">
        <ActionButton
          variant="soft"
          size="sm"
          icon={<Icon name="eye" />}
          tooltip="Ver detalle de la cola"
          onClick={() => openQueueDetailsModal(item)}
        />
      </div>
    </div>
  );
};

const QueueLegend = () => (
  <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Semáforo de carga</p>
        <p className={`mt-2 text-sm ${TXT_BODY}`}>
          El porcentaje compara la carga actual contra el umbral configurado para esa cola. Un umbral de 20 con 10 jobs se verá como 50%.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <p className={`text-sm ${TXT_TITLE}`}>Verde: hasta 60% del umbral</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <p className={`text-sm ${TXT_TITLE}`}>Amarillo: sobre 60% y hasta 80%</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <p className={`text-sm ${TXT_TITLE}`}>Rojo: sobre 80% y hasta 100%</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-fuchsia-500" />
            <p className={`text-sm ${TXT_TITLE}`}>Fucsia: sobre 100%, la cola ya superó el umbral</p>
          </div>
        </div>
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Iconografía de monitoreo</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <StatusBadge tone="active">Activa</StatusBadge>
            <p className={`text-sm ${TXT_BODY}`}>El monitoreo de esa cola está habilitado.</p>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="bell" className="h-4 w-4 text-amber-500" />
            <p className={`text-sm ${TXT_BODY}`}>Existe una alerta activa visible en campana.</p>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="envelope" className="h-4 w-4 text-sky-500" />
            <p className={`text-sm ${TXT_BODY}`}>Ya se envió correo de alerta a administradores.</p>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="checkCircle" className="h-4 w-4 text-emerald-500" />
            <p className={`text-sm ${TXT_BODY}`}>La cola se normalizó y quedó registro del evento.</p>
          </div>
          <p className={`pt-2 text-xs ${TXT_META}`}>
            En cada fila puedes dejar el cursor sobre los iconos para ver el detalle temporal del evento.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export const QueuesPanel = () => {
  const [queueSnapshot, setQueueSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);
  const [refreshAmount, setRefreshAmount] = useState(15);
  const [refreshUnit, setRefreshUnit] = useState("seconds");
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(15);
  const nextRefreshAtRef = useRef(null);
  const pendingRequestRef = useRef(null);

  const loadQueues = async ({ silent = false, notifyOnError = !silent, pauseAutoRefreshOnError = true } = {}) => {
    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const requestPromise = (async () => {
      try {
        const result = await systemQueueService.getStatus();
        setQueueSnapshot(result);
      } catch (error) {
        if (pauseAutoRefreshOnError) {
          setIsAutoRefreshPaused(true);
        }
        if (notifyOnError) {
          toastError(
            "No se pudo cargar colas",
            error?.message ?? "No fue posible obtener el estado actual de las colas del sistema."
          );
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        pendingRequestRef.current = null;
      }
    })();

    pendingRequestRef.current = requestPromise;
    return requestPromise;
  };

  useEffect(() => {
    loadQueues();
  }, []);

  useEffect(() => {
    if (isLoading) return undefined;
    if (isAutoRefreshPaused) {
      nextRefreshAtRef.current = null;
      setSecondsUntilRefresh(0);
      return undefined;
    }

    const refreshMs = getRefreshIntervalMs(refreshAmount, refreshUnit);
    nextRefreshAtRef.current = Date.now() + refreshMs;
    setSecondsUntilRefresh(Math.ceil(refreshMs / 1000));

    const refreshIntervalId = window.setInterval(() => {
      loadQueues({ silent: true, notifyOnError: false, pauseAutoRefreshOnError: true }).catch(() => {});
      nextRefreshAtRef.current = Date.now() + refreshMs;
      setSecondsUntilRefresh(Math.ceil(refreshMs / 1000));
    }, refreshMs);

    const countdownIntervalId = window.setInterval(() => {
      const nextRefreshAt = nextRefreshAtRef.current;
      if (!nextRefreshAt) return;
      const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
      setSecondsUntilRefresh(remaining);
    }, 1000);

    return () => {
      window.clearInterval(refreshIntervalId);
      window.clearInterval(countdownIntervalId);
    };
  }, [isAutoRefreshPaused, isLoading, refreshAmount, refreshUnit]);

  const queues = Array.isArray(queueSnapshot?.queues) ? queueSnapshot.queues : [];

  const summary = useMemo(() => {
    const total = queues.length;
    const active = queues.filter((item) => Number(item?.size ?? 0) > 0).length;
    const monitored = queues.filter((item) => Boolean(item?.monitoringEnabled)).length;
    const warning = queues.filter((item) => Boolean(item?.alertState?.alertActive)).length;
    const totalBacklog = queues.reduce((acc, item) => acc + Number(item?.size ?? 0), 0);
    return { total, active, monitored, warning, totalBacklog };
  }, [queues]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
        <p className={`text-sm ${TXT_BODY}`}>Cargando snapshot de colas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Cadencia de Observación"
        icon="FaClockRotateLeft"
        description="Ajusta cada cuánto quieres refrescar el snapshot o congélalo temporalmente para analizar un momento específico."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MaintenanceField label="Autoactualización" hint="Pausar o reanudar el refresco periódico">
              <div className="flex items-center gap-3">
                <MaintenanceToggle
                  checked={!isAutoRefreshPaused}
                  onChange={(value) => setIsAutoRefreshPaused(!value)}
                />
                <StatusBadge tone={isAutoRefreshPaused ? "warning" : "active"}>
                  {isAutoRefreshPaused ? "Pausada" : "Activa"}
                </StatusBadge>
              </div>
            </MaintenanceField>

            <MaintenanceField label="Cada cuánto" hint="Frecuencia del snapshot automático">
              <MaintenanceInput
                type="number"
                min="1"
                max={refreshUnit === "seconds" ? "59" : "30"}
                value={refreshAmount}
                onChange={(event) => setRefreshAmount(Math.max(1, Number(event.target.value || 1)))}
              />
            </MaintenanceField>

            <MaintenanceField label="Unidad" hint="Segundos o minutos">
              <MaintenanceSelect
                value={refreshUnit}
                onChange={(event) => setRefreshUnit(event.target.value)}
              >
                <option value="seconds">Segundos</option>
                <option value="minutes">Minutos</option>
              </MaintenanceSelect>
            </MaintenanceField>
          </div>

          <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Modo actual</p>
                <p className={`mt-2 text-lg font-semibold ${TXT_TITLE}`}>
                  {isAutoRefreshPaused
                    ? "Snapshot congelado para análisis"
                    : `Refresh cada ${refreshAmount} ${REFRESH_UNITS[refreshUnit]?.label ?? refreshUnit}`}
                </p>
              </div>
              <StatusBadge tone={isAutoRefreshPaused ? "warning" : "info"}>
                {isAutoRefreshPaused ? "Sin avance automático" : `Próximo refresh en ${formatRefreshCountdown(secondsUntilRefresh)}`}
              </StatusBadge>
            </div>
            <p className={`mt-4 text-sm ${TXT_BODY}`}>
              El botón <span className="font-semibold">Actualizar</span> sigue disponible incluso con el snapshot pausado,
              para que puedas tomar lecturas puntuales sin reanudar la autoactualización.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Snapshot de Colas"
        icon="FaServer"
        description="Lista las colas Redis operativas del sistema, mostrando porcentaje de carga respecto del umbral y trazabilidad resumida de alertas."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className={`text-xs ${TXT_META}`}>Última lectura: {formatDateTime(queueSnapshot?.refreshedAt)}</p>
            <ActionButton
              label={isRefreshing ? "Actualizando..." : "Actualizar"}
              variant="soft"
              size="sm"
              icon={<Icon name="rotate" />}
              onClick={() => loadQueues({ silent: true, notifyOnError: true, pauseAutoRefreshOnError: false })}
              disabled={isRefreshing}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Colas observadas</p>
            <p className={`mt-2 text-3xl font-semibold ${TXT_TITLE}`}>{summary.total}</p>
          </div>
          <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Con carga</p>
            <p className={`mt-2 text-3xl font-semibold ${TXT_TITLE}`}>{summary.active}</p>
          </div>
          <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Monitoreadas</p>
            <p className={`mt-2 text-3xl font-semibold ${TXT_TITLE}`}>{summary.monitored}</p>
          </div>
          <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Alertadas</p>
            <p className={`mt-2 text-3xl font-semibold ${TXT_TITLE}`}>{summary.warning}</p>
          </div>
          <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Backlog total</p>
            <p className={`mt-2 text-3xl font-semibold ${TXT_TITLE}`}>{summary.totalBacklog}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Detalle por Cola"
        icon="FaDatabase"
        description="La vista principal prioriza porcentaje de carga y estado de alertas. Los detalles técnicos completos quedan en el modal de cada fila."
      >
        <div className="space-y-4">
          {queues.map((item) => (
            <QueueRow key={item.queue} item={item} />
          ))}
        </div>

        <div className="pt-2">
          <QueueLegend />
        </div>
      </SectionCard>
    </div>
  );
};
