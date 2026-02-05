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
    icon: 'FaHome',
    path: '/dashboard',
    section: 'core',
    order: 1
  },
  {
    id: 'minutes',
    name: 'Minutas',
    icon: 'FaRegFileLines',
    path: '/minutas',
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
    path: '/clientes',
    section: 'management',
    order: 3
  },
  {
    id: 'projects',
    name: 'Proyectos',
    icon: 'FaLayerGroup',
    path: '/proyectos',
    section: 'management',
    order: 4
  },
  {
    id: 'team',
    name: 'Equipo',
    icon: 'FaUsers',
    path: '/equipo',
    section: 'management',
    order: 5
  },

  // ====================================
  // INTELIGENCIA - Análisis y Datos
  // ====================================
  {
    id: 'metrics',
    name: 'Métricas',
    icon: 'FaChartLine',
    path: '/metricas',
    section: 'intelligence',
    order: 6
  },
  {
    id: 'reports',
    name: 'Reportes',
    icon: 'FaFileAlt',
    path: '/reportes',
    section: 'intelligence',
    order: 7
  },

  // ====================================
  // CONFIGURACIÓN - Sistema y Usuario
  // ====================================
  {
    id: 'tags',
    name: 'Etiquetas',
    icon: 'FaTags',
    path: '/etiquetas',
    section: 'config',
    order: 8
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: 'FaCog',
    path: '/configuracion/sistema',
    section: 'config',
    order: 9,
    requiresAdmin: true
  },

  // ====================================
  // DEMOS - Componentes / Ejemplos (AL FINAL)
  // ====================================
  {
    id: 'demos',
    name: 'Demos',
    icon: 'FaCog',
    section: 'demos',
    order: 100,
    children: [
      {
        id: 'demo-general',
        name: 'General',
        icon: 'FaFileAlt',
        path: '/demo/general',
        order: 1
      },
      {
        id: 'demo-modal',
        name: 'Modal',
        icon: 'FaRegFileAlt',
        path: '/demo/modal',
        order: 2
      },

      // ✅ Demos de error pages
      {
        id: 'demo-403',
        name: '403 Forbidden',
        icon: 'FaBan',
        path: '/demo/forbidden',
        order: 3
      },
      {
        id: 'demo-404',
        name: '404 Not Found',
        icon: 'FaQuestionCircle',
        path: '/demo/not-found',
        order: 4
      },
      {
        id: 'demo-500',
        name: '500 Server Error',
        icon: 'FaBug',
        path: '/demo/server-error',
        order: 5
      }
    ]
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
  },
  demos: {
    id: 'demos',
    title: 'Demos',
    order: 999,
    color: 'emerald'
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
