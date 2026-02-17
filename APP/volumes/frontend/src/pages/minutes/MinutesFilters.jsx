// src/pages/minutes/components/MinutesFilters.jsx
import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META = "text-gray-500 dark:text-gray-400";

const safeArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Estados soportados (manteniendo los existentes):
 * - completed
 * - pending
 * - in-progress
 * - ready-for-edit (nuevo)
 *
 * Nota: id = value del select (string estable)
 */
const STATUS_OPTIONS = [
  { id: "completed", name: "Completada" },
  { id: "pending", name: "Pendiente" },
  { id: "in-progress", name: "En Progreso" },
  { id: "ready-for-edit", name: "Lista para edición" },
];

const FILTER_LABELS = {
  client: "Cliente",
  project: "Proyecto",
  dateFrom: "Fecha Desde",
  dateTo: "Fecha Hasta",
  status: "Estado",
};

const FILTER_ICONS = {
  client: "business",
  project: "folder",
  dateFrom: "calendar",
  dateTo: "calendar",
  status: "tag", // si no existe en tu iconManager, cámbialo por "filter" o "clipboard"
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
const FilterField = ({
  type,
  label,
  icon,
  value,
  onChange,
  options,
  placeholder,
  // extras
  getOptionValue,
  getOptionLabel,
}) => (
  <div className="flex flex-col gap-2">
    <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
      <Icon name={icon} className="text-primary-500 dark:text-primary-400 text-sm" />
      {label}
    </label>

    {type === "select" ? (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
      >
        <option value="" className="bg-white dark:bg-gray-800">
          {placeholder}
        </option>

        {safeArray(options).map((option, idx) => {
          const optValue = getOptionValue ? getOptionValue(option) : option?.id;
          const optLabel = getOptionLabel ? getOptionLabel(option) : option?.name;

          // fallback defensivo
          const key = String(optValue ?? idx);

          return (
            <option key={key} value={String(optValue ?? "")} className="bg-white dark:bg-gray-800">
              {String(optLabel ?? "-")}
            </option>
          );
        })}
      </select>
    ) : (
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
      />
    )}
  </div>
);

// Componente principal
const MinutesFilters = ({ filters, onFilterChange, onClearFilters, onApplyFilters, data }) => {
  const [visibleFilters, setVisibleFilters] = useState({
    client: true,
    project: true,
    status: true,
    dateFrom: false,
    dateTo: false,
  });

  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const toggleFilterVisibility = (filterName) => {
    setVisibleFilters((prev) => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  // Normalización defensiva: si filters.status no existe, igual funciona.
  const currentFilters = filters ?? {};

  const clients = safeArray(data?.clients);
  const projects = safeArray(data?.projects);

  return (
    <div className="bg-surface shadow-card rounded-2xl p-6 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
        >
          <Icon name="filter" className="text-primary-500 dark:text-primary-400" />
          Filtros Activos
          <Icon
            name={filtersExpanded ? "chevronUp" : "chevronDown"}
            className="text-sm transition-transform duration-200"
          />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${TXT_META} bg-transparent border border-secondary-200 dark:border-secondary-700 rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`}
          >
            <Icon name="sliders" className="text-sm" />
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
          {visibleFilters.client && (
            <FilterField
              type="select"
              label="Cliente"
              icon={FILTER_ICONS.client}
              value={currentFilters.client}
              onChange={(value) => onFilterChange("client", value)}
              options={clients}
              placeholder="Todos los clientes"
            />
          )}

          {visibleFilters.project && (
            <FilterField
              type="select"
              label="Proyecto"
              icon={FILTER_ICONS.project}
              value={currentFilters.project}
              onChange={(value) => onFilterChange("project", value)}
              options={projects}
              placeholder="Todos los proyectos"
            />
          )}

          {visibleFilters.status && (
            <FilterField
              type="select"
              label="Estado"
              icon={FILTER_ICONS.status}
              value={currentFilters.status}
              onChange={(value) => onFilterChange("status", value)}
              options={STATUS_OPTIONS}
              placeholder="Todos los estados"
              getOptionValue={(o) => o.id}
              getOptionLabel={(o) => o.name}
            />
          )}

          {visibleFilters.dateFrom && (
            <FilterField
              type="date"
              label="Desde"
              icon={FILTER_ICONS.dateFrom}
              value={currentFilters.dateFrom}
              onChange={(value) => onFilterChange("dateFrom", value)}
            />
          )}

          {visibleFilters.dateTo && (
            <FilterField
              type="date"
              label="Hasta"
              icon={FILTER_ICONS.dateTo}
              value={currentFilters.dateTo}
              onChange={(value) => onFilterChange("dateTo", value)}
            />
          )}

          <div className="flex flex-col gap-2 lg:col-start-6">
            <ActionButton
              label="Limpiar"
              variant="soft"
              size="sm"
              icon={<Icon name="filterClear" />}
              onClick={onClearFilters}
              className="w-full"
            />
            <ActionButton
              label="Filtrar"
              variant="primary"
              size="sm"
              icon={<Icon name="search" />}
              onClick={onApplyFilters}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MinutesFilters;