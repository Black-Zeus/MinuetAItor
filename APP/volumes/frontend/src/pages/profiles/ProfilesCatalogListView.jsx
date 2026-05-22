import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import ProfilesCatalogViewActions from "./ProfilesCatalogViewActions";

const ProfilesCatalogListView = ({
  profiles = [],
  categories = [],
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
  if (!profiles.length) {
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
    <div className="space-y-4">
      {profiles.map((profile) => (
        <article
          key={profile.id}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{profile.name ?? "—"}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    profile.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {profile.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile.description || "Sin descripción"}</p>

              <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Icon name="FaBrain" className="h-4 w-4 text-gray-400" />
                  <span>{profile.category?.name ?? "Sin categoría"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="FaCode" className="h-4 w-4 text-gray-400" />
                  <span>{(profile.prompt || "").trim() ? "Con prompt" : "Sin prompt"}</span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-48">
              <ProfilesCatalogViewActions
                id={profile.id}
                summary={profile}
                categories={categories}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default ProfilesCatalogListView;
