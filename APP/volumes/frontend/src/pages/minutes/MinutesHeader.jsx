// src/pages/minutes/components/MinutesHeader.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import NewMinute from "@/components/ui/button/newMinute";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META = "text-gray-500 dark:text-gray-400";

const MinutesHeader = () => {
  return (
    <div className="bg-surface shadow-card rounded-2xl p-6 md:p-8 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 mb-2 transition-theme`}>
            <Icon name="fileLines" className="text-primary-500 dark:text-primary-400" />
            Minutas
          </h1>
          <p className={`text-base ${TXT_META} transition-theme`}>
            Gestiona y organiza todas tus minutas de reuniones
          </p>
        </div>
        <NewMinute />
      </div>
    </div>
  );
};

export default MinutesHeader;