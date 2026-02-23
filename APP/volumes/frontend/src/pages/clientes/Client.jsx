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
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';

import logger from '@/utils/logger';

const clientLog = logger.scope('client');

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
          const t = new Date(v ?? 0).getTime();
          return Number.isFinite(t) ? t : 0;
        };
        result.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
        break;
      }
    }

    return result;
  }, [clients, filters, sortBy]);

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
        onApplyFilters={() => clientLog.log('[Client] Filtros:', filters)}
      />

      <ClientStats stats={stats} />

      <ClientGrid
        clients={filteredClients}
        onUpdate={handleUpdateClient}
        onDelete={handleDeleteClient}
        hasFilters={hasFilters}
      />

      {/* Si tienes UI de sort, conéctala a setSortBy */}
      {/* <SortSelector value={sortBy} onChange={setSortBy} /> */}

    </div>
  );
};

export default Client;