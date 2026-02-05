import React from "react";
import SectionCard from "./SectionCard";
import MinuteItem from "./MinuteItem";
import { TXT_SUBTITLE } from "./Dashboard";
import ActionButton from "@/components/ui/button/ActionButton";

const DIVIDER_FRAME = "divide-y divide-secondary-200 dark:divide-secondary-700/60";

const RecentMinutesList = ({ minutes = [], onViewAll, onSelectMinute }) => {
    return (
        <SectionCard
            title="Minutas Recientes"
            action={
                <ActionButton
                    type="button"
                    onClick={onViewAll}
                    label="Ver todas"
                    variant="soft"
                    size="xs"
                    className={`transition-theme ${TXT_SUBTITLE}`}
                />
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
