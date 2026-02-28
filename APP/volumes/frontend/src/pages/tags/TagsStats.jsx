/**
 * TagsStats.jsx
 * Estadísticas de Tags — recibe prop `stats` del padre (Tags.jsx)
 * Patrón: ProjectStats / ClientStats / TeamsStats
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const StatsCard = ({ icon, label, value, color }) => {
  const colorClasses = {
    primary: "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400",
    green:   "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    gray:    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
    purple:  "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-theme">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${TXT_META}`}>{label}</p>
          <p className={`text-2xl font-bold ${TXT_TITLE} mt-1 transition-theme`}>
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.primary}`}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const TagsStats = ({ stats = {} }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatsCard
        icon="FaTags"
        label="Total Tags"
        value={stats.total ?? 0}
        color="primary"
      />
      <StatsCard
        icon="FaCheckCircle"
        label="Activos"
        value={stats.activos ?? 0}
        color="green"
      />
      <StatsCard
        icon="FaPauseCircle"
        label="Inactivos"
        value={stats.inactivos ?? 0}
        color="gray"
      />
      <StatsCard
        icon="FaLayerGroup"
        label="Categorías"
        value={stats.totalCategorias ?? 0}
        color="purple"
      />
    </div>
  );
};

export default TagsStats;