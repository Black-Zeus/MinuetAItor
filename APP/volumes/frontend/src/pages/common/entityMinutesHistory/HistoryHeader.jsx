import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import EntityLogo from "./EntityLogo";
import { cn } from "./utils";

const HistoryHeader = ({ entity, type, total, onBack }) => (
  <header className="border-b border-gray-200 pb-4 transition-theme dark:border-gray-800">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <EntityLogo entity={entity} type={type} />
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            Historial de minutas
          </div>
          <h3 className="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-white">
            {entity.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Icon name={type === "all" ? "history" : type === "project" ? "FaBuilding" : type === "participant" ? "FaEnvelope" : "FaIndustry"} className="text-xs" />
              {entity.subtitle}
            </span>
            {entity.description ? (
              <span className="max-w-xl truncate text-sm text-gray-500 dark:text-gray-400">
                {entity.description}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            entity.badge === "Activo"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
          )}
        >
          {entity.badge}
        </span>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {total} minutas
        </span>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name="arrowLeft" className="text-xs" />
          Volver
        </button>
      </div>
    </div>
  </header>
);

export default HistoryHeader;
