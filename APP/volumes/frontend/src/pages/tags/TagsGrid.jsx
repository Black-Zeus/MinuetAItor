/**
 * TagsGrid.jsx
 * Grid de TagsCard — patrón ProjectGrid
 *
 * Props: tags, categories, onUpdated, onDeleted, hasFilters
 */

import React from "react";
import Icon     from "@/components/ui/icon/iconManager";
import TagsCard from "./TagsCard";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ hasFilters }) => (
  <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-16 text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
      <Icon name="FaTag" className={`${TXT_META} w-8 h-8`} />
    </div>
    <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
      No se encontraron tags
    </h3>
    <p className={TXT_META}>
      {hasFilters
        ? "Intenta ajustar o limpiar los filtros"
        : "Crea el primer tag para comenzar"}
    </p>
  </div>
);

const TagsGrid = ({
  tags = [],
  categories = [],
  onUpdated,
  onDeleted,
  hasFilters = false,
}) => {
  if (!tags.length) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {tags.map((tag) => (
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
  );
};

export default TagsGrid;