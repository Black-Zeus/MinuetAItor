import React, { useEffect, useRef, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import { BackupDashboardView } from "@/pages/system/backups/BackupDashboardView";
import { BackupHistoryView } from "@/pages/system/backups/BackupHistoryView";
import { BackupRecoveryView } from "@/pages/system/backups/BackupRecoveryView";
import { BackupScheduleView } from "@/pages/system/backups/BackupScheduleView";
import { BackupTechnicalView } from "@/pages/system/backups/BackupTechnicalView";
import { BackupsPanelTabs } from "@/pages/system/backups/BackupsPanelTabs";
import {
  BACKUP_DESTINATION_LABELS,
  BACKUP_HISTORY_ITEMS,
  BACKUP_POLICY_DEFINITIONS,
  BACKUP_STORAGE_ROOT_CONTAINER,
  BACKUP_STORAGE_ROOT_HOST,
  BACKUP_VERIFICATION_LABELS,
  DraftModeNotice,
  INITIAL_BACKUPS_DRAFT,
  MaintenanceField,
  MaintenanceInput,
  StatusBadge,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
  clonePlainObject,
  formatBytes,
  formatDateTime,
  inferImportPackageAnalysis,
  openCronPlannerModal,
  validateCronExpression,
} from "@/pages/system/SystemSettingsShared";

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
          <input
            ref={inputRef}
            type="file"
            accept=".tar,.tar.gz,.tgz,.zip,.sql,.sql.gz"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
            }}
          />

          <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50/70 px-5 py-5 dark:border-gray-700 dark:bg-slate-900/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-sm font-medium ${TXT_TITLE}`}>Carga de archivo</p>
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
              <StatusBadge tone="info">Registro de paquete</StatusBadge>
            </div>
            <p className={`mt-2 text-sm ${TXT_BODY}`}>
              El análisis terminó. Revisa el alcance antes de registrar el paquete en el historial.
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
            Importar registra el paquete externo en el historial para que pueda ser analizado y restaurado posteriormente desde Recuperación.
          </p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            Este paso no modifica la persistencia activa del sistema.
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

        <MaintenanceField label="Impacto" hint="Acción esperada si se ejecuta la importación">
          <MaintenanceInput value={analysis?.restoreImpact || "—"} disabled />
        </MaintenanceField>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-5 dark:border-gray-700">
        <ActionButton
          label="Cancelar"
          variant="soft"
          size="sm"
          onClick={onClose}
        />
        <ActionButton
          label="Registrar"
          variant="primary"
          size="sm"
          onClick={onImport}
        />
      </div>
    </div>
  </div>
);

const IMPORT_EXECUTION_STEPS = [
  "Validando paquete",
  "Calculando metadata",
  "Registrando paquete en historial",
  "Preparando paquete para recuperación",
  "Guardando resultado",
];

const RESTORE_EXECUTION_STEPS_BY_SCOPE = {
  BD: [
    "Validando respaldo de base de datos",
    "Limpiando base de datos activa",
    "Restaurando estructura y datos",
    "Registrando resultado de restauración",
  ],
  Adjuntos: [
    "Validando respaldo de objetos",
    "Limpiando objetos y adjuntos activos",
    "Restaurando buckets y artefactos",
    "Registrando resultado de restauración",
  ],
  MinIO: [
    "Validando respaldo de objetos",
    "Limpiando objetos y adjuntos activos",
    "Restaurando buckets y artefactos",
    "Registrando resultado de restauración",
  ],
  FULL: [
    "Validando respaldo completo",
    "Limpiando persistencia activa",
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
            <h2 className={`text-xl font-semibold ${TXT_TITLE}`}>Registro de importación</h2>
            <StatusBadge tone={isDone ? "active" : "warning"}>
              {isDone ? "Completado" : "En curso"}
            </StatusBadge>
          </div>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>
            Se está registrando el paquete `{analysis?.file?.name || "seleccionado"}` en el historial.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
            <p className={`text-sm ${TXT_BODY}`}>
              Este proceso no restaura datos ni limpia persistencia activa. Solo deja el paquete disponible para análisis de recuperación.
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

const CompletedProcessModal = ({ title, description, onClose }) => (
  <div className="flex w-full justify-center px-4">
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500" />

      <div className="flex flex-col items-center p-8 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
          <Icon name="FaCheck" className="h-7 w-7" />
        </div>

        <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
          {title || "Proceso terminado"}
        </h2>
        <p className="mb-6 max-w-[34ch] text-sm text-gray-500 dark:text-gray-400">
          {description || "La operación fue procesada correctamente."}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
);

export const BackupsPanel = () => {
  const [activeBackupTab, setActiveBackupTab] = useState("dashboard");
  const [expandedScheduleSections, setExpandedScheduleSections] = useState({
    database: true,
    objects: false,
    full: false,
    retention: false,
  });
  const [draft, setDraft] = useState(() => clonePlainObject(INITIAL_BACKUPS_DRAFT));
  const [savedDraft, setSavedDraft] = useState(() => clonePlainObject(INITIAL_BACKUPS_DRAFT));
  const [historyItems, setHistoryItems] = useState(BACKUP_HISTORY_ITEMS);
  const [latestImportAnalysis, setLatestImportAnalysis] = useState(null);
  const [selectedRecoveryItem, setSelectedRecoveryItem] = useState(null);
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
    openCronPlannerModal({
      modalTitle: title,
      currentValue: draft.policies[policyId]?.cron,
      ModalManager,
      onSelect: (cronValue) => {
        updatePolicyDraft(policyId, "cron", cronValue);
        setCronErrors((prev) => ({ ...prev, [`${policyId}.cron`]: "" }));
        ModalManager.closeAll();
      },
    });
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const handleDiscard = () => {
    setDraft(clonePlainObject(savedDraft));
    setCronErrors({});
  };

  const toggleScheduleSection = (sectionId) => {
    setExpandedScheduleSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
    }));
  };

  const handleSave = async () => {
    const invalidEntries = BACKUP_POLICY_DEFINITIONS
      .map((policyDefinition) => [policyDefinition.id, validatePolicyCron(policyDefinition.id)])
      .filter(([, validation]) => !validation.isValid);

    if (invalidEntries.length) {
      toastError("Programación inválida", "Revisa las programaciones de respaldo antes de guardar.");
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: "Guardar cambios de respaldos",
      message: "¿Deseas guardar la configuración de respaldos? Las políticas, horarios y reglas del borrador pasarán a ser la versión activa de esta pantalla.",
      confirmText: "Guardar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

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
        { label: "Cobertura", value: "BD, Adjuntos y Full" },
      ],
    },
  ];
  const enabledPolicyCount = BACKUP_POLICY_DEFINITIONS.filter((policyDefinition) => savedDraft.policies[policyDefinition.id]?.enabled).length;
  const latestBackup = historyItems[0] ?? null;
  const successfulBackupCount = historyItems.filter((item) => item.tone === "active" || item.status === "Completado").length;
  const failedBackupCount = historyItems.filter((item) => item.tone === "danger" || item.status === "Fallido").length;

  const handleDownloadBackup = (item) => {
    toastSuccess("Descarga preparada", `Se preparó la descarga de "${item.name}".`);
  };

  const handleAnalyzeBackup = (item) => {
    setSelectedRecoveryItem(item);
    setActiveBackupTab("recovery");
  };

  const handleRunManualBackup = async (policyId) => {
    const policyDefinition = BACKUP_POLICY_DEFINITIONS.find((candidate) => candidate.id === policyId);
    const policy = savedDraft.policies[policyId];
    if (!policyDefinition || !policy) return;

    const confirmed = await ModalManager.confirm({
      title: `Respaldar ${policyDefinition.shortLabel}`,
      message: `¿Deseas solicitar un respaldo manual de ${policyDefinition.title.toLowerCase()}? El paquete quedará registrado en el historial.`,
      confirmText: "Respaldar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
    ].join("");
    const extension = policy.fileFormat === "sql_plain" ? "sql" : policy.fileFormat === "tar_plain" ? "tar" : policy.fileFormat === "zip_bundle" ? "zip" : policy.fileFormat === "sql_gzip" ? "sql.gz" : "tar.gz";
    const name = `${policyId}-manual-${stamp}.${extension}`;
    const item = {
      id: `manual-${policyId}-${Date.now()}`,
      name,
      scope: policyDefinition.shortLabel,
      source: policyDefinition.source,
      originType: "Manual",
      createdAt: now.toISOString(),
      exportedAt: now.toISOString(),
      sizeBytes: 0,
      storagePath: `${policy.pathPrefix}/${name}`,
      status: "Solicitado",
      tone: "info",
      restoreImpact: `limpiará la persistencia activa del ámbito ${policyDefinition.shortLabel} antes de cargar desde cero el contenido del paquete`,
    };

    setHistoryItems((prev) => [item, ...prev]);
    toastSuccess("Respaldo manual solicitado", `${policyDefinition.title} quedó registrado en el historial.`);
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
                      toastSuccess("Registro iniciado", "El paquete se está registrando en el historial.");
                      ModalManager.closeAll();
                      ModalManager.show({
                        type: "custom",
                        title: "Registro de importación",
                        size: "clientWide",
                        showHeader: false,
                        showFooter: false,
                        closeOnBackdrop: false,
                        content: (
                          <ImportBackupExecutionModal
                            analysis={analysis}
                            onComplete={() => {
                              const importedItem = {
                                id: `imported-${Date.now()}`,
                                name: analysis?.file?.name || "paquete-importado",
                                scope: analysis?.scope || "FULL",
                                source: analysis?.source || "MariaDB + objetos + configuración",
                                originType: "Importado",
                                createdAt: new Date().toISOString(),
                                exportedAt: analysis?.file?.lastModified ? new Date(analysis.file.lastModified).toISOString() : null,
                                sizeBytes: analysis?.file?.size || 0,
                                storagePath: `${BACKUP_STORAGE_ROOT_CONTAINER}/imports/${analysis?.file?.name || "paquete-importado"}`,
                                status: "Importado",
                                tone: "warning",
                                restoreImpact: analysis?.restoreImpact || "limpiará la persistencia activa antes de cargar desde cero el contenido del paquete",
                              };
                              setHistoryItems((prev) => [importedItem, ...prev]);
                              setSelectedRecoveryItem(importedItem);
                              ModalManager.closeAll();
                              ModalManager.show({
                                type: "custom",
                                title: "Paquete registrado",
                                size: "clientWide",
                                showHeader: false,
                                showFooter: false,
                                closeOnBackdrop: false,
                                content: (
                                  <CompletedProcessModal
                                    title="Paquete registrado"
                                    description={
                                      analysis?.file?.name
                                        ? `El paquete "${analysis.file.name}" quedó disponible en Historial y preparado para Recuperación.`
                                        : "El paquete seleccionado quedó disponible en Historial y preparado para Recuperación."
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
      message: `¿Deseas eliminar "${item.name}" del historial? Esta acción quitará el paquete listado de la vista administrativa.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    setHistoryItems((prev) => prev.filter((candidate) => candidate.id !== item.id));
    if (selectedRecoveryItem?.id === item.id) {
      setSelectedRecoveryItem(null);
    }
    toastSuccess("Respaldo eliminado", `Se eliminó "${item.name}" del historial visible.`);
  };

  return (
    <div className="space-y-6">
      {hasChanges ? <DraftModeNotice /> : null}

      <BackupsPanelTabs activeTab={activeBackupTab} onTabChange={setActiveBackupTab} />

      {activeBackupTab === "dashboard" ? (
        <BackupDashboardView
          backupSummaryItems={backupSummaryItems}
          enabledPolicyCount={enabledPolicyCount}
          failedBackupCount={failedBackupCount}
          latestBackup={latestBackup}
          savedDraft={savedDraft}
          successfulBackupCount={successfulBackupCount}
        />
      ) : null}

      {activeBackupTab === "schedule" ? (
        <BackupScheduleView
          cronErrors={cronErrors}
          draft={draft}
          expandedScheduleSections={expandedScheduleSections}
          hasChanges={hasChanges}
          onDiscard={handleDiscard}
          onOpenPolicyCronPlanner={openPolicyCronPlanner}
          onSave={handleSave}
          onToggleSection={toggleScheduleSection}
          onUpdateDraft={updateDraft}
          onUpdatePolicyDraft={updatePolicyDraft}
          onValidatePolicyCron={validatePolicyCron}
        />
      ) : null}

      {activeBackupTab === "history" ? (
        <BackupHistoryView
          historyItems={historyItems}
          latestImportAnalysis={latestImportAnalysis}
          savedDraft={savedDraft}
          selectedRecoveryItem={selectedRecoveryItem}
          onAnalyze={handleAnalyzeBackup}
          onDelete={handleDeleteBackup}
          onDownload={handleDownloadBackup}
          onImportPackage={openImportPackageModal}
          onRunManualBackup={handleRunManualBackup}
        />
      ) : null}

      {activeBackupTab === "recovery" ? (
        <BackupRecoveryView
          selectedRecoveryItem={selectedRecoveryItem}
          onRestore={handleRestoreBackup}
        />
      ) : null}

      {activeBackupTab === "technical" ? (
        <BackupTechnicalView savedDraft={savedDraft} />
      ) : null}
    </div>
  );
};
