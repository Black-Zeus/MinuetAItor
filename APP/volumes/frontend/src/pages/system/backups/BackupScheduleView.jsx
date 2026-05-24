import React from "react";

import CollapsibleSection from "@/components/common/CollapsibleSection";
import {
  BACKUP_DESTINATION_LABELS,
  BACKUP_POLICY_DEFINITIONS,
  BACKUP_STORAGE_ROOT_CONTAINER,
  BACKUP_VERIFICATION_LABELS,
  BACKUP_VERIFICATION_OPTIONS,
  ConfigActionBar,
  CronInputField,
  MaintenanceField,
  MaintenanceInput,
  MaintenanceSelect,
  MaintenanceToggle,
  StatusBadge,
  TXT_BODY,
  TXT_TITLE,
} from "@/pages/system/SystemSettingsShared";

export const BackupScheduleView = ({
  cronErrors,
  draft,
  expandedScheduleSections,
  hasChanges,
  onDiscard,
  onOpenPolicyCronPlanner,
  onSave,
  onToggleSection,
  onUpdateDraft,
  onUpdatePolicyDraft,
  onValidatePolicyCron,
}) => (
  <>
    <div className="space-y-6">
      {BACKUP_POLICY_DEFINITIONS.map((policyDefinition) => {
        const policy = draft.policies[policyDefinition.id];
        const verificationLabel = BACKUP_VERIFICATION_LABELS[policy.verificationMode] ?? policy.verificationMode;
        return (
          <CollapsibleSection
            key={policyDefinition.id}
            title={`Política ${policyDefinition.shortLabel} · ${policyDefinition.title}`}
            subtitle={policyDefinition.description}
            icon={policyDefinition.icon}
            isOpen={expandedScheduleSections[policyDefinition.id] ?? false}
            onToggle={() => onToggleSection(policyDefinition.id)}
          >
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              <div className="pb-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{policyDefinition.title}</h3>
                      <StatusBadge tone={policy.enabled ? "active" : "inactive"}>
                        {policy.enabled ? "Programado" : "Detenido"}
                      </StatusBadge>
                    </div>
                    <p className={`mt-2 text-sm ${TXT_BODY}`}>
                      Permite decidir qué se respalda y en qué horario, sin obligar a ejecutar todo junto.
                    </p>
                  </div>
                  <MaintenanceToggle
                    checked={policy.enabled}
                    onChange={(value) => onUpdatePolicyDraft(policyDefinition.id, "enabled", value)}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <MaintenanceField label="Frecuencia" hint="Programación del respaldo">
                    <CronInputField
                      value={policy.cron}
                      onChange={(event) => onUpdatePolicyDraft(policyDefinition.id, "cron", event.target.value)}
                      onBlur={() => onValidatePolicyCron(policyDefinition.id)}
                      onOpenPlanner={() => onOpenPolicyCronPlanner(policyDefinition.id, `Programación de ${policyDefinition.title.toLowerCase()}`)}
                      placeholder="0 2 * * *"
                      errorMessage={cronErrors[`${policyDefinition.id}.cron`]}
                    />
                  </MaintenanceField>
                  <MaintenanceField label="Almacenamiento" hint="Siempre se guarda en el destino de respaldos">
                    <MaintenanceInput
                      value={BACKUP_DESTINATION_LABELS[policy.destination] ?? policy.destination}
                      disabled
                    />
                  </MaintenanceField>
                  <MaintenanceField label="Formato" hint="Archivo generado por esta política">
                    <MaintenanceSelect
                      value={policy.fileFormat}
                      onChange={(event) => onUpdatePolicyDraft(policyDefinition.id, "fileFormat", event.target.value)}
                    >
                      {policyDefinition.formatOptions.map((option) => (
                        <option key={`${policyDefinition.id}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </MaintenanceSelect>
                  </MaintenanceField>
                  <MaintenanceField label="Ruta backend" hint="Subcarpeta final dentro del volumen compartido">
                    <MaintenanceInput
                      value={policy.pathPrefix}
                      onChange={(event) => onUpdatePolicyDraft(policyDefinition.id, "pathPrefix", event.target.value)}
                      placeholder={`${BACKUP_STORAGE_ROOT_CONTAINER}/${policyDefinition.id}`}
                    />
                  </MaintenanceField>
                </div>
              </div>

              <div className="py-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Control posterior</h3>
                      <StatusBadge tone={policy.verificationMode === "none" ? "inactive" : "info"}>
                        {verificationLabel}
                      </StatusBadge>
                    </div>
                    <p className={`mt-2 text-sm ${TXT_BODY}`}>
                      Define qué revisar al terminar el respaldo y deja explícito el canal técnico que lo procesa.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    <MaintenanceField label="Verificación" hint="Chequeo automático posterior a la ejecución">
                      <MaintenanceSelect
                        value={policy.verificationMode}
                        onChange={(event) => onUpdatePolicyDraft(policyDefinition.id, "verificationMode", event.target.value)}
                      >
                        {BACKUP_VERIFICATION_OPTIONS.map((option) => (
                          <option key={`${policyDefinition.id}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </MaintenanceSelect>
                    </MaintenanceField>
                    <MaintenanceField label="Origen" hint="Ámbito cubierto por esta política">
                      <MaintenanceInput value={policyDefinition.source} disabled />
                    </MaintenanceField>
                    <MaintenanceField label="Cola técnica" hint="Canal previsto para ejecutar la política">
                      <MaintenanceInput value={policyDefinition.queue} disabled />
                    </MaintenanceField>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className={`text-base font-semibold ${TXT_TITLE}`}>Notificación por correo</h3>
                      <StatusBadge tone={policy.notifyByEmail ? "info" : "inactive"}>
                        {policy.notifyByEmail ? "Activa" : "No enviar"}
                      </StatusBadge>
                    </div>
                    <p className={`mt-2 text-sm ${TXT_BODY}`}>
                      Si está activa, se enviará un aviso al terminar el respaldo o su verificación asociada.
                    </p>
                  </div>
                  <MaintenanceToggle
                    checked={policy.notifyByEmail}
                    onChange={(value) => onUpdatePolicyDraft(policyDefinition.id, "notifyByEmail", value)}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <MaintenanceField label="Nombre destinatario" hint="Persona o alias que recibirá el aviso">
                    <MaintenanceInput
                      value={policy.notifyRecipientName}
                      onChange={(event) => onUpdatePolicyDraft(policyDefinition.id, "notifyRecipientName", event.target.value)}
                      placeholder="Operaciones"
                      disabled={!policy.notifyByEmail}
                    />
                  </MaintenanceField>
                  <MaintenanceField label="Correo destinatario" hint="Correo usado para la notificación">
                    <MaintenanceInput
                      type="email"
                      value={policy.notifyRecipientEmail}
                      onChange={(event) => onUpdatePolicyDraft(policyDefinition.id, "notifyRecipientEmail", event.target.value)}
                      placeholder="operaciones@empresa.com"
                      disabled={!policy.notifyByEmail}
                    />
                  </MaintenanceField>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        );
      })}

      <CollapsibleSection
        title="Conservación común"
        subtitle="La retención se aplica igual a todos los respaldos almacenados en la carpeta compartida del backend."
        icon="FaShield"
        isOpen={expandedScheduleSections.retention ?? false}
        onToggle={() => onToggleSection("retention")}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <MaintenanceField label="Retención" hint="Mismos días para BD, Adjuntos y Full">
              <MaintenanceInput
                type="number"
                min="1"
                max="365"
                value={draft.backupRetentionDays}
                onChange={(event) => onUpdateDraft("backupRetentionDays", Number(event.target.value || 0))}
              />
            </MaintenanceField>
            <MaintenanceField label="Historial" hint="Visibilidad operativa del historial">
              <MaintenanceSelect
                value={draft.backupHistoryVisible ? "visible" : "hidden"}
                onChange={(event) => onUpdateDraft("backupHistoryVisible", event.target.value === "visible")}
              >
                <option value="visible">Visible</option>
                <option value="hidden">Oculto</option>
              </MaintenanceSelect>
            </MaintenanceField>
            <MaintenanceField label="Purge interno" hint="Tarea silenciosa de mantenimiento">
              <MaintenanceInput value={draft.backupPurgeQueue} disabled />
            </MaintenanceField>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50/70 px-5 py-4 dark:border-gray-700 dark:bg-slate-900/30">
            <p className={`text-sm ${TXT_BODY}`}>
              Los paquetes con más de {draft.backupRetentionDays} días serán eliminados automáticamente por una tarea interna de mantenimiento.
            </p>
          </div>
        </div>
      </CollapsibleSection>
    </div>

    <ConfigActionBar
      hasChanges={hasChanges}
      onDiscard={onDiscard}
      onSave={onSave}
    />
  </>
);
