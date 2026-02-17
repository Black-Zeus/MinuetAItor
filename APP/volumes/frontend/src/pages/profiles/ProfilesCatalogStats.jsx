/**
 * ProfilesCatalogStats.jsx
 * Fix: si value es null/undefined/"" => mostrar 0
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const toNumberOrZero = (v) => {
  // null/undefined => 0
  if (v == null) return 0;

  // "" o "   " => 0
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return 0;

    // "12" => 12, "12.5" => 12.5, "12,5" => 12.5
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  // number => si es finito, ok; si no => 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  // boolean => 1/0 (por si llega)
  if (typeof v === "boolean") return v ? 1 : 0;

  // otros => intenta convertir
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const StatsCard = ({ icon, label, value, color }) => {
  const colorClasses = {
    primary: "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400",
    green:   "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    gray:    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
    purple:  "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  };

  const safeValue = toNumberOrZero(value);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-theme">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${TXT_META}`}>{label}</p>
          <p className={`text-2xl font-bold ${TXT_TITLE} mt-1 transition-theme`}>{safeValue}</p>
        </div>

        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const ProfilesCatalogStats = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <StatsCard icon="FaLayerGroup"  label="Total Perfiles" value={stats?.total}      color="primary" />
      <StatsCard icon="FaCheckCircle" label="Activos"        value={stats?.active}     color="green" />
      <StatsCard icon="FaTimesCircle" label="Inactivos"      value={stats?.inactive}   color="gray" />
      <StatsCard icon="FaTerminal"    label="Con Prompt"     value={stats?.withPrompt} color="purple" />
    </div>
  );
};

export default ProfilesCatalogStats;