/**
 * Client.jsx
 * Componente monolítico para gestión de clientes - 100% Tailwind CSS
 * Patrón: Componente autocontenido sin layout, solo importa lo esencial
 */

import React, { useState, useEffect } from 'react';
import clientsData from '@/data/dataClientes.json';
import ClientHeader from './ClientHeader';
import ClientFilters from './ClientFilters';
import ClientStats from './ClientStats';
import ClientGrid from './ClientGrid';
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';

import logger from '@/utils/logger';
const clientLog = logger.scope("client");

const Client = () => {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    industry: '',
    priority: ''
  });
  
  // Sort
  const [sortBy, setSortBy] = useState('recent');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    prospectos: 0,
    inactivos: 0
  });

  // Load data
  useEffect(() => {
    const loadClients = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setClients(clientsData.clients || []);
        setFilteredClients(clientsData.clients || []);
        calculateStats(clientsData.clients || []);
      } catch (error) {
        clientLog.error('[Clientes] Error loading clients:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadClients();
  }, []);

  // Calculate stats
  const calculateStats = (clientsList) => {
    const stats = {
      total: clientsList.length,
      activos: clientsList.filter(c => c.status === 'activo').length,
      prospectos: clientsList.filter(c => c.status === 'prospecto').length,
      inactivos: clientsList.filter(c => c.status === 'inactivo').length
    };
    setStats(stats);
  };

  // Filter clients
  useEffect(() => {
    let filtered = [...clients];

    // Search
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        client.company.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(client => client.status === filters.status);
    }

    // Industry filter
    if (filters.industry) {
      filtered = filtered.filter(client => client.industry === filters.industry);
    }

    // Priority filter
    if (filters.priority) {
      filtered = filtered.filter(client => client.priority === filters.priority);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'company':
        filtered.sort((a, b) => a.company.localeCompare(b.company));
        break;
      case 'projects':
        filtered.sort((a, b) => b.projects - a.projects);
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    setFilteredClients(filtered);
  }, [filters, sortBy, clients]);

  // Client handlers
  // Nota: este handler representa una *actualización* del registro (no solo "editar")
  const handleUpdateClient = (updatedClient) => {
    const updatedClients = clients.map(c =>
      c.id === updatedClient.id ? updatedClient : c
    );
    setClients(updatedClients);
    calculateStats(updatedClients);
  };

  const handleDeleteClient = (clientId) => {
    const updatedClients = clients.filter(c => c.id !== clientId);
    setClients(updatedClients);
    calculateStats(updatedClients);
  };

  // Filter handlers
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      industry: '',
      priority: ''
    });
  };

  const handleApplyFilters = () => {
    // Los filtros se aplican automáticamente vía useEffect
    clientLog.log('[Client] Filtros aplicados:', filters);
  };

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Clientes..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <ClientHeader />

      {/* Filters */}
      <ClientFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={{}} // Datos para opciones de filtros si necesitas
      />

      {/* Stats Cards */}
      <ClientStats stats={stats} />

      {/* Clients Grid */}
      <ClientGrid
        clients={filteredClients}
        onUpdate={handleUpdateClient}
        onDelete={handleDeleteClient}
        hasFilters={!!(filters.search || filters.status || filters.industry || filters.priority)}
      />
    </div>
  );
};

export default Client;