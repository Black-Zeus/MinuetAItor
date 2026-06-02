import React, { useEffect, useMemo, useRef, useState } from "react";

import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
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

const formatJson = (value) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
};

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

const DlqDetailsModal = ({ item }) => (
  <div className="w-full max-w-5xl">
    <div className="border-b border-gray-200/70 pb-4 dark:border-gray-700/70">
      <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Detalle DLQ</p>
      <h2 className={`mt-2 text-xl font-semibold ${TXT_TITLE}`}>{item?.type || "Tarea sin tipo"}</h2>
      <p className={`mt-2 font-mono text-xs ${TXT_META}`}>{item?.jobId || item?.job_id || item?.id}</p>
    </div>

    <div className="grid grid-cols-1 gap-6 py-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Cola origen</p>
            <p className={`mt-1 font-mono text-sm ${TXT_TITLE}`}>{item?.queue || "Sin cola"}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Intento</p>
            <p className={`mt-1 text-sm ${TXT_TITLE}`}>{item?.attempt ?? "Sin dato"}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Fecha fallo</p>
            <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(item?.failedAt || item?.failed_at)}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Identificador interno</p>
            <p className={`mt-1 font-mono text-xs ${TXT_TITLE}`}>{item?.id}</p>
          </div>
        </div>

        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Error reportado</p>
          <pre className="mt-3 max-h-[260px] overflow-auto rounded-xl border border-gray-200/70 bg-slate-950/95 p-4 text-xs leading-relaxed text-slate-100 dark:border-gray-700/70">
            {item?.error || "Sin detalle de error."}
          </pre>
        </div>
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Payload original</p>
        <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-gray-200/70 bg-slate-950/95 p-4 text-xs leading-relaxed text-slate-100 dark:border-gray-700/70">
          {formatJson(item?.payload)}
        </pre>
      </div>
    </div>
  </div>
);

const openDlqDetailsModal = (item) => {
  ModalManager.custom({
    title: "Detalle de tarea DLQ",
    size: "large",
    content: <DlqDetailsModal item={item} />,
    showFooter: false,
  });
};

const DlqRow = ({ item, busyAction, onRequeue, onDiscard }) => {
  const jobId = item?.jobId || item?.job_id;
  const failedAt = item?.failedAt || item?.failed_at;
  const isBusy = Boolean(busyAction);

  return (
    <div className="grid grid-cols-1 gap-4 border-b border-gray-200/70 px-4 py-4 last:border-b-0 dark:border-gray-700/70 lg:grid-cols-[1fr_0.85fr_0.7fr_0.65fr]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="danger">Pendiente</StatusBadge>
          <span className={`font-mono text-xs ${TXT_META}`}>{item?.type || "sin_tipo"}</span>
        </div>
        <p className={`mt-2 truncate text-sm font-semibold ${TXT_TITLE}`}>{jobId || item?.id}</p>
        <p className={`mt-1 line-clamp-2 text-xs ${TXT_META}`}>{item?.error || "Sin detalle de error."}</p>
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Cola origen</p>
        <p className={`mt-1 font-mono text-xs ${TXT_TITLE}`}>{item?.queue || "Sin cola"}</p>
        <p className={`mt-2 text-xs ${TXT_META}`}>Intento: {item?.attempt ?? "Sin dato"}</p>
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Fallo</p>
        <p className={`mt-1 text-sm ${TXT_TITLE}`}>{formatDateTime(failedAt)}</p>
      </div>

      <div className="flex items-center justify-start gap-2 lg:justify-end">
        <ActionButton
          variant="soft"
          size="sm"
          icon={<Icon name="eye" />}
          tooltip="Analizar detalle"
          onClick={() => openDlqDetailsModal(item)}
          disabled={isBusy}
        />
        <ActionButton
          variant="soft"
          size="sm"
          icon={<Icon name="rotate" />}
          tooltip="Reprocesar tarea"
          onClick={() => onRequeue(item)}
          disabled={isBusy}
        />
        <ActionButton
          variant="danger"
          size="sm"
          icon={<Icon name="trash" />}
          tooltip="Descartar tarea"
          onClick={() => onDiscard(item)}
          disabled={isBusy}
        />
      </div>
    </div>
  );
};

const DlqOperationsPanel = ({ snapshot, isLoading, busyItemId, onReload, onRequeue, onDiscard }) => {
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const size = Number(snapshot?.size ?? 0);

  return (
    <SectionCard
      title="Bandeja DLQ"
      icon="FaTriangleExclamation"
      description="Revisa tareas fallidas antes de reprocesarlas o cerrarlas administrativamente. Las acciones quedan fuera de la bandeja pendiente y pasan al historial interno."
      actions={
        <ActionButton
          label="Actualizar DLQ"
          variant="soft"
          size="sm"
          icon={<Icon name="rotate" />}
          onClick={onReload}
          disabled={isLoading}
        />
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Pendientes de revisión</p>
          <p className={`mt-2 text-3xl font-semibold ${size > 0 ? "text-rose-600 dark:text-rose-300" : TXT_TITLE}`}>
            {size}
          </p>
          <p className={`mt-3 text-sm ${TXT_BODY}`}>
            {size > 0
              ? "Analiza el error y el payload antes de decidir reproceso o descarte."
              : "No hay tareas fallidas pendientes en DLQ."}
          </p>
          <p className={`mt-3 text-xs ${TXT_META}`}>Última lectura: {formatDateTime(snapshot?.refreshedAt)}</p>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-gray-200/80 bg-slate-50/80 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
          {isLoading ? (
            <div className="px-4 py-8 text-center">
              <p className={`text-sm ${TXT_BODY}`}>Cargando bandeja DLQ...</p>
            </div>
          ) : items.length ? (
            items.map((item) => (
              <DlqRow
                key={item.id}
                item={item}
                busyAction={busyItemId === item.id}
                onRequeue={onRequeue}
                onDiscard={onDiscard}
              />
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <Icon name="checkCircle" className="mx-auto h-8 w-8 text-emerald-500" />
              <p className={`mt-3 text-sm font-semibold ${TXT_TITLE}`}>DLQ sin pendientes</p>
              <p className={`mt-1 text-sm ${TXT_BODY}`}>No existen tareas fallidas esperando revisión manual.</p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
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
  const [dlqSnapshot, setDlqSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDlqLoading, setIsDlqLoading] = useState(false);
  const [busyDlqItemId, setBusyDlqItemId] = useState(null);
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
        const [statusResult, dlqResult] = await Promise.allSettled([
          systemQueueService.getStatus(),
          systemQueueService.listDlq({ limit: 50 }),
        ]);
        if (statusResult.status === "rejected") {
          throw statusResult.reason;
        }
        setQueueSnapshot(statusResult.value);
        if (dlqResult.status === "fulfilled") {
          setDlqSnapshot(dlqResult.value);
        }
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

  const loadDlq = async ({ silent = false } = {}) => {
    if (!silent) setIsDlqLoading(true);
    try {
      const result = await systemQueueService.listDlq({ limit: 50 });
      setDlqSnapshot(result);
    } catch (error) {
      toastError("No se pudo cargar DLQ", error?.message ?? "No fue posible obtener la bandeja DLQ.");
    } finally {
      setIsDlqLoading(false);
    }
  };

  const handleRequeueDlqItem = async (item) => {
    if (!item?.id || busyDlqItemId) return;
    const confirmed = await ModalManager.confirm({
      title: "Reprocesar tarea DLQ",
      message: `La tarea volverá a la cola ${item?.queue || "de origen"} con sus datos originales y contador de intentos reiniciado. Revisa el detalle antes de confirmar.`,
      confirmText: "Reprocesar",
      cancelText: "Cancelar",
    });
    if (!confirmed) return;

    setBusyDlqItemId(item.id);
    try {
      const result = await systemQueueService.requeueDlqItem(item.id);
      toastSuccess("Tarea reencolada", result?.message || "La tarea fue enviada nuevamente a proceso.");
      await loadQueues({ silent: true, notifyOnError: false, pauseAutoRefreshOnError: false });
    } catch (error) {
      toastError("No se pudo reprocesar", error?.message ?? "La tarea no pudo volver a la cola de origen.");
    } finally {
      setBusyDlqItemId(null);
    }
  };

  const handleDiscardDlqItem = async (item) => {
    if (!item?.id || busyDlqItemId) return;
    const confirmed = await ModalManager.confirm({
      title: "Descartar tarea DLQ",
      message: "La tarea saldrá de la bandeja pendiente y quedará registrada como descartada en el historial interno. Esta acción no ejecuta reproceso.",
      confirmText: "Descartar",
      cancelText: "Cancelar",
      variant: "danger",
    });
    if (!confirmed) return;

    setBusyDlqItemId(item.id);
    try {
      const result = await systemQueueService.discardDlqItem(item.id);
      toastSuccess("Tarea descartada", result?.message || "La tarea fue cerrada administrativamente.");
      await loadQueues({ silent: true, notifyOnError: false, pauseAutoRefreshOnError: false });
    } catch (error) {
      toastError("No se pudo descartar", error?.message ?? "La tarea DLQ no pudo cerrarse.");
    } finally {
      setBusyDlqItemId(null);
    }
  };

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

      <DlqOperationsPanel
        snapshot={dlqSnapshot}
        isLoading={isDlqLoading}
        busyItemId={busyDlqItemId}
        onReload={() => loadDlq()}
        onRequeue={handleRequeueDlqItem}
        onDiscard={handleDiscardDlqItem}
      />
    </div>
  );
};
