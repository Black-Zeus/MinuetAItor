import React from "react";

import Icon from "@/components/ui/icon/iconManager";

const SortableTableHeader = ({ label, sortKey, activeSortKey, direction = "asc", onSort }) => {
  const isActive = activeSortKey === sortKey;
  const upClassName = isActive && direction === "asc"
    ? "text-primary-600 dark:text-primary-300"
    : "text-gray-300 dark:text-gray-600";
  const downClassName = isActive && direction === "desc"
    ? "text-primary-600 dark:text-primary-300"
    : "text-gray-300 dark:text-gray-600";

  return (
    <button
      type="button"
      onClick={() => onSort?.(sortKey)}
      className="flex w-full items-center justify-between gap-3 text-left transition-colors hover:text-gray-700 dark:hover:text-gray-200"
    >
      <span className="truncate">{label}</span>
      <span className="inline-flex shrink-0 flex-col items-center justify-center leading-none">
        <Icon name="chevronUp" className={`h-2.5 w-2.5 ${upClassName}`} />
        <Icon name="chevronDown" className={`-mt-0.5 h-2.5 w-2.5 ${downClassName}`} />
      </span>
    </button>
  );
};

export default SortableTableHeader;
