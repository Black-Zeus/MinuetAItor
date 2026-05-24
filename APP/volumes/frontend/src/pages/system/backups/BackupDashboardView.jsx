import React from "react";

import {
  BACKUP_POLICY_DEFINITIONS,
  BACKUP_STORAGE_ROOT_CONTAINER,
  BACKUP_STORAGE_ROOT_HOST,
  MaintenanceField,
  MaintenanceInput,
  SectionCard,
  StatusBadge,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
  formatDateTime,
} from "@/pages/system/SystemSettingsShared";

export const BackupDashboardView = ({
  backupSummaryItems,
  enabledPolicyCount,
  failedBackupCount,
  latestBackup,
  savedDraft,
  successfulBackupCount,
}) => (
  <>
    <SectionCard
      title="Dashboard de respaldos"
      icon="FaGaugeHigh"
      description="Resumen rápido de cobertura, conservación y señales operativas del módulo."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-5 dark:border-gray-700 dark:bg-slate-900/40">
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Políticas activas</p>
          <p className={`mt-3 text-3xl font-bold ${TXT_TITLE}`}>{enabledPolicyCount}/{BACKUP_POLICY_DEFINITIONS.length}</p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>Cobertura programada en la configuración guardada.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-5 dark:border-gray-700 dark:bg-slate-900/40">
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Último respaldo</p>
          <p className={`mt-3 text-lg font-semibold ${TXT_TITLE}`}>{latestBackup ? formatDateTime(latestBackup.createdAt) : "Sin registros"}</p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>{latestBackup ? `${latestBackup.scope} · ${latestBackup.status}` : "El historial no contiene paquetes visibles."}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-5 dark:border-gray-700 dark:bg-slate-900/40">
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Retención</p>
          <p className={`mt-3 text-3xl font-bold ${TXT_TITLE}`}>{savedDraft.backupRetentionDays}</p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>Días de conservación común para paquetes.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-5 dark:border-gray-700 dark:bg-slate-900/40">
          <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Resultado histórico</p>
          <p className={`mt-3 text-lg font-semibold ${TXT_TITLE}`}>{successfulBackupCount} OK · {failedBackupCount} fallidos</p>
          <p className={`mt-2 text-sm ${TXT_BODY}`}>Conteo disponible desde el historial visible.</p>
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
      title="Almacenamiento y purge"
      icon="FaDatabase"
      description="Rutas y canales usados por las políticas de respaldo."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MaintenanceField label="Raíz contenedor" hint="Ruta usada por backend dentro del contenedor">
          <MaintenanceInput value={BACKUP_STORAGE_ROOT_CONTAINER} disabled />
        </MaintenanceField>
        <MaintenanceField label="Raíz host" hint="Ruta relativa visible desde el proyecto">
          <MaintenanceInput value={BACKUP_STORAGE_ROOT_HOST} disabled />
        </MaintenanceField>
        <MaintenanceField label="Purge interno" hint="Canal previsto para limpieza de paquetes antiguos">
          <MaintenanceInput value={savedDraft.backupPurgeQueue} disabled />
        </MaintenanceField>
        <MaintenanceField label="Historial" hint="Visibilidad guardada">
          <MaintenanceInput value={savedDraft.backupHistoryVisible ? "Visible" : "Oculto"} disabled />
        </MaintenanceField>
      </div>
    </SectionCard>
  </>
);
