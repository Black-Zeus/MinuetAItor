/**
 * useGlobalSearch.js
 * Hook centralizado de búsqueda global
 * Fuentes: localStorage (fallback a JSON) para cada módulo
 */

import { useState, useCallback } from 'react';

// Data JSONs (fallback)
import dataClientes from '@/data/dataClientes.json';
import dataProjectos from '@/data/dataProjectos.json';
import dataTags from '@/data/dataTags.json';
import dataTeams from '@/data/dataTeams.json';
import dataMinutes from '@/data/minutes.json';
import analysisProfiles from '@/data/analysisProfilesCatalog.json';

// ====================================
// STORAGE KEYS (deben coincidir con cada módulo)
// ====================================
const STORAGE_KEYS = {
  clientes:  'minuteAItor-clientes',
  proyectos: 'minuteAItor-proyectos',
  tags:      'minuteAItor-tags',
  teams:     'minuteAItor-teams',
  minutes:   'minuteAItor-minutes',
  profiles:  'minuteAItor-profiles',
};

// ====================================
// HELPERS
// ====================================
const normalize = (v) => String(v ?? '').toLowerCase().trim();

const loadFromStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const matchesQuery = (item, query) => {
  const q = normalize(query);
  return Object.values(item).some((val) =>
    normalize(val).includes(q)
  );
};

// ====================================
// BUSCADORES POR MÓDULO
// ====================================

const searchClientes = (query) => {
  const data = loadFromStorage(STORAGE_KEYS.clientes, dataClientes?.clients ?? []);
  return data
    .filter((c) => matchesQuery(c, query))
    .map((c) => ({
      id:          c.id,
      label:       c.name ?? c.nombre ?? '',
      sublabel:    c.industry ?? c.sector ?? '',
      meta:        c.status ?? '',
      company:     c.company ?? '',
      phone:       c.phone ?? '',
      email:       c.email ?? '',
      position:    c.position ?? '',
      status:      c.status ?? '',
      isConfidential: c.isconfidential ?? false,
      navigateTo:  '/clients',
      rawData:     c,
    }));
};

const searchProyectos = (query) => {
  const data = loadFromStorage(STORAGE_KEYS.proyectos, dataProjectos?.projects ?? []);
  return data
    .filter((p) => matchesQuery(p, query))
    .map((p) => ({
      id:          p.id,
      label:       p.name ?? p.nombre ?? '',
      sublabel:    p.client ?? '',
      meta:        p.status ?? '',
      client:      p.client ?? '',
      description: p.description ?? p.descripcion ?? '',
      status:      p.status ?? '',
      isConfidential: p.isconfidential ?? false,
      navigateTo:  '/projects',
      rawData:     p,
    }));
};

const searchMinutes = (query) => {
  const data = loadFromStorage(STORAGE_KEYS.minutes, dataMinutes?.minutes ?? []);
  return data
    .filter((m) => matchesQuery(m, query))
    .map((m) => ({
      id:       m.id,
      label:    m.title ?? m.titulo ?? '',
      sublabel: m.summary ?? m.descripcion ?? '',
      meta:     m.date ?? m.fecha ?? '',
      status:   m.status ?? '',          // primer nivel — para badge y lógica
      date:     m.date ?? m.fecha ?? '', // primer nivel — para columna fecha
      isConfidential: m.isconfidential ?? false,
      navigateTo: `/minutes/process/${m.id}`,
      rawData:  m,
    }));
};

const searchTeams = (query) => {
  const data = loadFromStorage(STORAGE_KEYS.teams, dataTeams?.teams ?? []);  // FIX: .teams no .members
  return data
    .filter((t) => matchesQuery(t, query))
    .map((t) => ({
      id:         t.id,
      label:      t.name ?? '',
      sublabel:   t.position ?? '',
      meta:       t.email ?? '',
      position:   t.position ?? '',
      email:      t.email ?? '',
      department: t.department ?? '',
      systemRole: t.systemRole ?? '',
      status:     t.status ?? '',
      isConfidential: false,
      navigateTo: '/teams',
      rawData:    t,
    }));
};

const searchTags = (query) => {
  const data = loadFromStorage(STORAGE_KEYS.tags, dataTags?.tags ?? dataTags ?? []);
  return data
    .filter((t) => matchesQuery(t, query))
    .map((t) => ({
      id:          t.id,
      label:       t.name ?? t.nombre ?? '',
      sublabel:    t.description ?? t.descripcion ?? '',
      meta:        t.status ?? '',
      category:    t.category ?? t.categoria ?? '',
      status:      t.status ?? '',
      description: t.description ?? t.descripcion ?? '',
      isConfidential: false,
      navigateTo:  '/settings/tags',
      rawData:     t,
    }));
};

const searchProfiles = (query) => {
  const data = loadFromStorage(STORAGE_KEYS.profiles, analysisProfiles ?? []);
  return data
    .filter((p) => matchesQuery(p, query))
    .map((p) => {
      const isActive = p.status === true || p.status === 'activo' || p.status === 'active';
      return {
        id:          p.id,
        label:       p.nombre ?? p.name ?? '',
        sublabel:    p.categoria ?? p.category ?? '',
        meta:        isActive ? 'Activo' : 'Inactivo',
        categoria:   p.categoria ?? p.category ?? '',
        status:      isActive ? 'active' : 'inactive',
        description: p.descripcion ?? p.description ?? '',
        isConfidential: false,
        navigateTo:  '/settings/profiles',
        rawData:     p,
      };
    });
};

// ====================================
// MÓDULOS DISPONIBLES
// ====================================
export const SEARCH_MODULES = [
  { id: 'clientes',  label: 'Clientes',    icon: 'FaBuilding',      fn: searchClientes  },
  { id: 'proyectos', label: 'Proyectos',   icon: 'FaFolderOpen',    fn: searchProyectos },
  { id: 'minutes',   label: 'Minutas',     icon: 'FaFileAlt',       fn: searchMinutes   },
  { id: 'teams',     label: 'Equipos',     icon: 'FaUsers',         fn: searchTeams     },
  { id: 'tags',      label: 'Etiquetas',   icon: 'FaTag',           fn: searchTags      },
  { id: 'profiles',  label: 'Perfiles IA', icon: 'FaBrain',         fn: searchProfiles  },
];

// ====================================
// HOOK
// ====================================
const DEFAULT_LIMIT = 5;

const useGlobalSearch = () => {
  const [results,    setResults]    = useState({});   // { moduleId: [...items] }
  const [isLoading,  setIsLoading]  = useState(false);
  const [lastQuery,  setLastQuery]  = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const search = useCallback(({ query, modules = null, limit = DEFAULT_LIMIT }) => {
    const q = query.trim();
    if (!q) {
      setResults({});
      setLastQuery('');
      setTotalCount(0);
      return;
    }

    setIsLoading(true);
    setLastQuery(q);

    // Módulos activos según filtro (o todos si null)
    const activeModules = modules
      ? SEARCH_MODULES.filter((m) => modules.includes(m.id))
      : SEARCH_MODULES;

    const newResults = {};
    let total = 0;

    activeModules.forEach((mod) => {
      const found = mod.fn(q);
      newResults[mod.id] = found.slice(0, limit);
      total += found.length;
    });

    setResults(newResults);
    setTotalCount(total);
    setIsLoading(false);
  }, []);

  const clearResults = useCallback(() => {
    setResults({});
    setLastQuery('');
    setTotalCount(0);
  }, []);

  return {
    results,
    isLoading,
    lastQuery,
    totalCount,
    search,
    clearResults,
  };
};

export default useGlobalSearch;