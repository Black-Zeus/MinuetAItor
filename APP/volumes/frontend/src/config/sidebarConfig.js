/**
 * sidebarConfig.js
 * Configuración centralizada de módulos del sidebar
 */

export const SIDEBAR_MODULES = [
  // ====================================
  // CORE - Operaciones Principales
  // ====================================
  {
    id: 'dashboard',
    name: 'Inicio',
    icon: 'FaHouse',
    path: '/dashboard',
    section: 'core',
    order: 1
  },
  {
    id: 'minutes',
    name: 'Minutas',
    icon: 'FaRegFileLines',
    path: '/minutes',
    section: 'core',
    order: 2
  },

  // ====================================
  // GESTIÓN - Administración de Entidades
  // ====================================
  {
    id: 'clients',
    name: 'Clientes',
    icon: 'FaBuilding',
    path: '/clients',
    section: 'management',
    order: 3
  },
  {
    id: 'projects',
    name: 'Proyectos',
    icon: 'FaLayerGroup',
    path: '/projects',
    section: 'management',
    order: 4
  },
  {
    id: 'team',
    name: 'Equipo',
    icon: 'FaUsers',
    path: '/teams',
    section: 'management',
    order: 5,
    requiresAdmin: true
  },
  {
    id: 'participants',
    name: 'Participantes',
    icon: 'FaUser',
    path: '/participants',
    section: 'management',
    order: 6
  },

  // ====================================
  // INTELIGENCIA - Análisis y Datos
  // ====================================
  {
    id: 'metrics',
    name: 'Métricas',
    icon: 'FaChartLine',
    path: '/analytics/metrics',
    section: 'intelligence',
    order: 7
  },

  /**
   * ✅ Auditoría (nuevo)
   * - reportes básicos de auditoría / compliance / seguridad
   */
  {
    id: 'audit',
    name: 'Auditoría',
    icon: 'FaClipboardCheck',
    section: 'intelligence',
    order: 8,
    children: [
      {
        id: 'audit-overview',
        name: 'Resumen',
        icon: 'FaGaugeHigh',
        path: '/analytics/audit/overview',
        order: 1
      },
      {
        id: 'audit-access',
        name: 'Accesos',
        icon: 'FaUserShield',
        path: '/analytics/audit/access',
        order: 2
      },
      {
        id: 'audit-changes',
        name: 'Cambios',
        icon: 'FaCodeBranch',
        path: '/analytics/audit/changes',
        order: 3
      },
      {
        id: 'audit-sessions',
        name: 'Sesiones',
        icon: 'FaClockRotateLeft',
        path: '/analytics/audit/sessions',
        order: 4
      },
      {
        id: 'audit-exceptions',
        name: 'Excepciones',
        icon: 'FaTriangleExclamation',
        path: '/analytics/audit/exceptions',
        order: 5
      }
    ]
  },

  // ====================================
  // REPORTES - Entregables / Exportables
  // ====================================
  {
    id: 'reports',
    name: 'Reportes',
    icon: 'FaRegFile',
    section: 'intelligence',
    order: 9,
    children: [
      // Reportes típicos (operacionales / gestión)
      {
        id: 'reports-projects',
        name: 'Proyectos',
        icon: 'FaDiagramProject',
        path: '/reports/projects',
        order: 1
      },
      {
        id: 'reports-minutes',
        name: 'Minutas',
        icon: 'FaFileLines',
        path: '/reports/minutes',
        order: 2
      },
      {
        id: 'reports-actions',
        name: 'Acciones',
        icon: 'FaListCheck',
        path: '/reports/actions',
        order: 3
      },
      {
        id: 'reports-kpis',
        name: 'KPIs',
        icon: 'FaChartPie',
        path: '/reports/kpis',
        order: 4
      },
      {
        id: 'reports-export',
        name: 'Exportación',
        icon: 'FaFileExport',
        path: '/reports/export',
        order: 5
      }
    ]
  },

  // ====================================
  // CONFIGURACIÓN - Sistema y Usuario
  // ====================================
  {
    id: 'tags',
    name: 'Etiquetas',
    icon: 'FaTags',
    path: '/settings/tags',
    section: 'config',
    order: 10
  },
  {
    id: 'profiles',
    name: 'Perfiles AI',
    icon: 'FaBrain',
    path: '/settings/profiles',
    section: 'config',
    order: 11
  },
  {
    id: 'organization',
    name: 'Organización',
    icon: 'FaBuilding',
    path: '/settings/organization',
    section: 'config',
    order: 12,
    requiresAdmin: true
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: 'FaGears',
    path: '/settings/system',
    section: 'config',
    order: 13,
    requiresAdmin: true
  }
];

// ====================================
// DEFINICIÓN DE SECCIONES
// ====================================
export const SIDEBAR_SECTIONS = {
  core: {
    id: 'core',
    title: 'Principal',
    order: 1,
    color: 'primary'
  },
  management: {
    id: 'management',
    title: 'Gestión',
    order: 2,
    color: 'blue'
  },
  intelligence: {
    id: 'intelligence',
    title: 'Análisis',
    order: 3,
    color: 'purple'
  },
  config: {
    id: 'config',
    title: 'Configuración',
    order: 4,
    color: 'gray'
  }
};

/**
 * Filtra módulos según permisos del usuario (soporta children)
 */
export const filterModulesByPermissions = (modules = SIDEBAR_MODULES, user = {}) => {
  const filterRecursively = (items = []) => {
    return items
      .filter((module) => {
        if (module.requiresAdmin && !user.isAdmin) return false;
        return true;
      })
      .map((module) => {
        if (Array.isArray(module.children) && module.children.length > 0) {
          const children = filterRecursively(module.children);
          return { ...module, children };
        }
        return module;
      })
      // Si un padre queda sin hijos y no tiene path, no mostrar
      .filter((module) => {
        const hasChildren = Array.isArray(module.children) && module.children.length > 0;
        if (!module.path && !hasChildren) return false;
        return true;
      });
  };

  return filterRecursively(modules);
};
