import React, { useState } from "react";

import ModalManager from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import {
  ConfigActionBar,
  CronInputField,
  DraftModeNotice,
  INITIAL_MAINTENANCE_DRAFT,
  MaintenanceField,
  MaintenanceInput,
  MaintenanceSelect,
  MaintenanceToggle,
  SectionCard,
  StatusBadge,
  TXT_BODY,
  TXT_META,
  TXT_TITLE,
  openCronPlannerModal,
  validateCronExpression,
} from "@/pages/system/SystemSettingsShared";

export const MaintenancePanel = () => {
  const [draft, setDraft] = useState(INITIAL_MAINTENANCE_DRAFT);
  const [savedDraft, setSavedDraft] = useState(INITIAL_MAINTENANCE_DRAFT);
  const [cronErrors, setCronErrors] = useState({});

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (key.endsWith("Cron") && cronErrors[key]) {
      const validation = validateCronExpression(value);
      setCronErrors((prev) => ({
        ...prev,
        [key]: validation.isValid ? "" : validation.message,
      }));
    }
  };

  const validateCronKey = (key, rawValue = draft[key]) => {
    const validation = validateCronExpression(rawValue);
    if (validation.normalizedValue && validation.normalizedValue !== rawValue) {
      setDraft((prev) => ({ ...prev, [key]: validation.normalizedValue }));
    }
    setCronErrors((prev) => ({
      ...prev,
      [key]: validation.isValid ? "" : validation.message,
    }));
    return validation;
  };

  const openCronPlanner = (key, title) => {
    openCronPlannerModal({
      modalTitle: title,
      currentValue: draft[key],
      ModalManager,
      onSelect: (cronValue) => {
        updateDraft(key, cronValue);
        setCronErrors((prev) => ({ ...prev, [key]: "" }));
        ModalManager.closeAll();
      },
    });
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const handleDiscard = () => {
    setDraft(savedDraft);
    setCronErrors({});
  };

  const handleSave = async () => {
    const cronKeys = ["sessionCleanupCron", "tempCleanupCron"];
    const invalidEntries = cronKeys
      .map((key) => [key, validateCronKey(key, draft[key])])
      .filter(([, validation]) => !validation.isValid);

    if (invalidEntries.length) {
      toastError("Programación inválida", "Revisa los campos de programación antes de guardar.");
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: "Guardar cambios de mantenimiento",
      message: "¿Deseas guardar la configuración de mantenimiento? Los cambios del borrador pasarán a ser la versión activa de esta pantalla.",
      confirmText: "Guardar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    setSavedDraft(draft);
    toastSuccess("Mantenimiento actualizado", "La configuración de mantenimiento fue aplicada.");
  };

  const maintenanceSummaryItems = [
    {
      key: "summary-sessions",
      title: "Limpieza de sesiones",
      tone: savedDraft.sessionCleanupEnabled ? "active" : "inactive",
      status: savedDraft.sessionCleanupEnabled ? "Habilitada" : "Deshabilitada",
      details: [
        { label: "Frecuencia", value: savedDraft.sessionCleanupCron || "—" },
        {
          label: "Estrategia",
          value:
            savedDraft.sessionCleanupMode === "soft_logout"
              ? "Marcar logout técnico"
              : savedDraft.sessionCleanupMode === "revoke_idle"
                ? "Revocar sesiones inactivas"
                : "Solo registrar hallazgos",
        },
      ],
    },
    {
      key: "summary-temp",
      title: "Limpieza de temporales",
      tone: savedDraft.tempCleanupEnabled ? "active" : "inactive",
      status: savedDraft.tempCleanupEnabled ? "Habilitada" : "Deshabilitada",
      details: [
        { label: "Frecuencia", value: savedDraft.tempCleanupCron || "—" },
        { label: "Retención", value: `${savedDraft.tempCleanupMaxAgeDays} días` },
      ],
    },
    {
      key: "summary-queues",
      title: "Observabilidad de colas",
      tone: savedDraft.monitorMaintenanceQueueEnabled || savedDraft.monitorDlqEnabled ? "info" : "inactive",
      status:
        savedDraft.monitorMaintenanceQueueEnabled || savedDraft.monitorDlqEnabled
          ? "Monitoreo visible"
          : "Monitoreo oculto",
      details: [
        {
          label: "queue:maintenance",
          value: savedDraft.monitorMaintenanceQueueEnabled
            ? `Umbral ${savedDraft.maintenanceQueueWarningThreshold}`
            : "Deshabilitado",
        },
        {
          label: "queue:dlq",
          value: savedDraft.monitorDlqEnabled ? `Umbral ${savedDraft.dlqWarningThreshold}` : "Deshabilitado",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {hasChanges ? <DraftModeNotice /> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Rutinas de limpieza"
          icon="FaFilter"
          description="Define la limpieza de sesiones registradas y archivos temporales del sistema."
        >
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Limpieza de sesiones</h3>
                    <StatusBadge tone={draft.sessionCleanupEnabled ? "active" : "inactive"}>
                      {draft.sessionCleanupEnabled ? "Habilitada" : "Deshabilitada"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Controla la limpieza de sesiones registradas y su tratamiento operativo.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.sessionCleanupEnabled}
                  onChange={(value) => updateDraft("sessionCleanupEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Frecuencia" hint="Programación de la tarea">
                  <CronInputField
                    value={draft.sessionCleanupCron}
                    onChange={(event) => updateDraft("sessionCleanupCron", event.target.value)}
                    onBlur={() => validateCronKey("sessionCleanupCron")}
                    onOpenPlanner={() => openCronPlanner("sessionCleanupCron", "Programación de limpieza de sesiones")}
                    placeholder="0 * * * *"
                    errorMessage={cronErrors.sessionCleanupCron}
                  />
                </MaintenanceField>
                <MaintenanceField label="Estrategia" hint="Qué acción conceptual debería aplicar la rutina">
                  <MaintenanceSelect
                    value={draft.sessionCleanupMode}
                    onChange={(event) => updateDraft("sessionCleanupMode", event.target.value)}
                  >
                    <option value="soft_logout">Marcar logout técnico</option>
                    <option value="revoke_idle">Revocar sesiones inactivas</option>
                    <option value="archive_only">Solo registrar hallazgos</option>
                  </MaintenanceSelect>
                </MaintenanceField>
              </div>
            </div>

            <div className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Limpieza de archivos temporales</h3>
                    <StatusBadge tone={draft.tempCleanupEnabled ? "active" : "inactive"}>
                      {draft.tempCleanupEnabled ? "Habilitada" : "Deshabilitada"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Controla la limpieza de archivos temporales y trazas generadas por procesamiento.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.tempCleanupEnabled}
                  onChange={(value) => updateDraft("tempCleanupEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Frecuencia" hint="Programación de la tarea">
                  <CronInputField
                    value={draft.tempCleanupCron}
                    onChange={(event) => updateDraft("tempCleanupCron", event.target.value)}
                    onBlur={() => validateCronKey("tempCleanupCron")}
                    onOpenPlanner={() => openCronPlanner("tempCleanupCron", "Programación de limpieza de temporales")}
                    placeholder="0 3 * * *"
                    errorMessage={cronErrors.tempCleanupCron}
                  />
                </MaintenanceField>
                <MaintenanceField label="Retención" hint="Días antes de limpiar">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="90"
                    value={draft.tempCleanupMaxAgeDays}
                    onChange={(event) => updateDraft("tempCleanupMaxAgeDays", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Observabilidad Técnica"
          icon="FaServer"
          description="Define alertas visuales para queue:maintenance y queue:dlq."
        >
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de queue:maintenance</h3>
                    <StatusBadge tone={draft.monitorMaintenanceQueueEnabled ? "info" : "inactive"}>
                      {draft.monitorMaintenanceQueueEnabled ? "Visible" : "Oculto"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Muestra alertas cuando se acumulan jobs en la cola de mantenimiento.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorMaintenanceQueueEnabled}
                  onChange={(value) => updateDraft("monitorMaintenanceQueueEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs acumulados antes de mostrar alerta">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.maintenanceQueueWarningThreshold}
                    onChange={(event) => updateDraft("maintenanceQueueWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:maintenance" disabled />
                </MaintenanceField>
              </div>
            </div>

            <div className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Monitoreo de DLQ</h3>
                    <StatusBadge tone={draft.monitorDlqEnabled ? "danger" : "inactive"}>
                      {draft.monitorDlqEnabled ? "Prioritario" : "Oculto"}
                    </StatusBadge>
                  </div>
                  <p className={`mt-2 text-sm ${TXT_BODY}`}>
                    Muestra alertas para jobs fallidos enviados a la cola DLQ.
                  </p>
                </div>
                <MaintenanceToggle
                  checked={draft.monitorDlqEnabled}
                  onChange={(value) => updateDraft("monitorDlqEnabled", value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <MaintenanceField label="Umbral de advertencia" hint="Cantidad de jobs fallidos para elevar señal">
                  <MaintenanceInput
                    type="number"
                    min="1"
                    max="500"
                    value={draft.dlqWarningThreshold}
                    onChange={(event) => updateDraft("dlqWarningThreshold", Number(event.target.value || 0))}
                  />
                </MaintenanceField>
                <MaintenanceField label="Cola monitoreada" hint="Origen observado">
                  <MaintenanceInput value="Redis list: queue:dlq" disabled />
                </MaintenanceField>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Resumen de configuración"
        icon="FaClockRotateLeft"
        description="Vista rápida de lo que quedó definido actualmente en esta pantalla."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {maintenanceSummaryItems.map((item) => (
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

      <ConfigActionBar
        hasChanges={hasChanges}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
};
