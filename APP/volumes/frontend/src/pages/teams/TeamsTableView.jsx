import React from "react";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import useTableSorting from "@/hooks/useTableSorting";
import TeamsViewActions from "./TeamsViewActions";

const TeamsTableView = ({ users = [], hasFilters = false, onUpdated, onDeleted }) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(users, {
    user: (user) => user?.name,
    email: (user) => user?.email,
    position: (user) => user?.position,
    role: (user) => user?.systemRole,
    status: (user) => user?.status,
  });

  if (!users.length) {
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3"><SortableTableHeader label="Usuario" sortKey="user" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Correo" sortKey="email" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Cargo" sortKey="position" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Rol" sortKey="role" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-gray-900 dark:text-white">{user.name ?? "—"}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.department ?? "Sin departamento"}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{user.email ?? "—"}</td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{user.position ?? "—"}</td>
                <td className="px-4 py-4 text-sm uppercase text-gray-600 dark:text-gray-300">{user.systemRole ?? "viewer"}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      user.status === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {user.status === "active" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="min-w-[220px]">
                    <TeamsViewActions
                      id={user.id}
                      summary={user}
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

export default TeamsTableView;
