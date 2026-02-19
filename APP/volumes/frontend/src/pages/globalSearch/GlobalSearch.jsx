/**
 * GlobalSearch.jsx
 * Página /globalSearch?q=...
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Icon from '@components/ui/icon/iconManager';
import useGlobalSearch, { SEARCH_MODULES } from '@/hooks/useGlobalSearch';
import GlobalSearchSection from './GlobalSearchSection';
import GlobalSearchFilters from './GlobalSearchFilters';
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';

// ====================================
// CONSTANTES
// ====================================
const LIMIT_OPTIONS   = [3, 5, 10, 20];
const DEFAULT_LIMIT   = 5;
const ORDER_OPTIONS   = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'az',        label: 'A → Z'      },
  { value: 'za',        label: 'Z → A'      },
];

// Mapeo canónico: normaliza todos los valores de status a uno de los
// valores que maneja el dropdown, para comparar correctamente.
const STATUS_ALIASES = {
  active:   'activo',
  inactive: 'inactivo',
  // el resto ya está en su forma canónica
};
const normalizeStatus = (s) => STATUS_ALIASES[s] ?? s;

// ====================================
// COMPONENTE PRINCIPAL
// ====================================
const GlobalSearch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { results, isLoading, lastQuery, totalCount, search, clearResults } = useGlobalSearch();

  const [inputValue,    setInputValue]    = useState('');
  const [activeModules, setActiveModules] = useState(null);   // null = todos
  const [activeStatuses,setActiveStatuses]= useState([]);     // [] = todos
  const [resultLimit,   setResultLimit]   = useState(DEFAULT_LIMIT);
  const [sortOrder,     setSortOrder]     = useState('relevance');
  const [showFilters,   setShowFilters]   = useState(false);
  const [hasSearched,   setHasSearched]   = useState(false);

  const inputRef = useRef(null);

  // ---- Leer URL ----
  useEffect(() => {
    const qParam = searchParams.get('q') ?? '';
    if (qParam) {
      setInputValue(qParam);
      triggerSearch(qParam, activeModules, resultLimit);
      setHasSearched(true);
    } else {
      setInputValue('');
      clearResults();
      setHasSearched(false);
    }
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---- Búsqueda ----
  const triggerSearch = useCallback((query, modules, limit) => {
    if (!query.trim()) return;
    search({ query, modules, limit });
    setHasSearched(true);
  }, [search]);

  // ---- Re-búsqueda al cambiar módulos o límite ----
  useEffect(() => {
    if (!hasSearched || !lastQuery) return;
    search({ query: lastQuery, modules: activeModules, limit: resultLimit });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultLimit, activeModules]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    triggerSearch(inputValue, activeModules, resultLimit);
    const params = new URLSearchParams();
    if (inputValue.trim()) params.set('q', inputValue.trim());
    navigate(`/globalSearch?${params.toString()}`, { replace: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') navigate(-1);
  };

  // ---- Ordenar items ----
  const getSortedItems = (items) => {
    if (!items?.length) return [];
    if (sortOrder === 'az') return [...items].sort((a, b) => a.label.localeCompare(b.label));
    if (sortOrder === 'za') return [...items].sort((a, b) => b.label.localeCompare(a.label));
    return items;
  };

  // ---- Filtrar por estado (client-side) ----
  // Si activeStatuses está vacío → muestra todo
  const filterByStatus = (items) => {
    if (!activeStatuses.length) return items;
    return items.filter((item) => {
      const s = normalizeStatus(item.status ?? '');
      return activeStatuses.includes(s);
    });
  };

  // ---- Módulos a mostrar ----
  // Mostramos TODOS los módulos del alcance seleccionado (aunque tengan 0 resultados)
  // para que el usuario vea la sección vacía con su glosa.
  const scopeModules = activeModules
    ? SEARCH_MODULES.filter((m) => activeModules.includes(m.id))
    : SEARCH_MODULES;

  // Aplicar filtro de estado y ordenado a cada módulo
  const getModuleItems = (moduleId) =>
    filterByStatus(getSortedItems(results[moduleId] ?? []));

  // Total con filtro de estado aplicado
  const filteredTotal = scopeModules.reduce(
    (acc, m) => acc + getModuleItems(m.id).length, 0
  );

  return (
    <div className="min-h-full " onKeyDown={handleKeyDown}>
      <div className="p-6 mx-auto space-y-6">

        {/* ---- Search bar ---- */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Icon name="FaMagnifyingGlass" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ej: 'Acme', 'Sprint 1', 'Juan Pérez', 'CRM'..."
              className="
                w-full h-11 pl-11 pr-4
                bg-gray-50 dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-xl text-sm
                text-gray-800 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all
              "
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => { setInputValue(''); clearResults(); setHasSearched(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Icon name="FaXmark" className="text-sm" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex items-center gap-2 px-5 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {isLoading
              ? <Icon name="FaSpinner" className="animate-spin" />
              : <Icon name="FaMagnifyingGlass" />
            }
            Buscar
          </button>
        </form>

        {/* ---- Filtros ---- */}
        <GlobalSearchFilters
          modules={SEARCH_MODULES}
          activeModules={activeModules}
          onModulesChange={setActiveModules}
          activeStatuses={activeStatuses}
          onStatusesChange={setActiveStatuses}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          resultLimit={resultLimit}
          onLimitChange={setResultLimit}
          limitOptions={LIMIT_OPTIONS}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          sortOptions={ORDER_OPTIONS}
        />

        {/* ---- Sin búsqueda aún ---- */}
        {!hasSearched && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <Icon name="FaMagnifyingGlass" className="text-4xl mx-auto mb-3" />
            <p className="text-sm">Ingresa un término y presiona Buscar</p>
          </div>
        )}

        {/* ---- Cargando ---- */}
        {isLoading && <PageLoadingSpinner message="Buscando..." />}

        {/* ---- Resultados ---- */}
        {!isLoading && hasSearched && (
          <>
            {/* Resumen */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredTotal > 0 ? (
                  <>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{filteredTotal}</span>
                    {' '}resultado{filteredTotal !== 1 ? 's' : ''} para{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">"{lastQuery}"</span>
                    {activeStatuses.length > 0 && (
                      <span className="ml-1 text-gray-400">(filtrado por estado)</span>
                    )}
                  </>
                ) : (
                  <>Sin resultados para{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">"{lastQuery}"</span>
                  </>
                )}
              </p>
            </div>

            {/* Secciones */}
            <div className="space-y-4">
              {scopeModules.map((mod) => (
                <GlobalSearchSection
                  key={mod.id}
                  module={mod}
                  items={getModuleItems(mod.id)}
                  limit={resultLimit}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default GlobalSearch;