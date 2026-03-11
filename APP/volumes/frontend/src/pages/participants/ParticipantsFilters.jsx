import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";

const inputCls =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500";

const ParticipantsFilters = ({ filters, onFilterChange, onClearFilters }) => {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Buscar
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder="Nombre, organización, cargo o correo"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Estado
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange("status", e.target.value)}
            className={inputCls}
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Correos
          </label>
          <select
            value={filters.emailMode}
            onChange={(e) => onFilterChange("emailMode", e.target.value)}
            className={inputCls}
          >
            <option value="">Todos</option>
            <option value="with-email">Con correos</option>
            <option value="without-email">Sin correos</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <ActionButton
          label="Limpiar filtros"
          onClick={onClearFilters}
          variant="neutral"
          size="sm"
        />
      </div>
    </div>
  );
};

export default ParticipantsFilters;
