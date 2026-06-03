import React from "react";

import { FILTER_TEXT, HISTORY_FILTER_LABELS } from "./constants";

const HistoryFilterDropdown = ({ visibleFilters, onToggleVisibility, onClose }) => (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div className="absolute right-0 top-full z-50 mt-2 min-w-[250px] rounded-2xl border border-secondary-200 bg-white p-4 shadow-dropdown transition-theme dark:border-secondary-700 dark:bg-gray-800">
      {Object.keys(visibleFilters).map((filterKey) => (
        <div
          key={filterKey}
          className="flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-theme hover:bg-secondary-50 dark:hover:bg-gray-700/50"
          onClick={() => onToggleVisibility(filterKey)}
        >
          <input
            type="checkbox"
            checked={visibleFilters[filterKey]}
            onChange={() => {}}
            className="h-4 w-4 cursor-pointer accent-primary-500"
          />
          <label className={`flex-1 cursor-pointer text-sm ${FILTER_TEXT} transition-theme`}>
            {HISTORY_FILTER_LABELS[filterKey] ?? filterKey}
          </label>
        </div>
      ))}
    </div>
  </>
);

export default HistoryFilterDropdown;
