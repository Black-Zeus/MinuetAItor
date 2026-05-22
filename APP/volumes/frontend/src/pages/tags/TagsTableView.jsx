import React from "react";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import useTableSorting from "@/hooks/useTableSorting";
import TagsViewActions from "./TagsViewActions";

const TagsTableView = ({ tags = [], categories = [], hasFilters = false, onUpdated, onDeleted }) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(tags, {
    tag: (tag) => tag?.name,
    category: (tag) => categories.find((category) => String(category.id) === String(tag?.categoryId))?.name ?? null,
    status: (tag) => tag?.isActive,
    source: (tag) => tag?.source,
  });

  if (!tags.length) {
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3"><SortableTableHeader label="Tag" sortKey="tag" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Categoría" sortKey="category" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Fuente" sortKey="source" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((tag) => {
              const categoryName =
                categories.find((category) => String(category.id) === String(tag?.categoryId))?.name ?? "—";

              return (
                <tr key={tag.id} className="align-top">
                  <td className="px-4 py-4">
                    <div className="min-w-[220px]">
                      <p className="font-semibold text-gray-900 dark:text-white">{tag.name ?? "—"}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tag.description || "Sin descripción"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{categoryName}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        tag.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {tag.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{tag.source ?? "user"}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[148px]">
                      <TagsViewActions
                        id={tag.id}
                        summary={tag}
                        categories={categories}
                        onUpdated={onUpdated}
                        onDeleted={onDeleted}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TagsTableView;
