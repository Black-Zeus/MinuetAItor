import React from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { BackupHistoryTable } from "@/pages/system/backups/BackupHistoryTable";
import {
  MaintenanceField,
  MaintenanceInput,
  SectionCard,
  formatBytes,
} from "@/pages/system/SystemSettingsShared";

export const BackupHistoryView = ({
  historyItems,
  latestImportAnalysis,
  onAnalyze,
  onDelete,
  onDownload,
  onImportPackage,
  onRunManualBackup,
  savedDraft,
  selectedRecoveryItem,
}) => (
  <>
    <SectionCard
      title="Historial de respaldos"
      icon="FaClockRotateLeft"
      description="Consulta paquetes generados, manuales o importados. Analizar prepara el paquete en Recuperación sin ejecutar restauración."
      actions={(
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Respaldar BD"
            variant="soft"
            size="sm"
            icon={<Icon name="FaDatabase" />}
            onClick={() => onRunManualBackup("database")}
          />
          <ActionButton
            label="Respaldar Adjuntos"
            variant="soft"
            size="sm"
            icon={<Icon name="paperclip" />}
            onClick={() => onRunManualBackup("objects")}
          />
          <ActionButton
            label="Respaldar Full"
            variant="soft"
            size="sm"
            icon={<Icon name="FaGears" />}
            onClick={() => onRunManualBackup("full")}
          />
          <ActionButton
            label="Importar paquete"
            variant="primary"
            size="sm"
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
