import React, { useEffect, useMemo, useState } from "react";

import CollapsibleSection from "@/components/common/CollapsibleSection";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import ProfilesCatalogCard from "./ProfilesCatalogCard";

const groupProfilesByCategory = (profiles, categories) => {
  const categoryMap = new Map((categories ?? []).map((category) => [String(category.id), category.name]));
  const map = new Map();

  (profiles ?? []).forEach((profile) => {
    const rawKey = String(profile?.categoryId ?? profile?.category_id ?? profile?.category?.id ?? "without-category");
    const label = String(profile?.category?.name ?? categoryMap.get(rawKey) ?? "Sin categoría");
    if (!map.has(rawKey)) {
      map.set(rawKey, { key: rawKey, label, items: [] });
    }
    map.get(rawKey).items.push(profile);
  });

  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, "es"));
};

const ProfilesCatalogGroupedByCategory = ({
  profiles = [],
  categories = [],
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
  const groups = useMemo(() => groupProfilesByCategory(profiles, categories), [profiles, categories]);
  const [expandedByCategory, setExpandedByCategory] = useState({});

  useEffect(() => {
    setExpandedByCategory((prev) => {
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
        icon="FaBrain"
        title="No se encontraron perfiles"
        filteredMessage="Intenta ajustar los filtros."
        defaultMessage="Crea un nuevo perfil para comenzar."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <CollapsibleSection
          key={group.key}
          title={group.label}
          subtitle={group.items.length === 1 ? "1 perfil asociado" : `${group.items.length} perfiles asociados`}
          icon="FaFolderTree"
          count={group.items.length}
          isOpen={expandedByCategory[group.key] ?? true}
          onToggle={() =>
            setExpandedByCategory((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? true) }))
          }
          className="overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 2xl:grid-cols-3">
            {group.items.map((profile) => (
              <ProfilesCatalogCard
                key={profile.id}
                id={profile.id}
                summary={profile}
                categories={categories}
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

export default ProfilesCatalogGroupedByCategory;
