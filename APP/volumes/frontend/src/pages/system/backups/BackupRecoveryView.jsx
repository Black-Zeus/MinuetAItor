import React from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import {
  MaintenanceField,
  MaintenanceInput,
  SectionCard,
  StatusBadge,
  TXT_BODY,
  TXT_TITLE,
  formatBytes,
  formatDateTime,
} from "@/pages/system/SystemSettingsShared";

const BACKUP_SCOPE_META = {
  BD: { icon: "FaDatabase", tone: "info" },
  Adjuntos: { icon: "paperclip", tone: "active" },
  MinIO: { icon: "paperclip", tone: "active" },
  FULL: { icon: "FaGears", tone: "warning" },
};

const getBackupScopeMeta = (scope) => BACKUP_SCOPE_META[scope] ?? BACKUP_SCOPE_META.FULL;
const getBackupScopeLabel = (scope) => (scope === "MinIO" ? "Adjuntos" : scope);

export const BackupRecoveryView = ({ onRestore, selectedRecoveryItem }) => {
  const scopeMeta = getBackupScopeMeta(selectedRecoveryItem?.scope);
  const scopeLabel = getBackupScopeLabel(selectedRecoveryItem?.scope);

  return (
    <SectionCard
      title="Preparar recuperación"
      icon="FaShield"
      description="Revisa la metadata del paquete antes de ejecutar una restauración destructiva."
      actions={selectedRecoveryItem ? (
        <ActionButton
          label="Restaurar"
          variant="primary"
          size="sm"
          icon={<Icon name="rotate" />}
          onClick={() => onRestore(selectedRecoveryItem)}
        />
      ) : null}
    >
      {selectedRecoveryItem ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-sm font-semibold ${TXT_TITLE}`}>Paquete listo para revisión de recuperación</p>
                <p className={`mt-2 text-sm ${TXT_BODY}`}>
                  Restaurar este paquete pondrá el sistema en mantenimiento y reemplazará la persistencia del ámbito indicado.
                </p>
              </div>
              <StatusBadge tone={scopeMeta.tone}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name={scopeMeta.icon} className="h-3.5 w-3.5" />
                  {scopeLabel}
                </span>
              </StatusBadge>
            </div>
          </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <MaintenanceField label="Archivo" hint="Paquete seleccionado desde Historial">
            <MaintenanceInput value={selectedRecoveryItem.name || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Origen" hint="Forma en que el paquete llegó al sistema">
            <MaintenanceInput value={selectedRecoveryItem.originType || "Automático"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tipo de respaldo" hint="Ámbito que se reemplazará">
            <div className="flex h-[42px] items-center rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <span className="inline-flex items-center gap-2">
                <Icon name={scopeMeta.icon} className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                {scopeLabel || "—"}
              </span>
            </div>
          </MaintenanceField>
          <MaintenanceField label="Fecha de exportación" hint="Momento de creación del paquete">
            <MaintenanceInput value={formatDateTime(selectedRecoveryItem.exportedAt || selectedRecoveryItem.createdAt)} disabled />
          </MaintenanceField>
          <MaintenanceField label="Fecha de registro" hint="Ingreso al historial del sistema">
            <MaintenanceInput value={formatDateTime(selectedRecoveryItem.createdAt)} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tamaño" hint="Volumen del paquete">
            <MaintenanceInput value={formatBytes(selectedRecoveryItem.sizeBytes)} disabled />
          </MaintenanceField>
          <MaintenanceField label="Contenido" hint="Fuente respaldada">
            <MaintenanceInput value={selectedRecoveryItem.source || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Estado" hint="Estado registrado del paquete">
            <MaintenanceInput value={selectedRecoveryItem.status || "—"} disabled />
          </MaintenanceField>
          <MaintenanceField label="Ruta" hint="Ubicación registrada">
            <MaintenanceInput value={selectedRecoveryItem.storagePath || "—"} disabled />
          </MaintenanceField>
        </div>

        <MaintenanceField label="Impacto de restauración" hint="Efecto esperado antes de ejecutar">
          <MaintenanceInput
            value={selectedRecoveryItem.restoreImpact || "Limpiará la persistencia vigente del ámbito seleccionado y cargará el contenido del paquete desde cero."}
            disabled
          />
        </MaintenanceField>
      </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
          <p className={`text-sm font-semibold ${TXT_TITLE}`}>Selecciona un paquete desde Historial</p>
          <p className={`mx-auto mt-2 max-w-2xl text-sm ${TXT_BODY}`}>
            Usa la acción Analizar en el historial para revisar metadata, impacto y alcance antes de habilitar la restauración.
          </p>
        </div>
      )}
    </SectionCard>
  );
};
