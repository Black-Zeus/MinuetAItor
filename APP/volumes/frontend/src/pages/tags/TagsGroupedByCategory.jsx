import React, { useEffect, useMemo, useState } from "react";

import CollapsibleSection from "@/components/common/CollapsibleSection";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import TagsCard from "./TagsCard";

const groupTagsByCategory = (tags, categories) => {
  const categoryMap = new Map((categories ?? []).map((category) => [String(category.id), category.name]));
  const map = new Map();

  (tags ?? []).forEach((tag) => {
    const rawKey = String(tag?.categoryId ?? tag?.category_id ?? "without-category");
    const label = String(categoryMap.get(rawKey) ?? tag?.category?.name ?? "Sin categoría");
    if (!map.has(rawKey)) {
      map.set(rawKey, { key: rawKey, label, items: [] });
    }
    map.get(rawKey).items.push(tag);
  });

  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, "es"));
};

const TagsGroupedByCategory = ({
  tags = [],
  categories = [],
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
  const groups = useMemo(() => groupTagsByCategory(tags, categories), [tags, categories]);
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
        icon="FaTag"
        title="No se encontraron tags"
        filteredMessage="Intenta ajustar o limpiar los filtros."
        defaultMessage="Crea el primer tag para comenzar."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <CollapsibleSection
          key={group.key}
          title={group.label}
          subtitle={group.items.length === 1 ? "1 tag asociado" : `${group.items.length} tags asociados`}
          icon="FaTags"
          count={group.items.length}
          isOpen={expandedByCategory[group.key] ?? true}
          onToggle={() =>
            setExpandedByCategory((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? true) }))
          }
          className="overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 2xl:grid-cols-3">
            {group.items.map((tag) => (
              <TagsCard
                key={tag.id}
                id={tag.id}
                summary={tag}
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

export default TagsGroupedByCategory;
