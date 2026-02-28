/**
 * ProfilesCatalogFilters.jsx
 * Filtros del catálogo de perfiles
 *
 * CAMBIO: categories ahora es Array<{ id: number, name: string, isActive: bool }>
 *   - categoriaOptions mapea objetos → { value: id, label: name }
 *   - el filtro usa key "categoryId" (ID numérico como string) en lugar de "categoria"
 *   - activeFiltersCount actualizado para contar "categoryId" en vez de "categoria"
 */

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
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

const normalizeText = (v) => String(v ?? "").trim();

// ─── FilterDropdown ────────────────────────────────────────────────────────────

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

// ─── FilterField ───────────────────────────────────────────────────────────────

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
        <option value="" className="bg-white dark:bg-gray-800">{placeholder}</option>
        {(Array.isArray(options) ? options : []).map((option) => (
          <option key={option.value} value={option.value} className="bg-white dark:bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
    ) : type === "search" ? (
      <div className="relative">
        <Icon name="FaSearch" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
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

// ─── Componente principal ─────────────────────────────────────────────────────

const ProfilesCatalogFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  onApplyFilters,
  categories = [],   // Array<{ id: number, name: string }> del backend
  profiles   = [],   // fallback (no usado si hay categories)
}) => {
  const [visibleFilters, setVisibleFilters] = useState({
    search:     true,
    categoryId: true,
    status:     true,
  });

  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersExpanded,     setFiltersExpanded]     = useState(false);

  const toggleFilterVisibility = (filterName) => {
    setVisibleFilters((prev) => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  const activeFiltersCount = useMemo(() => {
    if (!filters) return 0;
    const keys = ["search", "categoryId", "status"];
    return keys.reduce((acc, k) => acc + (normalizeText(filters?.[k]) !== "" ? 1 : 0), 0);
  }, [filters]);

  const statusOptions = [
    { value: "activo",   label: "Activo"   },
    { value: "inactivo", label: "Inactivo" },
  ];

  // Mapea objetos { id, name } → { value: String(id), label: name }
  const categoriaOptions = useMemo(() => {
    const cats = Array.isArray(categories) ? categories : [];
    if (cats.length > 0) {
      return cats
        .filter((c) => c?.name)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        .map((c) => ({ value: String(c.id), label: c.name }));
    }
    // fallback: derivar desde perfiles (compatibilidad)
    const names = [...new Set((Array.isArray(profiles) ? profiles : []).map((p) => p?.category?.name).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n }));
  }, [categories, profiles]);

  return (
    <div className="bg-surface shadow-card rounded-2xl p-6 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
        >
          <Icon name="FaFilter" className="text-primary-500 dark:text-primary-400" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
              {activeFiltersCount}
            </span>
          )}
          <Icon
            name={filtersExpanded ? "FaChevronUp" : "FaChevronDown"}
            className={`${TXT_META} text-xs transition-transform`}
          />
        </button>

        <div className="relative">
          <ActionButton
            variant="soft"
            size="sm"
            icon={<Icon name="FaSlidersH" />}
            tooltip="Mostrar/ocultar filtros"
            onClick={() => setShowFiltersDropdown((p) => !p)}
          />
          {showFiltersDropdown && (
            <FilterDropdown
              visibleFilters={visibleFilters}
              onToggleVisibility={toggleFilterVisibility}
              onClose={() => setShowFiltersDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Filtros */}
      {filtersExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pt-4">

          {visibleFilters.search && (
            <FilterField
              type="search"
              label={FILTER_LABELS.search}
              icon={FILTER_ICONS.search}
              value={filters?.search ?? ""}
              onChange={(value) => onFilterChange?.("search", value)}
              placeholder="Buscar por nombre o descripción..."
            />
          )}

          {visibleFilters.categoryId && (
            <FilterField
              type="select"
              label={FILTER_LABELS.categoryId}
              icon={FILTER_ICONS.categoryId}
              value={filters?.categoryId ?? ""}
              onChange={(value) => onFilterChange?.("categoryId", value)}
              options={categoriaOptions}
              placeholder="Todas las categorías"
            />
          )}

          {visibleFilters.status && (
            <FilterField
              type="select"
              label={FILTER_LABELS.status}
              icon={FILTER_ICONS.status}
              value={filters?.status ?? ""}
              onChange={(value) => onFilterChange?.("status", value)}
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
            <ActionButton
              label="Filtrar"
              variant="primary"
              size="sm"
              icon={<Icon name="FaSearch" />}
              onClick={onApplyFilters}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilesCatalogFilters;