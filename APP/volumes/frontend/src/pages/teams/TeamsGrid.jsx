/**
 * TeamsGrid.jsx
 * Grid del módulo Teams con EmptyState y manejo de filtros activos.
 * Los usuarios del equipo no tienen distinción confidencial, por lo que
 * se presenta una única sección con estado vacío apropiado.
 */

import React from "react";
import Icon      from "@/components/ui/icon/iconManager";
import TeamsCards from "./TeamsCards";

const TXT_META = "text-gray-500 dark:text-gray-400";

// ─── EmptyState ───────────────────────────────────────────────────────────────

const EmptyState = ({ hasFilters }) => (
  <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
    <Icon
      name={hasFilters ? "FaSearch" : "FaUsers"}
      className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
    />
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
      {hasFilters ? "Sin resultados" : "Sin usuarios registrados"}
    </h3>
    <p className={`text-sm ${TXT_META}`}>
      {hasFilters
        ? "Ningún usuario coincide con los filtros activos. Intenta con otros criterios."
        : "Crea el primer miembro del equipo con el botón «Nuevo Usuario»."}
    </p>
  </div>
);

// ─── Sort controls ────────────────────────────────────────────────────────────

const SortControls = ({ sortBy, onSortChange }) => (
  <div className="flex items-center gap-2">
    <span className={`text-sm ${TXT_META}`}>Ordenar por:</span>
    <select
      value={sortBy}
      onChange={(e) => onSortChange(e.target.value)}
      className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <option value="name-asc">Nombre A-Z</option>
      <option value="name-desc">Nombre Z-A</option>
    </select>
  </div>
);

// ─── TeamsGrid ────────────────────────────────────────────────────────────────

const TeamsGrid = ({
  users      = [],
  sortBy,
  onSortChange,
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
  const isEmpty = users.length === 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!isEmpty && (
        <div className="flex items-center justify-between">
          <span className={`text-sm ${TXT_META}`}>
            {users.length} usuario{users.length !== 1 ? "s" : ""}
          </span>
          <SortControls sortBy={sortBy} onSortChange={onSortChange} />
        </div>
      )}

      {/* Contenido */}
      {isEmpty ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <TeamsCards
          users={users}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
};

export default TeamsGrid;