/**
 * TagsFilters.jsx
 * Filtros del módulo Tags — patrón ProjectFilters / ClientFilters
 *
 * MIGRACIÓN: ya no importa dataTags.json.
 * Recibe `categories` como prop desde Tags.jsx (cargadas vía tagCategoryService).
 *
 * Props:
 *   filters:        { search, status, categoryId }
 *   categories:     TagCategoryResponse[]  ← prop nueva (antes hardcoded desde JSON)
 *   onFilterChange(filterName, value)
 *   onClearFilters()
 */

import React, { useMemo, useState } from "react";
import Icon         from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const FILTER_LABELS = {
  search:     "Búsqueda",
  status:     "Estado",
  categoryId: "Categoría",
};

const FILTER_ICONS = {
  search:     "FaSearch",
  status:     "FaToggleOn",
  categoryId: "FaLayerGroup",
};

// ─── FilterDropdown ───────────────────────────────────────────────────────────

const FilterDropdown = ({ visibleFilters, onToggleVisibility, onClose }) => (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-secondary-200 dark:border-secondary-700 rounded-2xl shadow-dropdown p-4 min-w-[250px] z-50 transition-theme">
      {Object.keys(visibleFilters).map((filterKey) => (
        <div
          key={filterKey}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary-50 dark:hover:bg-gray-700/50 cursor-pointer transition-theme"
          onClick={() => onToggleVisibility(filterKey)}
        >
          <input
            type="checkbox"
            checked={visibleFilters[filterKey]}
            onChange={() => {}}
            className="w-4 h-4 cursor-pointer accent-primary-500"
          />
          <label className={`cursor-pointer text-sm ${TXT_TITLE} flex-1 transition-theme`}>
            {FILTER_LABELS[filterKey]}
          </label>
        </div>
      ))}
    </div>
  </>
);

// ─── FilterField ──────────────────────────────────────────────────────────────

const FilterField = ({ type, label, icon, value, onChange, options, placeholder }) => (
  <div className="flex flex-col gap-2">
    <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
      <Icon name={icon} className="text-primary-500 dark:text-primary-400 text-sm" />
      {label}
    </label>

    {type === "select" ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
      >
        <option value="" className="bg-white dark:bg-gray-800">
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-gray-800">
            {opt.label}
          </option>
        ))}
      </select>
    ) : type === "search" ? (
      <div className="relative">
        <Icon
          name="FaSearch"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm placeholder-gray-400 dark:placeholder:text-secondary-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
        />
      </div>
    ) : null}
  </div>
);

// ─── TagsFilters ──────────────────────────────────────────────────────────────

const TagsFilters = ({
  filters,
  categories = [],   // ← prop nueva: TagCategoryResponse[] desde Tags.jsx
  onFilterChange,
  onClearFilters,
}) => {
  const [visibleFilters, setVisibleFilters] = useState({
    search:     true,
    status:     true,
    categoryId: true,
  });

  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersExpanded,     setFiltersExpanded]     = useState(false);

  const toggleFilterVisibility = (key) => {
    setVisibleFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Badge de filtros activos
  const activeFiltersCount = useMemo(
    () => Object.values(filters ?? {}).filter((v) => String(v ?? "").trim() !== "").length,
    [filters]
  );

  // Opciones de estado (fijas)
  const statusOptions = [
    { value: "activo",   label: "Activo" },
    { value: "inactivo", label: "Inactivo" },
  ];

  // Opciones de categoría — construidas desde la prop `categories` (ya no desde JSON)
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories]
  );

  return (
    <div className="bg-surface shadow-card rounded-2xl p-6 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <button
          type="button"
          onClick={() => setFiltersExpanded((v) => !v)}
          className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
        >
          <Icon name="FaFilter" className="text-primary-500 dark:text-primary-400" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1 px-2.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-semibold transition-theme">
              {activeFiltersCount}
            </span>
          )}
          <Icon
            name={filtersExpanded ? "FaChevronUp" : "FaChevronDown"}
            className="text-sm transition-transform duration-200"
          />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFiltersDropdown((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${TXT_META} bg-transparent border border-secondary-200 dark:border-secondary-700 rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`}
          >
            <Icon name="FaSliders" className="text-sm" />
            Gestionar Filtros
          </button>

          {showFiltersDropdown && (
            <FilterDropdown
              visibleFilters={visibleFilters}
              onToggleVisibility={toggleFilterVisibility}
              onClose={() => setShowFiltersDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Filters Grid */}
      {filtersExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end mt-6">

          {visibleFilters.search && (
            <div className="lg:col-span-2">
              <FilterField
                type="search"
                label="Búsqueda"
                icon={FILTER_ICONS.search}
                value={filters.search}
                onChange={(v) => onFilterChange("search", v)}
                placeholder="Buscar por nombre o descripción..."
              />
            </div>
          )}

          {visibleFilters.categoryId && (
            <FilterField
              type="select"
              label="Categoría"
              icon={FILTER_ICONS.categoryId}
              value={filters.categoryId}
              onChange={(v) => onFilterChange("categoryId", v)}
              options={categoryOptions}
              placeholder="Todas las categorías"
            />
          )}

          {visibleFilters.status && (
            <FilterField
              type="select"
              label="Estado"
              icon={FILTER_ICONS.status}
              value={filters.status}
              onChange={(v) => onFilterChange("status", v)}
              options={statusOptions}
              placeholder="Todos los estados"
            />
          )}

          <div className="flex flex-col gap-2 lg:col-start-6">
            <ActionButton
              label="Limpiar"
              variant="soft"
              size="sm"
              icon={<Icon name="FaEraser" />}
              onClick={onClearFilters}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TagsFilters;