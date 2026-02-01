/**
 * constants/index.js
 * Manejador centralizado de constantes del sistema
 * Escalable y organizado por categorías
 */

// ==========================================
// API & ENDPOINTS
// ==========================================
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    BASE: '/auth',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VALIDATE_TOKEN: '/auth/validate-token',
    CHANGE_PASSWORD: '/auth/change-password',
    CHANGE_PASSWORD_ADMIN: '/auth/change-password-by-admin',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password'
  },
  
  // Usuarios (ejemplo para expandir)
  USERS: {
    BASE: '/users',
    LIST: '/users',
    PROFILE: '/users/profile',
    CREATE: '/users',
    UPDATE: '/users',
    DELETE: '/users'
  },
  
  // Warehouse (basado en permisos de tu backend)
  WAREHOUSE: {
    BASE: '/warehouse',
    ZONES: '/warehouse/zones',
    ACCESS: '/warehouse/access',
    LOCATIONS: '/warehouse/locations'
  },
  
  // Returns (basado en permisos de tu backend)
  RETURNS: {
    BASE: '/returns',
    CREATE: '/returns',
    PROCESS: '/returns/process',
    APPROVE: '/returns/approve'
  }
};

// ==========================================
// HTTP STATUS CODES
// ==========================================
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};


// ==========================================
// VALIDATION CONSTANTS
// ==========================================
export const VALIDATION = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true
  },
  
  // Username requirements
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9._-]+$/
  },
  
  // Email
  EMAIL: {
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // General field lengths
  FIELD_LENGTHS: {
    SHORT_TEXT: 50,
    MEDIUM_TEXT: 255,
    LONG_TEXT: 1000,
    DESCRIPTION: 2000
  }
};


// ==========================================
// NOTIFICATION TYPES
// ==========================================
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// ==========================================
// ROUTES (para react-router)
// ==========================================
export const ROUTES = {
  // Public routes
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  
  // Protected routes
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  
  // Admin routes
  ADMIN: '/admin',
  USERS_MANAGEMENT: '/admin/users',
  
  // Warehouse routes
  WAREHOUSE: '/warehouse',
  WAREHOUSE_ZONES: '/warehouse/zones',
  WAREHOUSE_ACCESS: '/warehouse/access',
  
  // Returns routes
  RETURNS: '/returns',
  RETURNS_CREATE: '/returns/create',
  RETURNS_PROCESS: '/returns/process'
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Obtiene una constante por path usando dot notation
 * Ejemplo: getConstant('API_ENDPOINTS.AUTH.LOGIN') => '/auth/login'
 */
export const getConstant = (path) => {
  return path.split('.').reduce((obj, key) => obj?.[key], {
    API_ENDPOINTS,
    HTTP_STATUS,
    VALIDATION,
    NOTIFICATION_TYPES,
    ROUTES
  });
};

/**
 * Verifica si un valor existe en una constante
 * Ejemplo: hasConstant('USER_ROLES', 'ADMIN') => true
 */
export const hasConstant = (category, value) => {
  const constants = {
    NOTIFICATION_TYPES
  };
  
  const categoryValues = Object.values(constants[category] || {});
  return categoryValues.includes(value);
};

/**
 * Obtiene todas las constantes de una categoría como array
 * Ejemplo: getConstantsArray('USER_ROLES') => ['ADMIN', 'MANAGER', 'USER']
 */
export const getConstantsArray = (category) => {
  const constants = {
    NOTIFICATION_TYPES
  };
  
  return Object.values(constants[category] || {});
};

// ==========================================
// EXPORT DEFAULT (para importación fácil)
// ==========================================
export default {
  API_ENDPOINTS,
  HTTP_STATUS,
  VALIDATION,
  NOTIFICATION_TYPES,
  ROUTES,
  
  // Utility functions
  getConstant,
  hasConstant,
  getConstantsArray
};