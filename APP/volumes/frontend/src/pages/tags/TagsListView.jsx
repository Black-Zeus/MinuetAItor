import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import TagsViewActions from "./TagsViewActions";

const TagsListView = ({ tags = [], categories = [], hasFilters = false, onUpdated, onDeleted }) => {
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
    <div className="space-y-4">
      {tags.map((tag) => {
        const categoryName =
          categories.find((category) => String(category.id) === String(tag?.categoryId))?.name ?? "Sin categoría";

        return (
          <article
            key={tag.id}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tag.name ?? "—"}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tag.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {tag.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tag.description || "Sin descripción"}</p>

                <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Icon name="FaTag" className="h-4 w-4 text-gray-400" />
                    <span>{categoryName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="FaCodeBranch" className="h-4 w-4 text-gray-400" />
                    <span>{tag.source ?? "user"}</span>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-48">
                <TagsViewActions
                  id={tag.id}
                  summary={tag}
                  categories={categories}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default TagsListView;
