import React from "react";

import { MODULE_VIEW_OPTIONS } from "@/utils/moduleViews";

const ModuleViewSwitcher = ({ value = "base", onChange, options = MODULE_VIEW_OPTIONS }) => {
  return (
    <div className="inline-flex rounded-2xl border border-secondary-200 bg-white p-1 shadow-sm dark:border-secondary-700/60 dark:bg-slate-900/70">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange?.(option.id)}
            className={[
              "rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm",
              active
                ? "bg-primary-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-slate-800 dark:hover:text-white",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default ModuleViewSwitcher;
