import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import { cn } from "./utils";

const HistoryActionButton = ({ icon, label, onClick, tone = "default", disabled = false }) => {
  const toneClass = {
    default:
      "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-300",
    success:
      "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        toneClass[tone] ?? toneClass.default
      )}
    >
      <Icon name={icon} className="text-[11px]" />
      {label}
    </button>
  );
};

export default HistoryActionButton;
