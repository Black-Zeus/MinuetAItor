import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import { TXT_META, TXT_TITLE } from "@/pages/system/SystemSettingsShared";

const BACKUP_PANEL_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "FaGaugeHigh",
    description: "Resumen ejecutivo de cobertura, retención, último respaldo y señales rápidas del módulo.",
  },
  {
    id: "schedule",
    label: "Programación",
    icon: "FaClockRotateLeft",
    description: "Define qué se respalda, cuándo se ejecuta, dónde se almacena y cómo se verifica.",
  },
  {
    id: "history",
    label: "Historial",
    icon: "FaDatabase",
    description: "Consulta los paquetes disponibles, sus estados, tamaños, rutas y acciones no destructivas.",
  },
  {
    id: "recovery",
    label: "Recuperación",
    icon: "FaFolderOpen",
    description: "Aísla las acciones sensibles para restaurar respaldos existentes o importar paquetes externos.",
  },
  {
    id: "technical",
    label: "Estado técnico",
    icon: "FaServer",
    description: "Revisa colas, rutas internas, verificación y referencias técnicas asociadas a la ejecución.",
  },
];

export const BackupsPanelTabs = ({ activeTab, onTabChange }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Vista de respaldos</p>
      <p className={`mt-1 max-w-3xl text-sm ${TXT_TITLE}`}>
        {BACKUP_PANEL_TABS.find((tab) => tab.id === activeTab)?.description}
      </p>
    </div>

    <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-slate-50 p-1 dark:border-gray-700 dark:bg-slate-900/40">
      {BACKUP_PANEL_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={[
              "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
              isActive
                ? "bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300"
                : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-white",
            ].join(" ")}
          >
            <Icon name={tab.icon} className="h-4 w-4 flex-shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
