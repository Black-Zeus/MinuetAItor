import React from "react";
import {
  FaBuilding,
  FaLayerGroup,
  FaUsers,
  FaClock,
  FaCheckCircle,
  FaHourglassHalf,
} from "react-icons/fa";
import { TXT_BODY, TXT_META, TXT_TITLE } from "./Dashboard";

const MinuteItem = ({ minute, onClick }) => {
  const statusConfig = {
    completed: {
      label: "Completada",
      color: "bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-200",
      icon: FaCheckCircle,
    },
    pending_review: {
      label: "En Revisión",
      color: "bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-200",
      icon: FaHourglassHalf,
    },
  };

  const status = statusConfig[minute.status] ?? statusConfig.pending_review;
  const StatusIcon = status.icon;

  return (
    <div
      className="p-6 hover:bg-secondary-50 dark:hover:bg-gray-800/40 transition-theme cursor-pointer"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-base font-semibold ${TXT_TITLE} truncate`}>{minute.title}</h3>

            <span className={`px-3 py-1.5 text-xs font-medium rounded-2xl inline-flex items-center gap-1 ${status.color} transition-theme`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>

          <div className={`flex flex-wrap items-center gap-3 text-sm ${TXT_BODY} transition-theme`}>
            <span className="flex items-center gap-1">
              <FaBuilding className="w-3 h-3" />
              {minute.client}
            </span>
            <span className="flex items-center gap-1">
              <FaLayerGroup className="w-3 h-3" />
              {minute.project}
            </span>
            <span className="flex items-center gap-1">
              <FaUsers className="w-3 h-3" />
              {minute.participants}
            </span>
            <span className="flex items-center gap-1">
              <FaClock className="w-3 h-3" />
              {minute.duration}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {(minute.tags ?? []).slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 text-xs rounded-2xl transition-theme"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className={`text-xs ${TXT_META} transition-theme`}>{minute.id}</p>
          <p className={`text-xs ${TXT_META} mt-1 transition-theme`}>
            {new Date(minute.date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MinuteItem;
