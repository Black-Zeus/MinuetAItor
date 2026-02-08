// src/pages/minutes/components/MinutesResults.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META = "text-gray-500 dark:text-gray-400";

const MinutesResults = ({ count }) => {
  return (
    <div className="flex justify-start items-center px-2 py-4 mb-4">
      <div className={`text-sm ${TXT_META} flex items-center gap-2 transition-theme`}>
        <Icon name="listCheck" />
        Mostrando{" "}
        <strong className={`${TXT_TITLE} font-semibold transition-theme`}>
          {count} minutas
        </strong>
      </div>
    </div>
  );
};

export default MinutesResults;