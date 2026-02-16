/**
 * TeamsGrid.jsx
 * Grid de usuarios con header de ordenamiento y estado vacío
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import TeamsCards from "./TeamsCards";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ hasFilters }) => {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
        <Icon name="FaUsers" className={`${TXT_META} w-8 h-8`} />
      </div>

      <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
        No se encontraron usuarios
      </h3>

      <p className={`${TXT_META}`}>
        {hasFilters ? "Intenta ajustar los filtros" : "Agrega un nuevo usuario para comenzar"}
      </p>
    </div>
  );
};

const TeamsGrid = ({ users, sortBy, onSortChange, hasFilters }) => {
  if (!Array.isArray(users) || users.length === 0) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className={`text-sm ${TXT_META} transition-theme`}>
          Mostrando{" "}
          <span className={`font-semibold ${TXT_TITLE} transition-theme`}>
            {users.length}
          </span>{" "}
          usuarios
        </p>

        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className={`px-4 py-2 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
          >
            <option value="name-asc" className="bg-white dark:bg-gray-800">
              Ordenar: Nombre A-Z
            </option>
            <option value="name-desc" className="bg-white dark:bg-gray-800">
              Ordenar: Nombre Z-A
            </option>
            <option value="date-created" className="bg-white dark:bg-gray-800">
              Ordenar: Fecha de alta
            </option>
            <option value="last-activity" className="bg-white dark:bg-gray-800">
              Ordenar: Última actividad
            </option>
          </select>
        </div>
      </div>

      <TeamsCards users={users} />
    </div>
  );
};

export default TeamsGrid;