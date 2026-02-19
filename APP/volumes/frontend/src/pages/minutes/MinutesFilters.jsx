// src/pages/minutes/components/MinutesFilters.jsx
import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const safeArray = (v) => (Array.isArray(v) ? v : []);

// ====================================
// ESTADOS — ciclo de vida de una minuta
//
// [in-progress] → [ready-for-edit] → [pending] → [completed]
//      ↓                ↓               ↓
//  [cancelled]      [cancelled]     [cancelled]
//
// in-progress    IA procesando la transcripción
// ready-for-edit IA devolvió resultado, usuario revisa/corrige
// pending        Enviada a participantes, aprobación tácita en curso
// completed      Publicada y aprobada, inmutable — solo descarga
// cancelled      Anulada, visible solo para trazabilidad
// ====================================
const STATUS_OPTIONS = [
  { id: "in-progress",    name: "En Progreso",       icon: "spinner"      },
  { id: "ready-for-edit", name: "Lista para edición", icon: "edit"         },
  { id: "pending",        name: "Pendiente",          icon: "clock"        },
  { id: "completed",      name: "Completada",         icon: "checkCircle"  },
  { id: "cancelled",      name: "Anulada",            icon: "ban"          },
];

const FILTER_LABELS = {
  client:   "Cliente",
  project:  "Proyecto",
  dateFrom: "Fecha Desde",
  dateTo:   "Fecha Hasta",
  status:   "Estado",
};

const FILTER_ICONS = {
  client:   "business",
  project:  "folder",
  dateFrom: "calendar",
  dateTo:   "calendar",
  status:   "filter",
};

// ====================================
// SUBCOMPONENTE: StatusLifecycleBadge
// Muestra el ciclo de vida debajo de los filtros como referencia visual
// ====================================
const LIFECYCLE_STEPS = [
  {
    id:      "in-progress",
    label:   "En Progreso",
    icon:    "FaSpinner",
    color:   "text-[#1e3a8a] dark:text-blue-400",
    tooltip: "La minuta fue enviada al agente IA y está siendo procesada",
  },
  {
    id:      "ready-for-edit",
    label:   "Lista para edición",
    icon:    "FaPenToSquare",
    color:   "text-orange-500 dark:text-orange-400",
    tooltip: "La IA completó el procesamiento — el usuario debe revisar y validar el contenido",
  },
  {
    id:      "pending",
    label:   "Pendiente",
    icon:    "FaClock",
    color:   "text-yellow-500 dark:text-yellow-400",
    tooltip: "Enviada a los participantes — se aprobará de forma tácita si no hay observaciones",
  },
  {
    id:      "completed",
    label:   "Completada",
    icon:    "FaCircleCheck",
    color:   "text-green-600 dark:text-green-400",
    tooltip: "Minuta oficial aprobada e inmutable — solo disponible para descarga",
  },
];

const StatusLifecycle = () => (
  <div className="mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
    <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META} mb-3 transition-theme`}>
      Ciclo de vida
    </p>

    <div className="flex items-center flex-wrap gap-2">

      {/* Flujo principal: paso a paso con flechas */}
      {LIFECYCLE_STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <span className={`text-xs font-medium ${step.color} transition-theme`}>
            {step.label}
          </span>
          {index < LIFECYCLE_STEPS.length - 1 && (
            <Icon
              name="FaArrowRight"
              className="text-[10px] text-gray-300 dark:text-gray-600 shrink-0"
            />
          )}
        </React.Fragment>
      ))}

      {/* Separador */}
      <span className="mx-2 text-gray-200 dark:text-gray-700 text-sm font-light">|</span>

      {/* Anulada — destacada en rojo con leyenda */}
      <div className="flex items-center gap-1.5">
        <Icon name="FaBan" className="text-[10px] text-red-400 dark:text-red-500 shrink-0" />
        <span className="text-xs font-medium text-red-500 dark:text-red-400 transition-theme">
          Anulada
        </span>
        <span className={`text-xs ${TXT_META} transition-theme`}>
          — cualquier estado activo puede ser anulado
        </span>
      </div>

    </div>
  </div>
);

// ====================================
// SUBCOMPONENTE: FilterDropdown
// ====================================
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

// ====================================
// SUBCOMPONENTE: FilterField
// ====================================
const FilterField = ({
  type,
  label,
  icon,
  value,
  onChange,
  options,
  placeholder,
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
        className={`
          w-full px-4 py-2.5
          border border-secondary-200 dark:border-secondary-700
          rounded-xl bg-white dark:bg-gray-800
          ${TXT_TITLE} text-sm
          focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10
          hover:border-secondary-300 dark:hover:border-secondary-600
          transition-theme
        `}
      >
        <option value="" className="bg-white dark:bg-gray-800">
          {placeholder}
        </option>
        {safeArray(options).map((option, idx) => {
          const optValue = getOptionValue ? getOptionValue(option) : option?.id;
          const optLabel = getOptionLabel ? getOptionLabel(option) : option?.name;
          return (
            <option key={String(optValue ?? idx)} value={String(optValue ?? "")} className="bg-white dark:bg-gray-800">
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
        className={`
          w-full px-4 py-2.5
          border border-secondary-200 dark:border-secondary-700
          rounded-xl bg-white dark:bg-gray-800
          ${TXT_TITLE} text-sm
          focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10
          hover:border-secondary-300 dark:hover:border-secondary-600
          transition-theme
        `}
      />
    )}
  </div>
);

// ====================================
// COMPONENTE PRINCIPAL
// ====================================
const MinutesFilters = ({ filters, onFilterChange, onClearFilters, onApplyFilters, data }) => {
  const [visibleFilters, setVisibleFilters] = useState({
    client:   true,
    project:  true,
    status:   true,
    dateFrom: false,
    dateTo:   false,
  });

  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersExpanded, setFiltersExpanded]         = useState(false);

  const toggleFilterVisibility = (filterName) => {
    setVisibleFilters((prev) => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  const currentFilters = filters ?? {};
  const clients  = safeArray(data?.clients);
  const projects = safeArray(data?.projects);

  return (
    <div className="bg-surface shadow-card rounded-2xl p-6 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
        >
          <Icon name="filter" className="text-primary-500 dark:text-primary-400" />
          Filtros
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

      {/* ── CICLO DE VIDA — siempre visible ── */}
      <StatusLifecycle />

      {/* ── FILTROS ── */}
      {filtersExpanded && (
        <>
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

            {/* Acciones — siempre en la última columna */}
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

        </>
      )}
    </div>
  );
};

export default MinutesFilters;