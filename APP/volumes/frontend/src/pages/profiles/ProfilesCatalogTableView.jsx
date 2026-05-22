import React from "react";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import useTableSorting from "@/hooks/useTableSorting";
import ProfilesCatalogViewActions from "./ProfilesCatalogViewActions";

const ProfilesCatalogTableView = ({
  profiles = [],
  categories = [],
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(profiles, {
    profile: (profile) => profile?.name,
    category: (profile) => profile?.category?.name,
    prompt: (profile) => Number(Boolean((profile?.prompt || "").trim())),
    status: (profile) => profile?.isActive,
  });

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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3"><SortableTableHeader label="Perfil" sortKey="profile" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Categoría" sortKey="category" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Prompt" sortKey="prompt" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((profile) => (
              <tr key={profile.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="min-w-[220px]">
                    <p className="font-semibold text-gray-900 dark:text-white">{profile.name ?? "—"}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile.description || "Sin descripción"}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{profile.category?.name ?? "—"}</td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {(profile.prompt || "").trim() ? "Disponible" : "Sin prompt"}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      profile.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {profile.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="min-w-[148px]">
                    <ProfilesCatalogViewActions
                      id={profile.id}
                      summary={profile}
                      categories={categories}
                      onUpdated={onUpdated}
                      onDeleted={onDeleted}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfilesCatalogTableView;
