import React from "react";
import { TXT_TITLE } from "./Dashboard";

const CARD_FRAME =
  "border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5";

const SectionCard = ({ title, action, children }) => {
  const isStringTitle = typeof title === "string";

  return (
    <div className={`bg-surface shadow-card overflow-hidden transition-theme ${CARD_FRAME} rounded-2xl`}>
      <div className="p-6 flex items-center justify-between gap-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
        {isStringTitle ? (
          <h2 className={`text-2xl font-semibold ${TXT_TITLE} transition-theme`}>{title}</h2>
        ) : (
          <h2 className={`text-lg font-semibold ${TXT_TITLE} transition-theme`}>{title}</h2>
        )}

        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>

      {children}
    </div>
  );
};

export default SectionCard;
