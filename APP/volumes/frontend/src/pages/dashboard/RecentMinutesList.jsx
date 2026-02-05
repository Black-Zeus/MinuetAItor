import React from "react";
import SectionCard from "./SectionCard";
import MinuteItem from "./MinuteItem";
import { TXT_SUBTITLE } from "./Dashboard";

const DIVIDER_FRAME = "divide-y divide-secondary-200 dark:divide-secondary-700/60";

const RecentMinutesList = ({ minutes = [], onViewAll, onSelectMinute }) => {
  return (
    <SectionCard
      title="Minutas Recientes"
      action={
        <button
          type="button"
          onClick={onViewAll}
          className={`px-4 py-2 text-sm rounded-2xl border border-gray-200 dark:border-gray-700
                      bg-white/60 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800/40
                      transition-theme ${TXT_SUBTITLE}`}
        >
          Ver todas
        </button>
      }
    >
      <div className={DIVIDER_FRAME}>
        {minutes.map((minute) => (
          <MinuteItem key={minute.id} minute={minute} onClick={() => onSelectMinute?.(minute)} />
        ))}
      </div>
    </SectionCard>
  );
};

export default RecentMinutesList;
