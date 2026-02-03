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
    requiresAdmin: true // Solo administradores
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
 * Agrupa los módulos por sección
 * @param {Array} modules - Lista de módulos
 * @returns {Object} Módulos agrupados por sección
 */
export const groupModulesBySection = (modules = SIDEBAR_MODULES) => {
  return modules.reduce((acc, module) => {
    const section = module.section || 'other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(module);
    return acc;
  }, {});
};

/**
 * Filtra módulos según permisos del usuario
 * @param {Array} modules - Lista de módulos
 * @param {Object} user - Usuario actual
 * @returns {Array} Módulos filtrados
 */
export const filterModulesByPermissions = (modules = SIDEBAR_MODULES, user = {}) => {
  return modules.filter(module => {
    // Si requiere admin y el usuario no es admin, no mostrar
    if (module.requiresAdmin && !user.isAdmin) {
      return false;
    }
    return true;
  });
};