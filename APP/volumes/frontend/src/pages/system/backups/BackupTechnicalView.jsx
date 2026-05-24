import React from "react";

import {
  BACKUP_POLICY_DEFINITIONS,
  BACKUP_VERIFICATION_LABELS,
  MaintenanceField,
  MaintenanceInput,
  SectionCard,
  StatusBadge,
  TXT_TITLE,
} from "@/pages/system/SystemSettingsShared";

export const BackupTechnicalView = ({ savedDraft }) => (
  <SectionCard
    title="Canales técnicos"
    icon="FaServer"
    description="Vista de diagnóstico para colas, handlers previstos y rutas de almacenamiento del módulo."
  >
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {BACKUP_POLICY_DEFINITIONS.map((policyDefinition) => {
        const policy = savedDraft.policies[policyDefinition.id];
        return (
          <div
            key={`technical-${policyDefinition.id}`}
            className="rounded-2xl border border-gray-200 bg-slate-50/80 p-5 dark:border-gray-700 dark:bg-slate-900/40"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{policyDefinition.title}</h3>
              <StatusBadge tone={policy.enabled ? "active" : "inactive"}>
                {policy.enabled ? "Activo" : "Detenido"}
              </StatusBadge>
            </div>
            <div className="mt-5 space-y-3">
              <MaintenanceField label="Cola" hint="">
                <MaintenanceInput value={policyDefinition.queue} disabled />
              </MaintenanceField>
              <MaintenanceField label="Ruta backend" hint="">
                <MaintenanceInput value={policy.pathPrefix} disabled />
              </MaintenanceField>
              <MaintenanceField label="Verificación" hint="">
                <MaintenanceInput value={BACKUP_VERIFICATION_LABELS[policy.verificationMode] ?? policy.verificationMode} disabled />
              </MaintenanceField>
            </div>
          </div>
        );
      })}
    </div>
  </SectionCard>
);
