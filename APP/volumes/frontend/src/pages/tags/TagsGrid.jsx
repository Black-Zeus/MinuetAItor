/**
 * TagsGrid.jsx (alineado a ProjectGrid template)
 * - MISMA estructura que ProjectGrid: sólo grid + EmptyState
 * - Keys estables: tag.id (fallback name)
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import TagsCard from "./TagsCard";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ hasFilters }) => {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
        <Icon name="FaTag" className={`${TXT_META} w-8 h-8`} />
      </div>
      <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
        No se encontraron tags
      </h3>
      <p className={`${TXT_META}`}>
        {hasFilters ? "Intenta ajustar los filtros" : "Crea un nuevo tag para comenzar"}
      </p>
    </div>
  );
};

const TagsGrid = ({
  tags = [],
  onEdit,
  onDelete,
  onToggleStatus,
  hasFilters,
}) => {
  if (!tags || tags.length === 0) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {tags.map((tag) => (
        <TagsCard
          key={tag?.id ?? tag?.name}
          tag={tag}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </div>
  );
};

export default TagsGrid;