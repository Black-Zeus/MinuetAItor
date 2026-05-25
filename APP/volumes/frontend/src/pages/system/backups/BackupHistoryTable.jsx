import React from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import {
  StatusBadge,
  TXT_BODY,
  TXT_META,
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

const BACKUP_ORIGIN_META = {
  Automático: { icon: "FaClock", tone: "active" },
  Manual: { icon: "FaPlay", tone: "info" },
  Importado: { icon: "FaFolderOpen", tone: "warning" },
};

const getBackupOriginMeta = (originType) => BACKUP_ORIGIN_META[originType || "Automático"] ?? BACKUP_ORIGIN_META.Automático;

export const BackupHistoryTable = ({
  actionMode = "history",
  historyItems,
  isHistoryVisible,
  selectedItemId = null,
  onAnalyze,
  onDelete,
  onDownload,
  onRestore,
  onCancelOperation,
}) => (
  <div className="space-y-5">
    {!isHistoryVisible ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-amber-800/60 dark:bg-amber-950/10">
        <p className={`text-sm ${TXT_BODY}`}>
          El historial quedó marcado como oculto en la configuración guardada. Esta tabla sigue visible aquí porque estás en la vista administrativa.
        </p>
      </div>
    ) : null}

    {!historyItems.length ? (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
        <p className={`text-sm ${TXT_BODY}`}>No hay respaldos visibles en el historial.</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Fecha</th>
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Tipo</th>
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Origen</th>
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Archivo</th>
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Contenido</th>
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Tamaño</th>
              <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Estado</th>
              <th className={`py-3 text-right font-semibold ${TXT_META}`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {historyItems.map((item) => {
              const scopeMeta = getBackupScopeMeta(item.scope);
              const scopeLabel = getBackupScopeLabel(item.scope);
              const originMeta = getBackupOriginMeta(item.originType);
              const isActiveOperation = Boolean(item.isActiveOperation);
              return (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 align-top dark:border-gray-700/60"
                >
                  <td className="py-4 pr-4">
                    <p className={`font-medium ${TXT_TITLE}`}>{formatDateTime(item.createdAt)}</p>
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge tone={scopeMeta.tone}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name={scopeMeta.icon} className="h-3.5 w-3.5" />
                        {scopeLabel}
                      </span>
                    </StatusBadge>
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge tone={originMeta.tone}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name={originMeta.icon} className="h-3.5 w-3.5" />
                        {item.originType || "Automático"}
                      </span>
                    </StatusBadge>
                  </td>
                  <td className="py-4 pr-4">
                    <p className={`font-semibold ${TXT_TITLE}`}>{item.name}</p>
                    <p className={`mt-1 text-xs ${TXT_META}`}>{item.storagePath}</p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className={`font-medium ${TXT_TITLE}`}>{item.source}</p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className={`font-medium ${TXT_TITLE}`}>{formatBytes(item.sizeBytes)}</p>
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                  </td>
                  <td className="py-4 text-right">
                    {isActiveOperation ? (
                      item.rawStatus === "queued" ? (
                        <div className="ml-auto grid w-[56px] grid-cols-1 gap-2">
                          <ActionButton
                            variant="soft"
                            size="xs"
                            icon={<Icon name="FaXmark" />}
                            tooltip="Cancelar operación"
                            onClick={() => onCancelOperation(item)}
                            className="w-full hover:scale-100 active:scale-100"
                          />
                        </div>
                      ) : (
                        <span className={`text-xs font-semibold ${TXT_META}`}>Sin acciones</span>
                      )
                    ) : (
                      <div className={`ml-auto grid ${actionMode === "recovery" || actionMode === "history" ? "w-[168px] grid-cols-3" : "w-[112px] grid-cols-2"} gap-2`}>
                        <ActionButton
                          variant="soft"
                          size="xs"
                          icon={<Icon name="FaDownload" />}
                          tooltip="Descargar respaldo"
                          onClick={() => onDownload(item)}
                          className="w-full hover:scale-100 active:scale-100"
                        />
                        {actionMode === "recovery" ? (
                          <ActionButton
                            variant="soft"
                            size="xs"
                            icon={<Icon name="rotate" />}
                            tooltip="Restaurar respaldo"
                            onClick={() => onRestore(item)}
                            className="w-full hover:scale-100 active:scale-100"
                          />
                        ) : null}
                        {actionMode === "history" ? (
                          <ActionButton
                            variant={selectedItemId === item.id ? "primary" : "soft"}
                            size="xs"
                            icon={<Icon name="FaMagnifyingGlass" />}
                            tooltip="Analizar para recuperación"
                            onClick={() => onAnalyze(item)}
                            className="w-full hover:scale-100 active:scale-100"
                          />
                        ) : null}
                        <ActionButton
                          variant="soft"
                          size="xs"
                          icon={<Icon name="FaTrash" />}
                          tooltip="Limpiar vencidos"
                          onClick={() => onDelete(item)}
                          className="w-full hover:scale-100 active:scale-100"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
