import React from "react";

import Icon from "@/components/ui/icon/iconManager";

const CARD_STYLES = [
  { key: "total", label: "Total", icon: "FaFileAlt", tone: "text-primary-600 dark:text-primary-300" },
  { key: "completed", label: "Completadas", icon: "FaCheckCircle", tone: "text-green-600 dark:text-green-300" },
  { key: "inProgress", label: "En proceso", icon: "spinner", tone: "text-sky-600 dark:text-sky-300" },
  { key: "withPdf", label: "Con PDF", icon: "fileLines", tone: "text-amber-600 dark:text-amber-300" },
];

const HistoryStats = ({ stats }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    {CARD_STYLES.map((item) => (
      <div
        key={item.key}
        className="rounded-xl border border-gray-200 bg-white p-5 transition-theme dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats?.[item.key] ?? 0}</p>
          </div>
          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ${item.tone}`}>
            <Icon name={item.icon} className={item.icon === "spinner" ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default HistoryStats;
