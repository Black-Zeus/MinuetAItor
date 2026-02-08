/**
 * ClientFilters.jsx
 * Componente de filtros para el módulo de clientes
 */

import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META = "text-gray-500 dark:text-gray-400";

const FILTER_LABELS = {
  search: "Búsqueda",
  status: "Estado",
  industry: "Industria",
  priority: "Prioridad",
};

const FILTER_ICONS = {
  search: "FaSearch",
  status: "FaCheckCircle",
  industry: "FaIndustry",
  priority: "FaStar",
};

// Subcomponente: FilterDropdown
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

// Subcomponente: FilterField
const FilterField = ({ type, label, icon, value, onChange, options, placeholder, name }) => (
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
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-white dark:bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
    ) : type === "search" ? (
      <div className="relative">
        <Icon name="FaSearch" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
        />
      </div>
    ) : (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
      />
    )}
  </div>
);

// Componente principal
const ClientFilters = ({ filters, onFilterChange, onClearFilters, onApplyFilters, data }) => {
  const [visibleFilters, setVisibleFilters] = useState({
    search: true,
    status: true,
    industry: false,
    priority: false,
  });

  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const toggleFilterVisibility = (filterName) => {
    setVisibleFilters((prev) => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  // Opciones para los filtros
  const statusOptions = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'prospecto', label: 'Prospecto' }
  ];

  const industryOptions = [
    { value: 'tecnologia', label: 'Tecnología' },
    { value: 'finanzas', label: 'Finanzas' },
    { value: 'salud', label: 'Salud' },
    { value: 'educacion', label: 'Educación' },
    { value: 'retail', label: 'Retail' },
    { value: 'manufactura', label: 'Manufactura' },
    { value: 'servicios', label: 'Servicios' },
    { value: 'otra', label: 'Otra' }
  ];

  const priorityOptions = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'critica', label: 'Crítica' }
  ];

  return (
    <div className="bg-surface shadow-card rounded-2xl p-6 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
        >
          <Icon name="FaFilter" className="text-primary-500 dark:text-primary-400" />
          Filtros Activos
          <Icon
            name={filtersExpanded ? "FaChevronUp" : "FaChevronDown"}
            className="text-sm transition-transform duration-200"
          />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
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
                icon="FaSearch"
                value={filters.search}
                onChange={(value) => onFilterChange("search", value)}
                placeholder="Buscar por nombre, email o empresa..."
              />
            </div>
          )}

          {visibleFilters.status && (
            <FilterField
              type="select"
              label="Estado"
              icon="FaCheckCircle"
              value={filters.status}
              onChange={(value) => onFilterChange("status", value)}
              options={statusOptions}
              placeholder="Todos los estados"
            />
          )}

          {visibleFilters.industry && (
            <FilterField
              type="select"
              label="Industria"
              icon="FaIndustry"
              value={filters.industry}
              onChange={(value) => onFilterChange("industry", value)}
              options={industryOptions}
              placeholder="Todas las industrias"
            />
          )}

          {visibleFilters.priority && (
            <FilterField
              type="select"
              label="Prioridad"
              icon="FaStar"
              value={filters.priority}
              onChange={(value) => onFilterChange("priority", value)}
              options={priorityOptions}
              placeholder="Todas las prioridades"
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

export default ClientFilters;