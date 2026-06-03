import React, { useEffect, useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import {
  FILTER_META,
  FILTER_TEXT,
  HISTORY_FILTER_ICONS,
} from "./constants";
import { getInitialVisibleFilters } from "./utils";
import HistoryFilterDropdown from "./HistoryFilterDropdown";
import HistoryFilterField from "./HistoryFilterField";

const HistoryFilters = ({
  type,
  filters,
  statusOptions,
  clientOptions,
  projectOptions,
  activeFiltersCount,
  onFilterChange,
  onClearFilters,
}) => {
  const [visibleFilters, setVisibleFilters] = useState(() => getInitialVisibleFilters(type));
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    setVisibleFilters(getInitialVisibleFilters(type));
    setShowFiltersDropdown(false);
  }, [type]);

  const toggleFilterVisibility = (filterName) => {
    setVisibleFilters((prev) => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  return (
    <div className="mb-6 rounded-2xl border border-secondary-200 bg-surface p-6 shadow-card transition-theme dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5">
      <div className="flex items-center justify-between border-b border-secondary-200 pb-4 transition-theme dark:border-secondary-700/60">
        <button
          type="button"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`flex items-center gap-2 text-base font-semibold ${FILTER_TEXT} transition-theme hover:text-primary-600 dark:hover:text-primary-400`}
        >
          <Icon name="FaFilter" className="text-primary-500 dark:text-primary-400" />
          Filtros
          {activeFiltersCount > 0 ? (
            <span className="ml-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700 transition-theme dark:bg-primary-900/30 dark:text-primary-400">
              {activeFiltersCount}
            </span>
          ) : null}
          <Icon
            name={filtersExpanded ? "FaChevronUp" : "FaChevronDown"}
            className="text-sm transition-transform duration-200"
          />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
            className={`flex items-center gap-2 rounded-xl border border-secondary-200 bg-transparent px-4 py-2 text-sm font-medium ${FILTER_META} transition-theme hover:border-secondary-300 hover:bg-secondary-50 hover:text-gray-900 dark:border-secondary-700 dark:hover:border-secondary-600 dark:hover:bg-secondary-800/50 dark:hover:text-gray-50`}
          >
            <Icon name="FaSliders" className="text-sm" />
            Gestionar Filtros
          </button>

          {showFiltersDropdown ? (
            <HistoryFilterDropdown
              visibleFilters={visibleFilters}
              onToggleVisibility={toggleFilterVisibility}
              onClose={() => setShowFiltersDropdown(false)}
            />
          ) : null}
        </div>
      </div>

      {filtersExpanded ? (
        <div className="mt-6 grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-6">
          {visibleFilters.dateFrom ? (
            <HistoryFilterField
              type="date"
              label="Fecha desde"
              icon={HISTORY_FILTER_ICONS.dateFrom}
              value={filters.dateFrom}
              onChange={(value) => onFilterChange("dateFrom", value)}
            />
          ) : null}

          {visibleFilters.dateTo ? (
            <HistoryFilterField
              type="date"
              label="Fecha hasta"
              icon={HISTORY_FILTER_ICONS.dateTo}
              value={filters.dateTo}
              onChange={(value) => onFilterChange("dateTo", value)}
            />
          ) : null}

          {visibleFilters.search ? (
            <div className="lg:col-span-2">
              <HistoryFilterField
                type="search"
                label="Búsqueda"
                icon={HISTORY_FILTER_ICONS.search}
                value={filters.search}
                onChange={(value) => onFilterChange("search", value)}
                placeholder="Buscar por título, resumen o elaborador..."
              />
            </div>
          ) : null}

          {visibleFilters.client && (type === "participant" || type === "all") ? (
            <HistoryFilterField
              type="select"
              label="Cliente"
              icon={HISTORY_FILTER_ICONS.client}
              value={filters.client}
              onChange={(value) => onFilterChange("client", value)}
              options={clientOptions}
              placeholder="Todos los clientes"
            />
          ) : null}

          {visibleFilters.project && (type === "client" || type === "participant" || type === "all") ? (
            <HistoryFilterField
              type="select"
              label="Proyecto"
              icon={HISTORY_FILTER_ICONS.project}
              value={filters.project}
              onChange={(value) => onFilterChange("project", value)}
              options={projectOptions}
              placeholder="Todos los proyectos"
            />
          ) : null}

          {visibleFilters.status ? (
            <HistoryFilterField
              type="select"
              label="Estado"
              icon={HISTORY_FILTER_ICONS.status}
              value={filters.status}
              onChange={(value) => onFilterChange("status", value)}
              options={statusOptions}
              placeholder="Todos los estados"
            />
          ) : null}

          <div className="flex flex-col gap-2 lg:col-start-6">
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-secondary-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-theme hover:border-secondary-300 hover:bg-secondary-50 hover:text-gray-900 dark:border-secondary-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-secondary-600 dark:hover:bg-secondary-800/50 dark:hover:text-gray-50"
            >
              <Icon name="FaEraser" className="text-sm" />
              Limpiar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HistoryFilters;
