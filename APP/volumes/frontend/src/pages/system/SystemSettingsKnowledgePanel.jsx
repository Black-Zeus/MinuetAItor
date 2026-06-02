import React, { useEffect, useMemo, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import {
  formatDateTime,
  MaintenanceToggle,
  SectionCard,
  StatusBadge,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
} from "@/pages/system/SystemSettingsShared";
import aiProviderBindingService from "@/services/aiProviderBindingService";
import aiProviderConfigService from "@/services/aiProviderConfigService";
import contextService from "@/services/contextService";
import contextSettingsService from "@/services/contextSettingsService";
import { ensureWriteOperationAllowed } from "@/utils/operationModeGuard";

const INITIAL_CONTEXT_SETTINGS = {
  contextAiEnabled: false,
  queryEnabled: false,
  indexingEnabled: false,
  syncEnabled: false,
};

const SETTING_DEFINITIONS = [
  {
    key: "contextAiEnabled",
    title: "Modulo Contexto IA",
    description: "Control maestro para habilitar o apagar la consulta contextual sin borrar el indice.",
  },
  {
    key: "queryEnabled",
    title: "Consultas contextuales",
    description: "Permite responder preguntas usando minutas finales sincronizadas.",
  },
  {
    key: "indexingEnabled",
    title: "Indexacion automatica",
    description: "Permite encolar minutas finalizadas para sincronizacion semantica.",
  },
  {
    key: "syncEnabled",
    title: "Sincronizacion manual",
    description: "Permite acciones operativas como reintentar, reindexar o regenerar.",
  },
];

const normalizeSettings = (payload) => ({
  contextAiEnabled: Boolean(payload?.contextAiEnabled ?? payload?.context_ai_enabled ?? false),
  queryEnabled: Boolean(payload?.queryEnabled ?? payload?.query_enabled ?? false),
  indexingEnabled: Boolean(payload?.indexingEnabled ?? payload?.indexing_enabled ?? false),
  syncEnabled: Boolean(payload?.syncEnabled ?? payload?.sync_enabled ?? false),
});

const SYNC_STATUS_LABELS = {
  not_indexed: "No indexada",
  queued: "En cola",
  indexing: "Indexando",
  synced: "Sincronizada",
  outdated: "Desactualizada",
  failed: "Error",
  disabled: "Deshabilitada",
  deleted_from_index: "Fuera del índice",
  deleting: "Limpiando",
};

const SYNC_STATUS_TONES = {
  not_indexed: "warning",
  queued: "info",
  indexing: "info",
  synced: "active",
  outdated: "warning",
  failed: "danger",
  disabled: "inactive",
  deleted_from_index: "inactive",
  deleting: "warning",
};

const DOCUMENT_FILTERS = [
  { id: "not_indexed", label: "No indexadas" },
  { id: "outdated", label: "Desactualizadas" },
  { id: "failed", label: "Con error" },
  { id: "synced", label: "Sincronizadas" },
];

const normalizeSyncStatus = (payload) => ({
  totalDocuments: Number(payload?.totalDocuments ?? payload?.total_documents ?? 0),
  byStatus: payload?.byStatus ?? payload?.by_status ?? {},
  failedDocuments: Number(payload?.failedDocuments ?? payload?.failed_documents ?? 0),
  outdatedDocuments: Number(payload?.outdatedDocuments ?? payload?.outdated_documents ?? 0),
  notIndexedDocuments: Number(payload?.notIndexedDocuments ?? payload?.not_indexed_documents ?? 0),
});

const normalizeSyncMinutes = (payload) => ({
  items: Array.isArray(payload?.items) ? payload.items : [],
  total: Number(payload?.total ?? 0),
  skip: Number(payload?.skip ?? 0),
  limit: Number(payload?.limit ?? 50),
});

const normalizeQdrantHealth = (payload) => ({
  ok: Boolean(payload?.ok),
  status: payload?.status || "unknown",
  url: payload?.url || null,
  collectionsCount: Number(payload?.collectionsCount ?? payload?.collections_count ?? 0),
  message: payload?.message || "",
  checkedAt: payload?.checkedAt ?? payload?.checked_at ?? null,
});

const actionSummary = (result) => {
  const queued = Number(result?.queued ?? 0);
  const skipped = Number(result?.skipped ?? 0);
  const message = result?.message ? `${result.message} ` : "";
  return `${message}Encoladas: ${queued}. Omitidas: ${skipped}.`;
};

export const KnowledgePanel = () => {
  const [savedDraft, setSavedDraft] = useState(INITIAL_CONTEXT_SETTINGS);
  const [draft, setDraft] = useState(INITIAL_CONTEXT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [qdrantHealth, setQdrantHealth] = useState(null);
  const [syncItems, setSyncItems] = useState([]);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncFilter, setSyncFilter] = useState("not_indexed");
  const [syncError, setSyncError] = useState("");
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [runningAction, setRunningAction] = useState("");
  const [aiBindings, setAiBindings] = useState([]);
  const [aiProviders, setAiProviders] = useState([]);

  const hasChanges = useMemo(
    () => JSON.stringify(savedDraft) !== JSON.stringify(draft),
    [draft, savedDraft]
  );

  const isSyncAvailable = Boolean(savedDraft.contextAiEnabled && savedDraft.syncEnabled);
  const embeddingBinding = useMemo(
    () => aiBindings.find((binding) => binding?.purpose === "context_embeddings"),
    [aiBindings]
  );
  const embeddingProvider = useMemo(
    () => aiProviders.find((provider) => String(provider?.id) === String(embeddingBinding?.providerConfigId)),
    [aiProviders, embeddingBinding]
  );

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const result = normalizeSettings(await contextSettingsService.getConfig());
      setSavedDraft(result);
      setDraft(result);
    } catch (error) {
      toastError("No se pudo cargar Contexto IA", error?.message ?? "Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSyncData = async () => {
    if (!isSyncAvailable) {
      setSyncStatus(null);
      setQdrantHealth(null);
      setSyncItems([]);
      setSyncTotal(0);
      setSyncError("");
      return;
    }

    setIsSyncLoading(true);
    setSyncError("");
    try {
      const [statusPayload, healthPayload, minutesPayload, bindingsPayload, providersPayload] = await Promise.all([
        contextService.getSyncStatus(),
        contextService.getQdrantHealth().catch((error) => ({
          ok: false,
          status: "unreachable",
          message: error?.message || "No fue posible verificar Qdrant.",
          checkedAt: new Date().toISOString(),
        })),
        contextService.listSyncMinutes({ status_filter: syncFilter, skip: 0, limit: 25 }),
        aiProviderBindingService.list(),
        aiProviderConfigService.list({ limit: 100 }),
      ]);
      setSyncStatus(normalizeSyncStatus(statusPayload));
      setQdrantHealth(normalizeQdrantHealth(healthPayload));
      const minutes = normalizeSyncMinutes(minutesPayload);
      setSyncItems(minutes.items);
      setSyncTotal(minutes.total);
      setAiBindings(Array.isArray(bindingsPayload) ? bindingsPayload : []);
      setAiProviders(Array.isArray(providersPayload?.items) ? providersPayload.items : []);
    } catch (error) {
      setSyncStatus(null);
      setQdrantHealth(null);
      setSyncItems([]);
      setSyncTotal(0);
      setSyncError(error?.message ?? "No se pudo cargar la sincronizacion semantica.");
    } finally {
      setIsSyncLoading(false);
    }
  };

  useEffect(() => {
    loadSyncData();
  }, [isSyncAvailable, syncFilter]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    const allowed = await ensureWriteOperationAllowed({ actionLabel: "Guardar Contexto IA" });
    if (!allowed) return;

    setIsSaving(true);
    try {
      const updated = normalizeSettings(await contextSettingsService.update(draft));
      setSavedDraft(updated);
      setDraft(updated);
      window.dispatchEvent(new CustomEvent("knowledge-search-availability-change", {
        detail: { available: Boolean(updated.contextAiEnabled && updated.queryEnabled) },
      }));
      if (updated.contextAiEnabled && updated.syncEnabled) {
        await loadSyncData();
      }
      toastSuccess("Contexto IA actualizado", "La configuracion del modulo quedo guardada.");
    } catch (error) {
      toastError("No se pudo guardar Contexto IA", error?.message ?? "Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const runSyncAction = async (actionKey, actionLabel, handler, confirmMessage = "") => {
    const allowed = await ensureWriteOperationAllowed({ actionLabel });
    if (!allowed) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setRunningAction(actionKey);
    try {
      const result = await handler();
      toastSuccess(actionLabel, actionSummary(result));
      await loadSyncData();
    } catch (error) {
      toastError(`No se pudo ejecutar: ${actionLabel}`, error?.message ?? "Intenta nuevamente.");
    } finally {
      setRunningAction("");
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Consulta contextual"
        icon="FaSearch"
        description="Controla la disponibilidad del modulo de consulta contextual, indexacion y sincronizacion semantica."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={draft.contextAiEnabled ? "active" : "inactive"}>
              {draft.contextAiEnabled ? "Activo" : "Inactivo"}
            </StatusBadge>
            {hasChanges ? <StatusBadge tone="warning">Requiere guardar</StatusBadge> : null}
            <ActionButton
              label="Guardar"
              onClick={handleSave}
              variant="primary"
              size="sm"
              disabled={isLoading || isSaving || !hasChanges}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {SETTING_DEFINITIONS.map((item) => {
            const isChildDisabled = item.key !== "contextAiEnabled" && !draft.contextAiEnabled;
            return (
              <div
                key={item.key}
                className="flex min-h-[128px] flex-col justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`text-sm font-semibold ${TXT_TITLE}`}>{item.title}</h3>
                    <p className={`mt-2 text-sm ${TXT_BODY}`}>{item.description}</p>
                  </div>
                  <MaintenanceToggle
                    checked={Boolean(draft[item.key])}
                    disabled={isLoading || isSaving || isChildDisabled}
                    onChange={(value) => updateDraft(item.key, value)}
                  />
                </div>
                <p className={`mt-4 text-xs ${TXT_META}`}>
                  {Boolean(draft[item.key]) ? "Habilitado" : "Deshabilitado"}
                </p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Sincronizacion semantica"
        icon="FaDatabase"
        description="Supervisa Qdrant, el modelo de embeddings y los documentos pendientes de sincronizar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={isSyncAvailable ? "active" : "inactive"}>
              {isSyncAvailable ? "Operativa" : "Deshabilitada"}
            </StatusBadge>
            <ActionButton
              label="Actualizar"
              onClick={loadSyncData}
              variant="soft"
              size="sm"
              disabled={!isSyncAvailable || isSyncLoading}
            />
          </div>
        }
      >
        {!isSyncAvailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
            Activa `Modulo Contexto IA` y `Sincronizacion manual` para administrar la regeneracion del indice.
          </div>
        ) : (
          <div className="space-y-5">
            {syncError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-200">
                {syncError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SyncMetricCard
                icon="FaDatabase"
                label="Documentos"
                value={syncStatus?.totalDocuments ?? "—"}
                hint="Total registrado para consulta contextual"
              />
              <SyncMetricCard
                icon="warning"
                label="Pendientes"
                value={(syncStatus?.notIndexedDocuments ?? 0) + (syncStatus?.outdatedDocuments ?? 0)}
                hint="No indexadas o desactualizadas"
              />
              <SyncMetricCard
                icon="FaSearch"
                label="Qdrant"
                value={qdrantHealth?.ok ? "Disponible" : qdrantHealth ? "Error" : "No verificado"}
                hint={qdrantHealth?.ok ? `${qdrantHealth.collectionsCount} coleccion(es)` : qdrantHealth?.message || "Healthcheck operativo"}
              />
              <SyncMetricCard
                icon="FaBrain"
                label="Embeddings"
                value={embeddingBinding?.modelName || "Sin binding"}
                hint={embeddingProvider?.name || embeddingBinding?.providerConfigId || "Provider no configurado"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className={`text-sm font-semibold ${TXT_TITLE}`}>Documentos por estado</h3>
                    <p className={`mt-1 text-xs ${TXT_META}`}>Vista operacional para detectar minutas sin indice o con errores.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DOCUMENT_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setSyncFilter(filter.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          syncFilter === filter.id
                            ? "border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500/60 dark:bg-primary-900/30 dark:text-primary-200"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <SyncDocumentsTable
                  items={syncItems}
                  isLoading={isSyncLoading}
                  total={syncTotal}
                  onReindexMinute={(minuteId) =>
                    runSyncAction(
                      `minute:${minuteId}`,
                      "Reindexar minuta",
                      () => contextService.reindexMinute(minuteId)
                    )
                  }
                  onReindexProject={(projectId) =>
                    runSyncAction(
                      `project:${projectId}`,
                      "Reindexar proyecto",
                      () => contextService.reindexProject(projectId)
                    )
                  }
                  onReindexClient={(clientId) =>
                    runSyncAction(
                      `client:${clientId}`,
                      "Reindexar cliente",
                      () => contextService.reindexClient(clientId)
                    )
                  }
                  onCleanupMinute={(minuteId) =>
                    runSyncAction(
                      `cleanup:${minuteId}`,
                      "Limpiar minuta del indice",
                      () => contextService.cleanupMinute(minuteId),
                      "Se eliminara esta minuta del indice vectorial. Podras reindexarla nuevamente despues. ¿Continuar?"
                    )
                  }
                  runningAction={runningAction}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <h3 className={`text-sm font-semibold ${TXT_TITLE}`}>Conteos por estado</h3>
                  <div className="mt-3 grid gap-2">
                    {Object.entries(syncStatus?.byStatus ?? {}).length ? (
                      Object.entries(syncStatus.byStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                          <StatusBadge tone={SYNC_STATUS_TONES[status] ?? "inactive"}>
                            {SYNC_STATUS_LABELS[status] ?? status}
                          </StatusBadge>
                          <span className={`text-sm font-semibold ${TXT_TITLE}`}>{count}</span>
                        </div>
                      ))
                    ) : (
                      <p className={`text-sm ${TXT_META}`}>Sin documentos registrados.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <h3 className={`text-sm font-semibold ${TXT_TITLE}`}>Acciones masivas</h3>
                  <p className={`mt-1 text-xs ${TXT_META}`}>Usa estas acciones para recuperar o regenerar el indice semantico.</p>
                  <div className="mt-4 grid gap-2">
                    <ActionButton
                      label="Reintentar errores"
                      onClick={() => runSyncAction(
                        "retry",
                        "Reintentar errores",
                        contextService.retryFailedSync,
                        "Se reintentaran los jobs fallidos de consulta contextual. ¿Continuar?"
                      )}
                      variant="soft"
                      size="sm"
                      disabled={Boolean(runningAction)}
                    />
                    <ActionButton
                      label="Reindexar todo"
                      onClick={() => runSyncAction(
                        "all",
                        "Reindexar todo",
                        contextService.reindexAll,
                        "Se encolaran todas las minutas finales disponibles para reindexacion. ¿Continuar?"
                      )}
                      variant="soft"
                      size="sm"
                      disabled={Boolean(runningAction)}
                    />
                    <ActionButton
                      label="Reconciliar estados"
                      onClick={() => runSyncAction(
                        "reconcile",
                        "Reconciliar estados",
                        contextService.reconcileStatus,
                        "Se revisaran jobs y documentos de consulta contextual para corregir estados atascados. ¿Continuar?"
                      )}
                      variant="soft"
                      size="sm"
                      disabled={Boolean(runningAction)}
                    />
                    <ActionButton
                      label="Regenerar coleccion Qdrant"
                      onClick={() => runSyncAction(
                        "rebuild",
                        "Regenerar coleccion Qdrant",
                        contextService.rebuildCollection,
                        "Esta accion reconstruira la coleccion vectorial y puede requerir reindexacion completa. ¿Continuar?"
                      )}
                      variant="danger"
                      size="sm"
                      disabled={Boolean(runningAction)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

const SyncMetricCard = ({ icon, label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm dark:bg-gray-800 dark:text-primary-300">
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{label}</p>
        <p className={`mt-1 truncate text-base font-bold ${TXT_TITLE}`}>{value}</p>
        {hint ? <p className={`mt-1 truncate text-xs ${TXT_META}`}>{hint}</p> : null}
      </div>
    </div>
  </div>
);

const SyncDocumentsTable = ({
  items = [],
  isLoading = false,
  total = 0,
  onReindexMinute,
  onReindexProject,
  onReindexClient,
  onCleanupMinute,
  runningAction,
}) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/60">
          <tr className={`text-left text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>
            <th className="px-4 py-3">Minuta</th>
            <th className="px-4 py-3">Cliente / Proyecto</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Chunks</th>
            <th className="px-4 py-3">Ultima revision</th>
            <th className="px-4 py-3 text-right">Accion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {isLoading ? (
            <tr>
              <td colSpan={6} className={`px-4 py-8 text-center text-sm ${TXT_META}`}>
                Cargando documentos...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6} className={`px-4 py-8 text-center text-sm ${TXT_META}`}>
                No hay documentos para este filtro.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const minuteId = item?.minuteId ?? item?.minute_id;
              const projectId = item?.projectId ?? item?.project_id;
              const clientId = item?.clientId ?? item?.client_id;
              const actionKey = `minute:${minuteId}`;
              const cleanupActionKey = `cleanup:${minuteId}`;
              const projectActionKey = `project:${projectId}`;
              const clientActionKey = `client:${clientId}`;
              return (
                <tr key={`${minuteId}-${item?.versionId ?? item?.version_id}`} className="align-top">
                  <td className="px-4 py-3">
                    <p className={`max-w-[320px] truncate font-semibold ${TXT_TITLE}`}>{item?.title || "Sin titulo"}</p>
                    <p className={`mt-1 text-xs ${TXT_META}`}>
                      v{item?.versionNum ?? item?.version_num ?? "—"} · {minuteId}
                    </p>
                    {item?.lastError || item?.last_error ? (
                      <p className="mt-2 max-w-[320px] truncate text-xs font-medium text-red-600 dark:text-red-300">
                        {item?.lastError ?? item?.last_error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className={`max-w-[240px] truncate font-medium ${TXT_TITLE}`}>{item?.clientName ?? item?.client_name ?? "—"}</p>
                    <p className={`mt-1 max-w-[240px] truncate text-xs ${TXT_META}`}>{item?.projectName ?? item?.project_name ?? "Sin proyecto"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={SYNC_STATUS_TONES[item?.status] ?? "inactive"}>
                      {SYNC_STATUS_LABELS[item?.status] ?? item?.status ?? "—"}
                    </StatusBadge>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${TXT_TITLE}`}>{item?.chunkCount ?? item?.chunk_count ?? 0}</td>
                  <td className={`px-4 py-3 ${TXT_META}`}>
                    {formatDateTime(item?.lastCheckedAt ?? item?.last_checked_at ?? item?.indexedAt ?? item?.indexed_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <SyncIconButton
                        icon="business"
                        label={runningAction === clientActionKey ? "Encolando cliente" : "Reindexar cliente"}
                        onClick={() => onReindexClient(clientId)}
                        disabled={!clientId || Boolean(runningAction)}
                      />
                      <SyncIconButton
                        icon="folder"
                        label={runningAction === projectActionKey ? "Encolando proyecto" : "Reindexar proyecto"}
                        onClick={() => onReindexProject(projectId)}
                        disabled={!projectId || Boolean(runningAction)}
                      />
                      <SyncIconButton
                        icon="trash"
                        label={runningAction === cleanupActionKey ? "Limpiando minuta" : "Limpiar minuta del índice"}
                        onClick={() => onCleanupMinute(minuteId)}
                        disabled={!minuteId || Boolean(runningAction)}
                      />
                      <SyncIconButton
                        icon="fileLines"
                        label={runningAction === actionKey ? "Encolando minuta" : "Reindexar minuta"}
                        onClick={() => onReindexMinute(minuteId)}
                        disabled={!minuteId || Boolean(runningAction)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    <div className={`border-t border-gray-100 px-4 py-3 text-xs ${TXT_META} dark:border-gray-700`}>
      Mostrando {items.length} de {total} documentos.
    </div>
  </div>
);

const SyncIconButton = ({ icon, label, onClick, disabled }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-200"
  >
    <Icon name={icon} className="h-3.5 w-3.5" />
  </button>
);

export default KnowledgePanel;
