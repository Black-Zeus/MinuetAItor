import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const CARD_STYLES = [
  { label: "Total", icon: "FaUsers", tone: "text-primary-600 dark:text-primary-300" },
  { label: "Activos", icon: "FaUserCheck", tone: "text-green-600 dark:text-green-300" },
  { label: "Inactivos", icon: "FaUserSlash", tone: "text-gray-600 dark:text-gray-300" },
  { label: "Con email", icon: "FaEnvelope", tone: "text-amber-600 dark:text-amber-300" },
];

const ParticipantsStats = ({ stats }) => {
  const values = [stats.total, stats.active, stats.inactive, stats.withEmail];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {CARD_STYLES.map((item, index) => (
        <div
          key={item.label}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{values[index] ?? 0}</p>
            </div>
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ${item.tone}`}>
              <Icon name={item.icon} className="w-5 h-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ParticipantsStats;
