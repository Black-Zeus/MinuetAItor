import React, { useCallback, useEffect, useMemo, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import systemMaintenanceService from "@/services/systemMaintenanceService";
import { formatDateTime, SectionCard, TXT_BODY, TXT_META, TXT_TITLE } from "@/pages/system/SystemSettingsShared";

const SYSTEM_MAINTENANCE_RUNTIME_EVENT = "system-maintenance-runtime-update";

const STATUS_META = {
  ok: {
    label: "Listo",
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    icon: "FaCircleCheck",
  },
  warning: {
    label: "Revisar",
    className: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    icon: "FaTriangleExclamation",
  },
  failed: {
    label: "Bloqueante",
    className: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    icon: "FaCircleExclamation",
  },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.warning;
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <Icon name={meta.icon} className="h-3 w-3" />
      {meta.label}
    </span>
  );
};

const SummaryTile = ({ label, value, tone = "neutral" }) => {
  const toneClass = {
    ok: "text-emerald-300",
    warning: "text-amber-200",
    failed: "text-rose-200",
    neutral: "text-primary-200",
  }[tone] || "text-primary-200";

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/20 px-4 py-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
};

const groupChecks = (checks) =>
  checks.reduce((acc, check) => {
    const category = check?.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(check);
    return acc;
  }, {});

const CommissioningPanel = () => {
  const [readiness, setReadiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);

  const loadReadiness = useCallback(async ({ run = false } = {}) => {
    setIsLoading(!run);
    setIsRunning(run);
    try {
      const result = run
        ? await systemMaintenanceService.runReadiness()
        : await systemMaintenanceService.getReadiness();
      setReadiness(result);
      if (run) {
        toastSuccess("Validación actualizada", "El checklist de puesta en marcha fue recalculado.");
      }
    } catch (error) {
      toastError("No se pudo validar", error?.message ?? "La validación no pudo completarse.");
    } finally {
      setIsLoading(false);
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  const summary = readiness?.summary || {};
  const operationMode = readiness?.operationState?.mode || "normal";
  const canActivateProduction = Boolean(readiness?.canActivateProduction);
  const blockingFailed = Number(summary.blockingFailed ?? 0);
  const hasBlockingPending = blockingFailed > 0;
  const isCommissioningActive = operationMode === "commissioning";
  const isNormalMode = operationMode === "normal";
  const groupedChecks = useMemo(() => groupChecks(readiness?.checks || []), [readiness?.checks]);

  const changeMode = async (mode) => {
    if (isChangingMode) return;
    if (mode === "normal" && !canActivateProduction) {
      ModalManager.warning({
        title: "Validaciones pendientes",
        message: "Existen validaciones bloqueantes sin resolver. Corrige esos puntos antes de pasar a modo productivo.",
      });
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: mode === "commissioning" ? "Activar puesta en marcha" : "Pasar a productivo",
      message: mode === "commissioning"
        ? "Solo administradores podrán iniciar sesión y escribir mientras este modo esté activo."
        : "El sistema volverá a operación normal. Confirma que las validaciones bloqueantes ya están cerradas.",
      confirmText: mode === "commissioning" ? "Activar" : "Pasar a productivo",
      cancelText: "Cancelar",
    });
    if (!confirmed) return;

    setIsChangingMode(true);
    try {
      await systemMaintenanceService.setOperationMode(
        mode,
        mode === "commissioning"
          ? "Puesta en marcha activada para validar requisitos antes de operación productiva."
          : "Validaciones de puesta en marcha completadas; sistema habilitado para operación productiva."
      );
      window.dispatchEvent(new CustomEvent(SYSTEM_MAINTENANCE_RUNTIME_EVENT));
      await loadReadiness();
      toastSuccess("Modo operativo actualizado", mode === "commissioning" ? "Puesta en marcha activa." : "El sistema quedó en modo normal.");
    } catch (error) {
      toastError("No se pudo cambiar el modo", error?.message ?? "La solicitud no pudo completarse.");
    } finally {
      setIsChangingMode(false);
    }
  };

  if (isLoading) {
    return (
      <SectionCard title="Puesta en marcha" icon="FaRocket" description="Validación inicial del entorno antes de operación productiva.">
        <p className={`text-sm ${TXT_BODY}`}>Cargando checklist de validación...</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Puesta en marcha"
        icon="FaRocket"
        description="Modo controlado para validar requisitos base. Mientras está activo, solo administradores pueden iniciar sesión y escribir."
        actions={
          <ActionButton
            label="Actualizar"
            variant="soft"
            size="sm"
            icon={<Icon name="FaRotate" />}
            disabled={isRunning}
            onClick={() => loadReadiness({ run: true })}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/20 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Estado operativo</p>
                <h3 className={`mt-2 text-xl font-semibold ${TXT_TITLE}`}>
                  {isCommissioningActive
                    ? "Puesta en marcha activa"
                    : hasBlockingPending
                      ? "Modo normal con validaciones pendientes"
                      : "Sistema listo para operación productiva"}
                </h3>
                <p className={`mt-2 text-sm leading-6 ${TXT_BODY}`}>
                  {isCommissioningActive
                    ? "El sistema está restringido: solo administradores pueden iniciar sesión y escribir mientras se completan las validaciones base."
                    : hasBlockingPending
                      ? "El sistema está en modo normal. Las validaciones bloqueantes siguen pendientes, pero no están restringiendo el uso hasta activar puesta en marcha."
                      : "No hay validaciones bloqueantes pendientes. Las advertencias quedan para revisión operativa antes del go-live."}
                </p>
                <p className={`mt-3 text-xs ${TXT_META}`}>Última validación: {formatDateTime(readiness?.generatedAt)}</p>
              </div>
              <StatusBadge status={canActivateProduction ? "ok" : "failed"} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              <SummaryTile label="Listas" value={summary.ok ?? 0} tone="ok" />
              <SummaryTile label="Advertencias" value={summary.warning ?? 0} tone="warning" />
              <SummaryTile label="Fallidas" value={summary.failed ?? 0} tone="failed" />
              <SummaryTile label="Bloqueantes" value={summary.blockingFailed ?? 0} tone="failed" />
              <SummaryTile label="Total" value={summary.total ?? 0} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/20 p-5">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Control manual</p>
            <div className="mt-4 space-y-3">
              <ActionButton
                label="Activar puesta en marcha"
                variant="warning"
                size="md"
                icon={<Icon name="FaLock" />}
                className="w-full"
                disabled={isChangingMode || isCommissioningActive}
                onClick={() => changeMode("commissioning")}
              />
              <ActionButton
                label="Pasar a productivo"
                variant="success"
                size="md"
                icon={<Icon name="check" />}
                className="w-full"
                disabled={isChangingMode || isNormalMode || !canActivateProduction}
                onClick={() => changeMode("normal")}
              />
            </div>
            {isNormalMode && hasBlockingPending ? (
              <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100">
                El sistema está operativo para los usuarios. Activa puesta en marcha si necesitas bloquear accesos no administrativos mientras corriges las validaciones.
              </p>
            ) : null}
            {!canActivateProduction ? (
              <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100">
                No puedes pasar a productivo hasta cerrar las validaciones bloqueantes.
              </p>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {Object.entries(groupedChecks).map(([category, checks]) => (
        <SectionCard key={category} title={category} icon="FaListCheck" description={`${checks.length} validaciones`}>
          <div className="divide-y divide-slate-700/60 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/10">
            {checks.map((check) => (
              <div key={check.id} className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[220px_1fr_auto] lg:items-center">
                <div className="flex items-center gap-2">
                  <StatusBadge status={check.status} />
                  {check.blocking ? (
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[11px] font-semibold text-slate-300">bloqueante</span>
                  ) : null}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${TXT_TITLE}`}>{check.title}</p>
                  <p className={`mt-1 text-sm ${TXT_BODY}`}>{check.message}</p>
                </div>
                <p className={`text-xs font-mono ${TXT_META}`}>{check.id}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
};

export default CommissioningPanel;
