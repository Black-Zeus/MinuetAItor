import React, { useEffect, useMemo, useState } from "react";

import CollapsibleSection from "@/components/common/CollapsibleSection";

import MinuteCard from "./MinuteCard";

const groupByClient = (minutes) => {
  const map = new Map();

  (minutes ?? []).forEach((minute) => {
    const key = String(minute?.client_id || minute?.client || "without-client");
    const label = String(minute?.client || "Sin cliente asignado");
    if (!map.has(key)) {
      map.set(key, { key, label, items: [] });
    }
    map.get(key).items.push(minute);
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
};

const MinutesGroupedByClient = ({ minutes = [], onStatusChange, onReprocess, isRefreshing = false }) => {
  const groups = useMemo(() => groupByClient(minutes), [minutes]);
  const [expandedByClient, setExpandedByClient] = useState({});

  useEffect(() => {
    setExpandedByClient((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (typeof next[group.key] !== "boolean") {
          next[group.key] = true;
        }
      });
      return next;
    });
  }, [groups]);

  const toggleGroup = (groupKey) => {
    setExpandedByClient((prev) => ({ ...prev, [groupKey]: !(prev[groupKey] ?? true) }));
  };

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
      {groups.map((group) => (
        <CollapsibleSection
          key={group.key}
          title={group.label}
          subtitle={group.items.length === 1 ? "1 minuta asociada" : `${group.items.length} minutas asociadas`}
          icon="business"
          count={group.items.length}
          isOpen={expandedByClient[group.key] ?? true}
          onToggle={() => toggleGroup(group.key)}
          className="overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {group.items.map((minute) => (
              <MinuteCard
                key={minute.id}
                minute={minute}
                onStatusChange={onStatusChange}
                onReprocess={onReprocess}
              />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default MinutesGroupedByClient;
