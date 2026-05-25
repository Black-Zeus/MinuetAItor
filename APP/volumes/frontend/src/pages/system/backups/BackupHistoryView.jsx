import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import { BackupHistoryTable } from "@/pages/system/backups/BackupHistoryTable";
import {
  MaintenanceField,
  MaintenanceInput,
  SectionCard,
  formatBytes,
} from "@/pages/system/SystemSettingsShared";

const BackupToolbarButton = ({
  icon,
  labelTop,
  labelBottom,
  onClick,
  variant = "soft",
  className = "",
}) => {
  const variantClasses = variant === "primary"
    ? "bg-primary-700/80 text-white hover:bg-primary-700 focus-visible:ring-primary-700/35"
    : "border border-gray-200 bg-white/60 text-gray-800 hover:bg-white focus-visible:ring-white/15 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-100 dark:hover:bg-gray-800/40";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-[58px] w-full items-center justify-start gap-3 rounded-2xl px-4 py-2 text-left font-semibold",
        "shadow-button transition-all duration-150 ease-out hover:shadow-button-hover active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-4",
        variantClasses,
        className,
      ].join(" ")}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-current/10 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col justify-center leading-tight">
        <span className="text-sm">{labelTop}</span>
        <span className="text-sm">{labelBottom}</span>
      </span>
    </button>
  );
};

export const BackupHistoryView = ({
  historyItems,
  latestImportAnalysis,
  onAnalyze,
  onDelete,
  onDownload,
  onCancelOperation,
  onImportPackage,
  onRunManualBackup,
  onSyncCatalog,
  savedDraft,
  selectedRecoveryItem,
}) => (
  <>
    <SectionCard
      title="Historial de respaldos"
      icon="FaClockRotateLeft"
      description="Consulta paquetes generados, manuales o importados. Analizar prepara el paquete en Recuperación sin ejecutar restauración."
      actions={(
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <BackupToolbarButton
            labelTop="Respaldar"
            labelBottom="Base de Datos"
            icon={<Icon name="FaDatabase" />}
            onClick={() => onRunManualBackup("database")}
          />
          <BackupToolbarButton
            labelTop="Respaldar"
            labelBottom="Adjuntos"
            icon={<Icon name="paperclip" />}
            onClick={() => onRunManualBackup("objects")}
          />
          <BackupToolbarButton
            labelTop="Respaldo"
            labelBottom="Completo"
            icon={<Icon name="FaGears" />}
            onClick={() => onRunManualBackup("full")}
          />
          <BackupToolbarButton
            labelTop="Actualizar"
            labelBottom="Catálogo"
            icon={<Icon name="rotate" />}
            onClick={onSyncCatalog}
          />
          <BackupToolbarButton
            labelTop="Importar"
            labelBottom="Paquete"
            variant="primary"
            icon={<Icon name="FaFolderOpen" />}
            onClick={onImportPackage}
          />
        </div>
      )}
    >
      <BackupHistoryTable
        actionMode="history"
        historyItems={historyItems}
        isHistoryVisible={savedDraft.backupHistoryVisible}
        selectedItemId={selectedRecoveryItem?.id}
        onAnalyze={onAnalyze}
        onDelete={onDelete}
        onDownload={onDownload}
        onCancelOperation={onCancelOperation}
      />
    </SectionCard>

    {latestImportAnalysis ? (
      <SectionCard
        title="Último paquete importado"
        icon="FaFolderOpen"
        description="Resumen del último paquete externo analizado y registrado en el historial de esta sesión."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MaintenanceField label="Archivo" hint="">
            <MaintenanceInput value={latestImportAnalysis.file.name} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tipo" hint="">
            <MaintenanceInput value={latestImportAnalysis.scope} disabled />
          </MaintenanceField>
          <MaintenanceField label="Formato" hint="">
            <MaintenanceInput value={latestImportAnalysis.format} disabled />
          </MaintenanceField>
          <MaintenanceField label="Tamaño" hint="">
            <MaintenanceInput value={formatBytes(latestImportAnalysis.file.size)} disabled />
          </MaintenanceField>
        </div>
      </SectionCard>
    ) : null}
  </>
);
