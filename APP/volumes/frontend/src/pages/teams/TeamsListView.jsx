import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import TeamsViewActions from "./TeamsViewActions";

const TeamsListView = ({ users = [], hasFilters = false, onUpdated, onDeleted }) => {
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
    <div className="space-y-4">
      {users.map((user) => (
        <article
          key={user.id}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{user.name ?? "—"}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {user.status === "active" ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.position ?? "Sin cargo"}</p>

              <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Icon name="FaEnvelope" className="h-4 w-4 text-gray-400" />
                  <span>{user.email ?? "Sin correo"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="FaBuilding" className="h-4 w-4 text-gray-400" />
                  <span>{user.department ?? "Sin departamento"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="FaUserShield" className="h-4 w-4 text-gray-400" />
                  <span>{user.systemRole ?? "viewer"}</span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-56">
              <TeamsViewActions
                id={user.id}
                summary={user}
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

export default TeamsListView;
