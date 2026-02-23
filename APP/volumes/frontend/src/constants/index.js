/**
 * constants/index.js
 * Manejador centralizado de constantes del sistema
 *
 * Cambios v2:
 *  - API_VERSION agregado como constante central
 *  - Todos los endpoints llevan prefijo /v1 (requerido por el backend FastAPI)
 *  - Agregados: AUTH.ME, AUTH.VALIDATE_TOKEN, AUTH.CHANGE_PASSWORD_ADMIN
 */

// ==========================================
// API VERSION — cambiar aquí si el backend sube a v2
// ==========================================
const API_VERSION = '/v1';

// ==========================================
// API & ENDPOINTS
// ==========================================
export const API_ENDPOINTS = {

  AUTH: {
    BASE: `${API_VERSION}/auth`,
    LOGIN: `${API_VERSION}/auth/login`,
    LOGOUT: `${API_VERSION}/auth/logout`,
    REFRESH: `${API_VERSION}/auth/refresh`,
    ME: `${API_VERSION}/auth/me`,
    VALIDATE_TOKEN: `${API_VERSION}/auth/validate-token`,
    CHANGE_PASSWORD: `${API_VERSION}/auth/change-password`,
    CHANGE_PASSWORD_ADMIN: `${API_VERSION}/auth/change-password-by-admin`,
    FORGOT_PASSWORD: `${API_VERSION}/auth/forgot-password`,
    RESET_PASSWORD: `${API_VERSION}/auth/reset-password`,
  },

  USERS: {
    BASE: `${API_VERSION}/users`,
    LIST: `${API_VERSION}/users`,
    PROFILE: `${API_VERSION}/users/profile`,
    CREATE: `${API_VERSION}/users`,
    UPDATE: `${API_VERSION}/users`,
    DELETE: `${API_VERSION}/users`,
  },

  // En API_ENDPOINTS, agregar:
  CLIENTS: {
    BASE: `${API_VERSION}/clients`,
    LIST: `${API_VERSION}/clients/list`,
    CREATE: `${API_VERSION}/clients`,
    UPDATE: `${API_VERSION}/clients`,
    DELETE: `${API_VERSION}/clients`,
    INDUSTRY: `${API_VERSION}/clients/industries`,    
  },
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
  SERVICE_UNAVAILABLE: 503,
};

// ==========================================
// VALIDATION CONSTANTS
// ==========================================
export const VALIDATION = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9._-]+$/,
  },
  EMAIL: {
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  FIELD_LENGTHS: {
    SHORT_TEXT: 50,
    MEDIUM_TEXT: 255,
    LONG_TEXT: 1000,
    DESCRIPTION: 2000,
  },
};

// ==========================================
// NOTIFICATION TYPES
// ==========================================
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// ==========================================
// ROUTES (react-router)
// ==========================================
export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ADMIN: '/admin',
  USERS_MANAGEMENT: '/admin/users',
  WAREHOUSE: '/warehouse',
  WAREHOUSE_ZONES: '/warehouse/zones',
  WAREHOUSE_ACCESS: '/warehouse/access',
  RETURNS: '/returns',
  RETURNS_CREATE: '/returns/create',
  RETURNS_PROCESS: '/returns/process',
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export const getConstant = (path) => {
  return path.split('.').reduce((obj, key) => obj?.[key], {
    API_ENDPOINTS,
    HTTP_STATUS,
    VALIDATION,
    NOTIFICATION_TYPES,
    ROUTES,
  });
};

export const hasConstant = (category, value) => {
  const constants = { NOTIFICATION_TYPES };
  return Object.values(constants[category] || {}).includes(value);
};

export const getConstantsArray = (category) => {
  const constants = { NOTIFICATION_TYPES };
  return Object.values(constants[category] || {});
};

// ==========================================
// EXPORT DEFAULT
// ==========================================
export default {
  API_ENDPOINTS,
  HTTP_STATUS,
  VALIDATION,
  NOTIFICATION_TYPES,
  ROUTES,
  getConstant,
  hasConstant,
  getConstantsArray,
};