import React, { useEffect, useMemo, useState } from "react";

import CollapsibleSection from "@/components/common/CollapsibleSection";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import { TeamsCard } from "./TeamsCards";

const groupUsersByPosition = (users) => {
  const map = new Map();

  (users ?? []).forEach((user) => {
    const rawPosition = String(user?.position ?? "").trim();
    const key = rawPosition ? rawPosition.toLowerCase() : "without-position";
    const label = rawPosition || "Sin cargo asignado";
    if (!map.has(key)) {
      map.set(key, { key, label, items: [] });
    }
    map.get(key).items.push(user);
  });

  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, "es"));
};

const TeamsGroupedByPosition = ({ users = [], hasFilters = false, onUpdated, onDeleted }) => {
  const groups = useMemo(() => groupUsersByPosition(users), [users]);
  const [expandedByPosition, setExpandedByPosition] = useState({});

  useEffect(() => {
    setExpandedByPosition((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (typeof next[group.key] !== "boolean") {
          next[group.key] = true;
        }
      });
      return next;
    });
  }, [groups]);

  if (!groups.length) {
    return (
      <CatalogEmptyState
        hasFilters={hasFilters}
        icon="FaUsers"
        title="Sin usuarios registrados"
        filteredMessage="Ningún usuario coincide con los filtros activos."
        defaultMessage="Crea el primer miembro del equipo con el botón Nuevo Usuario."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <CollapsibleSection
          key={group.key}
          title={group.label}
          subtitle={group.items.length === 1 ? "1 usuario asociado" : `${group.items.length} usuarios asociados`}
          icon="FaUserTie"
          count={group.items.length}
          isOpen={expandedByPosition[group.key] ?? true}
          onToggle={() =>
            setExpandedByPosition((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? true) }))
          }
          className="overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {group.items.map((user) => (
              <TeamsCard
                key={user.id}
                id={user.id}
                summary={user}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default TeamsGroupedByPosition;
