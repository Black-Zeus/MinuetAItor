/**
 * Project.jsx
 * Componente monolítico para gestión de proyectos - 100% Tailwind CSS
 * Patrón: Componente autocontenido sin layout, solo importa lo esencial
 */

import React, { useState, useEffect } from 'react';
import projectsData from '@/data/dataProjectos.json';
import ProjectHeader from './ProjectHeader';
import ProjectFilters from './ProjectFilters';
import ProjectStats from './ProjectStats';
import ProjectGrid from './ProjectGrid';

const Project = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    client: ''
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    inactivos: 0,
    totalMinutas: 0
  });

  // Load data
  useEffect(() => {
    const loadProjects = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setProjects(projectsData.projects || []);
        setFilteredProjects(projectsData.projects || []);
        calculateStats(projectsData.projects || []);
      } catch (error) {
        console.error('[Proyectos] Error loading projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProjects();
  }, []);

  // Calculate stats
  const calculateStats = (projectsList) => {
    const stats = {
      total: projectsList.length,
      activos: projectsList.filter(p => p.status === 'activo').length,
      inactivos: projectsList.filter(p => p.status === 'inactivo').length,
      totalMinutas: projectsList.reduce((sum, p) => sum + (p.minutas || 0), 0)
    };
    setStats(stats);
  };

  // Filter projects
  useEffect(() => {
    let filtered = [...projects];

    // Search
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(term) ||
        project.client.toLowerCase().includes(term) ||
        (project.description && project.description.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(project => project.status === filters.status);
    }

    // Client filter
    if (filters.client) {
      filtered = filtered.filter(project => project.client === filters.client);
    }

    setFilteredProjects(filtered);
  }, [filters, projects]);

  // Project handlers
  const handleEditProject = (updatedProject) => {
    const updatedProjects = projects.map(p =>
      p.id === updatedProject.id ? updatedProject : p
    );
    setProjects(updatedProjects);
    calculateStats(updatedProjects);
  };

  const handleDeleteProject = (projectId) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    calculateStats(updatedProjects);
  };

  // Filter handlers
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      client: ''
    });
  };

  const handleApplyFilters = () => {
    // Los filtros se aplican automáticamente vía useEffect
    console.log('[Project] Filtros aplicados:', filters);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <ProjectHeader />

      {/* Filters */}
      <ProjectFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={{}} // Datos para opciones de filtros si necesitas
      />

      {/* Stats Cards */}
      <ProjectStats stats={stats} />

      {/* Projects Grid */}
      <ProjectGrid
        projects={filteredProjects}
        onEdit={handleEditProject}
        onDelete={handleDeleteProject}
        hasFilters={!!(filters.search || filters.status || filters.client)}
      />
    </div>
  );
};

export default Project;