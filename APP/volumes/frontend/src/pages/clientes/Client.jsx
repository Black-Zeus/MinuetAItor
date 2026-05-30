/**
 * Client.jsx
 * Gestión de clientes — migrado de JSON mock a API real
 *
 * Correcciones:
 * - loadClients sale del useEffect (scope correcto).
 * - loadClients memoizado con useCallback para poder invocarlo desde handlers.
 * - handlers CRUD refrescan de forma consistente (optimista + refresh real).
 * - manejo de estado de loading/error sin “colgar” el componente.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clientService from '@/services/clientService';

import ClientHeader from './ClientHeader';
import ClientFilters from './ClientFilters';
import ClientStats from './ClientStats';
import ClientGrid from './ClientGrid';
import ClientListView from './ClientListView';
import ClientTableView from './ClientTableView';
import CatalogBasePagination from '@/components/common/CatalogBasePagination';
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';
import CatalogViewBar from '@/components/common/CatalogViewBar';
import CatalogPagePagination from '@/components/common/CatalogPagePagination';
import useModuleViewMode from '@/hooks/useModuleViewMode';
import { parseAppDate } from '@/utils/formats';

import logger from '@/utils/logger';

const clientLog = logger.scope('client');
const DEFAULT_ITEMS_PER_PAGE = 18;
const TABLE_ITEMS_PER_PAGE = 100;

const Client = () => {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    industry: '',
    priority: '',
  });

  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useModuleViewMode();
  const [page, setPage] = useState(1);
  const itemsPerPage = viewMode === 'table' ? TABLE_ITEMS_PER_PAGE : DEFAULT_ITEMS_PER_PAGE;

  // ─── Loader (API) ───────────────────────────────────────────────────────────

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { items } = await clientService.list({ skip: 0, limit: 100, isActive: true });
      setClients(Array.isArray(items) ? items : []);
    } catch (err) {
      clientLog.error('[Client] Error cargando clientes:', err);
      setError('No se pudieron cargar los clientes. Intenta de nuevo.');
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: clients.length,
    activos: clients.filter(c => !!c.isActive).length,
    prospectos: 0,
    inactivos: clients.filter(c => !c.isActive).length,
  }), [clients]);

  // ─── Filtrado + sort ────────────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(c =>
        String(c.name ?? '').toLowerCase().includes(term) ||
        String(c.description ?? '').toLowerCase().includes(term) ||
        String(c.industry ?? '').toLowerCase().includes(term)
      );
    }

    if (filters.status) {
      // Si tu API maneja "status" como string (activo/inactivo/etc.)
      // ajusta la condición según tu modelo real
      result = result.filter(c =>
        String(c.status ?? '').toLowerCase() === String(filters.status).toLowerCase()
      );
    }

    if (filters.industry) {
      result = result.filter(c =>
        String(c.industry ?? '').toLowerCase() === filters.industry.toLowerCase()
      );
    }

    if (filters.priority) {
      result = result.filter(c =>
        String(c.priority ?? '').toLowerCase() === filters.priority.toLowerCase()
      );
    }

    switch (sortBy) {
      case 'name':
        result.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
        break;

      case 'recent':
      default: {
        const toTime = (v) => {
          const t = parseAppDate(v ?? 0).getTime();
          return Number.isFinite(t) ? t : 0;
        };
        result.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
        break;
      }
    }

    return result;
  }, [clients, filters, sortBy]);
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / itemsPerPage));
  const paginatedClients = useMemo(
    () => filteredClients.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredClients, itemsPerPage, page]
  );

  // ─── Handlers CRUD ──────────────────────────────────────────────────────────
  // Nota: refresco real (API) NO debe depender del cierre de modales.

  const handleCreateClient = useCallback(async (newClient) => {
    // Optimista (opcional)
    if (newClient) setClients(prev => [newClient, ...prev]);

    // Refresco real (asegura consistencia)
    await loadClients();
  }, [loadClients]);

  const handleUpdateClient = useCallback(async (updatedClient) => {
    if (updatedClient?.id) {
      setClients(prev => prev.map(c => (c.id === updatedClient.id ? updatedClient : c)));
    }
    await loadClients();
  }, [loadClients]);

  const handleDeleteClient = useCallback(async (clientId) => {
    if (clientId) {
      setClients(prev => prev.filter(c => c.id !== clientId));
    }
    await loadClients();
  }, [loadClients]);

  // ─── Handlers filtros ───────────────────────────────────────────────────────

  const handleFilterChange = useCallback((filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', status: '', industry: '', priority: '' });
  }, []);

  const handlePageChange = useCallback((nextPage) => {
    if (nextPage >= 1 && nextPage <= totalPages) setPage(nextPage);
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [filters, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return <PageLoadingSpinner message="Cargando Clientes..." />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const hasFilters = !!(filters.search || filters.status || filters.industry || filters.priority);

  return (
    <div className="space-y-6">

      {/* IMPORTANT: onCreated ahora siempre refresca vía loadClients */}
      <ClientHeader onCreated={handleCreateClient} />

      <ClientFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      <ClientStats stats={stats} />

      <CatalogViewBar
        count={filteredClients.length}
        singularLabel="cliente"
        pluralLabel="clientes"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'base' ? (
        <ClientGrid
          clients={paginatedClients}
          onUpdate={handleUpdateClient}
          onDelete={handleDeleteClient}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'list' ? (
        <ClientListView
          clients={paginatedClients}
          onUpdate={handleUpdateClient}
          onDelete={handleDeleteClient}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'table' ? (
        <ClientTableView
          clients={paginatedClients}
          onUpdate={handleUpdateClient}
          onDelete={handleDeleteClient}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'base' ? (
        <CatalogBasePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          total={filteredClients.length}
          itemsPerPage={itemsPerPage}
          singularLabel="cliente"
          pluralLabel="clientes"
        />
      ) : null}

      {viewMode !== 'base' ? (
        <CatalogPagePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      ) : null}

      {/* Si tienes UI de sort, conéctala a setSortBy */}
      {/* <SortSelector value={sortBy} onChange={setSortBy} /> */}

    </div>
  );
};

export default Client;
