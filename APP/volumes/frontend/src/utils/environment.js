/**
 * utils/environment.js
 * Manejador centralizado de variables de entorno de Vite
 * Simple y directo - sin sobre-ingeniería
 */

// ==========================================
// VARIABLES DE ENTORNO
// ==========================================

const env = {
  // Información básica de la app
  NODE_ENV: import.meta.env.MODE || 'development',
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,

  // Variables personalizadas del .env
  FRONTEND_ENV: import.meta.env.VITE_FRONTEND_ENV || 'development',
  FRONTEND_VERSION: import.meta.env.VITE_FRONTEND_VERSION || '1.0.0',
  FRONTEND_NAME: import.meta.env.VITE_FRONTEND_NAME || 'Inventario System',

  // Configuración de red
  FRONTEND_PORT: import.meta.env.VITE_FRONTEND_PORT || '3000',
  FRONTEND_HOST: import.meta.env.VITE_FRONTEND_HOST || 'localhost',

  // URL del backend API (CRÍTICA)
  API_URL: import.meta.env.VITE_FRONTEND_API_URL || 'http://localhost:8000',

  // Variables adicionales que puedas necesitar
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true' || false,
  ENABLE_LOGS: import.meta.env.VITE_ENABLE_LOGS === 'true' || false,

  // Features flags (si las usas)
  ENABLE_DARK_MODE: import.meta.env.VITE_ENABLE_DARK_MODE !== 'false', // true por defecto
  ENABLE_NOTIFICATIONS: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false', // true por defecto
};

// ==========================================
// VALIDACIONES BÁSICAS
// ==========================================

/**
 * Valida que las variables críticas estén presentes
 */
const validateEnvironment = () => {
  const errors = [];

  // API URL es crítica
  if (!env.API_URL) {
    errors.push('VITE_FRONTEND_API_URL is required');
  }

  // Validar formato de API URL
  if (env.API_URL && !isValidUrl(env.API_URL)) {
    errors.push('VITE_FRONTEND_API_URL must be a valid URL');
  }

  // Si hay errores, mostrarlos en desarrollo
  if (errors.length > 0 && env.DEV) {
    console.error('❌ Environment validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.warn('⚠️ App may not work correctly with invalid environment variables');
  }

  return errors.length === 0;
};

/**
 * Validador simple de URL
 */
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// ==========================================
// UTILIDADES
// ==========================================

/**
 * Obtiene el base URL completo del frontend
 */
export const getFrontendBaseUrl = () => {
  if (env.PROD) {
    // En producción, usar la URL actual del navegador
    return window.location.origin;
  }

  // En desarrollo, construir desde las variables
  const protocol = env.FRONTEND_HOST === 'localhost' ? 'http' : 'https';
  return `${protocol}://${env.FRONTEND_HOST}:${env.FRONTEND_PORT}`;
};

/**
 * Obtiene la URL completa de un endpoint del API
 */
export const getApiUrl = (endpoint = '') => {
  const baseUrl = env.API_URL.endsWith('/')
    ? env.API_URL.slice(0, -1)
    : env.API_URL;

  const cleanEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  return `${baseUrl}/api${cleanEndpoint}`;
};

/**
 * Verifica si estamos en desarrollo
 */
export const isDevelopment = () => env.DEV;

/**
 * Verifica si estamos en producción
 */
export const isProduction = () => env.PROD;

/**
 * Verifica si los logs están habilitados
 */
export const shouldLog = () => env.ENABLE_LOGS || env.DEV;

/**
 * Obtiene información de la app
 */
export const getAppInfo = () => ({
  name: env.FRONTEND_NAME,
  version: env.FRONTEND_VERSION,
  environment: env.FRONTEND_ENV,
  nodeEnv: env.NODE_ENV,
  buildTime: new Date().toISOString()
});

/**
 * Obtiene configuración de features
 */
export const getFeatureFlags = () => ({
  darkMode: env.ENABLE_DARK_MODE,
  notifications: env.ENABLE_NOTIFICATIONS,
  debugMode: env.DEBUG_MODE
});

// ==========================================
// DEBUGGING (solo en desarrollo)
// ==========================================

if (env.DEV && env.DEBUG_MODE) {
  console.group('🔧 Environment Configuration');
  //console.log('Environment:', env.FRONTEND_ENV);
  //console.log('Node Environment:', env.NODE_ENV);
  //console.log('API URL:', env.API_URL);
  //console.log('Frontend URL:', getFrontendBaseUrl());
  //console.log('Features:', getFeatureFlags());
  console.groupEnd();
}

// ==========================================
// VALIDAR AL CARGAR
// ==========================================

// Validar variables al importar el módulo
validateEnvironment();

// ==========================================
// EXPORTACIONES
// ==========================================

// Export individual de variables más usadas
export const {
  NODE_ENV,
  DEV,
  PROD,
  API_URL,
  FRONTEND_NAME,
  FRONTEND_VERSION,
  DEBUG_MODE
} = env;

// Export del objeto completo
export const environment = env;

// Export por defecto con todas las utilidades
export default {
  ...env,

  // Utilidades
  getFrontendBaseUrl,
  getApiUrl,
  isDevelopment,
  isProduction,
  shouldLog,
  getAppInfo,
  getFeatureFlags,

  // Validación
  validateEnvironment,
  isValid: validateEnvironment()
};