/**
 * GlobalSearchFilters.jsx
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

// ====================================
// CATÁLOGO DE ESTADOS
// ====================================
export const DISPLAY_STATUS_OPTIONS = [
  { value: 'activo',          label: 'Activo',           dot: 'bg-green-500'  },
  { value: 'inactivo',        label: 'Inactivo',         dot: 'bg-gray-400'   },
  { value: 'prospecto',       label: 'Prospecto',        dot: 'bg-yellow-400' },
  { value: 'completed',       label: 'Completada',       dot: 'bg-green-500'  },
  { value: 'pending',         label: 'Pendiente',        dot: 'bg-yellow-400' },
  { value: 'in-progress',     label: 'En Progreso',      dot: 'bg-blue-500'   },
  { value: 'ready-for-edit',  label: 'Lista p/ edición', dot: 'bg-gray-400'   },
];

// ====================================
// CHIP DE MÓDULO
// ====================================
const ModuleChip = ({ module, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
      border transition-colors
      ${isActive
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600'
      }
    `}
  >
    <Icon name={module.icon} className="text-xs" />
    {module.label}
  </button>
);

// ====================================
// PILL DE ESTADO
// ====================================
const StatusPill = ({ option, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
      border transition-colors
      ${isActive
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600'
      }
    `}
  >
    <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white' : option.dot}`} />
    {option.label}
  </button>
);

// ====================================
// COMPONENTE PRINCIPAL
// ====================================
const GlobalSearchFilters = ({
  modules,
  activeModules,
  onModulesChange,
  activeStatuses = [],
  onStatusesChange = () => {},
  showFilters,
  onToggleFilters,
  resultLimit,
  onLimitChange,
  limitOptions,
  sortOrder,
  onSortChange,
  sortOptions,
}) => {
  const isAll = activeModules === null;

  const toggleModule = (moduleId) => {
    if (activeModules === null) {
      onModulesChange([moduleId]);
    } else if (activeModules.includes(moduleId)) {
      const next = activeModules.filter((id) => id !== moduleId);
      onModulesChange(next.length === 0 ? null : next);
    } else {
      onModulesChange([...activeModules, moduleId]);
    }
  };

  const toggleStatus = (value) => {
    if (activeStatuses.includes(value)) {
      onStatusesChange(activeStatuses.filter((s) => s !== value));
    } else {
      onStatusesChange([...activeStatuses, value]);
    }
  };

  const hasActiveStatuses = activeStatuses.length > 0;

  return (
    <div className="space-y-3">

      {/* ---- Alcance ---- */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Alcance
        </p>
        <div className="flex flex-wrap gap-2">
          <ModuleChip
            module={{ id: 'all', label: 'Todo', icon: 'FaMagnifyingGlass' }}
            isActive={isAll}
            onClick={() => onModulesChange(null)}
          />
          {modules.map((mod) => (
            <ModuleChip
              key={mod.id}
              module={mod}
              isActive={!isAll && activeModules.includes(mod.id)}
              onClick={() => toggleModule(mod.id)}
            />
          ))}
        </div>
      </div>

      {/* ---- Filtros avanzados ---- */}
      <div>
        <button
          type="button"
          onClick={onToggleFilters}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Icon name={showFilters ? 'FaChevronUp' : 'FaChevronDown'} className="text-xs" />
          Filtros avanzados
          {hasActiveStatuses && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
              {activeStatuses.length}
            </span>
          )}
        </button>

        {showFilters && (
          <div className="
            mt-3 p-4
            bg-gray-50 dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-xl space-y-4
          ">

            {/* Ordenar + Límite */}
            <div className="flex flex-wrap gap-6 items-end">

              {/* Ordenar por */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Ordenar por
                </label>
                <div className="flex gap-1">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onSortChange(opt.value)}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm border transition-colors
                        ${sortOrder === opt.value
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resultados por sección */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Resultados por sección
                </label>
                <div className="flex gap-1">
                  {limitOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onLimitChange(n)}
                      className={`
                        w-10 py-1.5 rounded-lg text-sm border transition-colors
                        ${resultLimit === n
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                        }
                      `}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Separador */}
            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Estado */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Filtrar por estado
                </label>
                {hasActiveStatuses && (
                  <button
                    type="button"
                    onClick={() => onStatusesChange([])}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DISPLAY_STATUS_OPTIONS.map((opt) => (
                  <StatusPill
                    key={opt.value}
                    option={opt}
                    isActive={activeStatuses.includes(opt.value)}
                    onClick={() => toggleStatus(opt.value)}
                  />
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default GlobalSearchFilters;