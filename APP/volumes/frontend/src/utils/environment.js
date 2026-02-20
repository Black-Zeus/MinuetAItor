/**
 * utils/environment.js
 * Fuente única de verdad para todas las variables de entorno del frontend
 *
 * Convención de defaults:
 *  - Variables críticas (API_URL, etc.)  → default '-'  para detectar que no llegan
 *  - Variables con fallback sensato       → default real (ej: 'localhost', '5173')
 *  - Variables booleanas                  → evaluadas con !== / === sobre el string
 *
 * NOTA sobre console.* en este archivo:
 *  logger.js importa environment.js, por lo que usar logger aquí
 *  generaría una referencia circular. Los console.* de este módulo
 *  son la ÚNICA excepción permitida al uso directo de console en el proyecto.
 */

// ==========================================
// VARIABLES DE ENTORNO RAW
// ==========================================

const _env = {

  // ----- Vite internos -----
  MODE:  import.meta.env.MODE  || 'development',
  DEV:   import.meta.env.DEV   ?? true,
  PROD:  import.meta.env.PROD  ?? false,

  // ----- App info -----
  APP_NAME:    import.meta.env.VITE_FRONTEND_NAME    || '-',
  APP_VERSION: import.meta.env.VITE_FRONTEND_VERSION || '-',
  APP_ENV:     import.meta.env.VITE_FRONTEND_ENV     || '-',

  // ----- Red -----
  FRONTEND_HOST: import.meta.env.VITE_FRONTEND_HOST    || 'localhost',   // fallback real — siempre hay host
  FRONTEND_PORT: import.meta.env.VITE_FRONTEND_PORT    || '5173',        // fallback real — puerto por defecto de Vite
  API_URL:       import.meta.env.VITE_FRONTEND_API_URL || '-',           // crítica — sin fallback real

  // ----- Logger (strings RAW, el logger los interpreta) -----
  LOG_ENABLED:       import.meta.env.VITE_LOG_ENABLED,                          // undefined si no viene → logger decide
  LOG_LEVELS:        import.meta.env.VITE_LOG_LEVELS        || '-',
  LOG_SCOPES:        import.meta.env.VITE_LOG_SCOPES        || '-',
  LOG_DEFAULT_SCOPE: import.meta.env.VITE_LOG_DEFAULT_SCOPE || '-',
  LOG_PREFIX:        import.meta.env.VITE_LOG_PREFIX        || '-',

  // ----- Page Spinner -----
  SPINNER_VARIANT:       import.meta.env.VITE_PAGE_SPINNER_VARIANT       || '-',
  SPINNER_SIZE:          import.meta.env.VITE_PAGE_SPINNER_SIZE          || '-',
  SPINNER_TYPE:          import.meta.env.VITE_PAGE_SPINNER_TYPE          || '-',
  SPINNER_SHOW_PROGRESS: import.meta.env.VITE_PAGE_SPINNER_SHOW_PROGRESS === 'true',   // false por defecto
  SPINNER_INDETERMINATE: import.meta.env.VITE_PAGE_SPINNER_INDETERMINATE !== 'false',  // true por defecto

  // ----- Feature flags -----
  DARK_MODE:     import.meta.env.VITE_ENABLE_DARK_MODE     !== 'false',  // true por defecto
  NOTIFICATIONS: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',  // true por defecto
  DEBUG_MODE:    import.meta.env.VITE_DEBUG_MODE           === 'true',   // false por defecto
};


// ==========================================
// HELPERS DE AMBIENTE
// ==========================================

/** Estamos en desarrollo local */
export const isDev  = () => _env.DEV;

/** Estamos en producción */
export const isProd = () => _env.PROD;

/** Estamos en QA (vite --mode qa) */
export const isQA   = () => _env.MODE === 'qa';

/** Nombre del ambiente actual como string legible */
export const getEnvName = () => {
  if (isProd()) return 'production';
  if (isQA())   return 'qa';
  return 'development';
};

/**
 * Indica si se deben emitir logs en el código de negocio.
 * Mantenido por compatibilidad con imports existentes.
 * Usa isDev() directamente para evitar referencia circular con logger.js.
 */
export const shouldLog = () => isDev() || _env.DEBUG_MODE;


// ==========================================
// API
// ==========================================

/**
 * URL completa de un endpoint del API
 * @example getApiUrl('/auth/login') → 'http://localhost:8000/api/auth/login'
 */
export const getApiUrl = (endpoint = '') => {
  const base  = _env.API_URL.endsWith('/') ? _env.API_URL.slice(0, -1) : _env.API_URL;
  const clean = endpoint.startsWith('/')   ? endpoint                  : `/${endpoint}`;
  return `${base}/api${clean}`;
};

/** Base URL del backend sin path */
export const getApiBaseUrl = () => _env.API_URL;


// ==========================================
// FRONTEND URL
// ==========================================

export const getFrontendBaseUrl = () => {
  if (isProd()) return window.location.origin;
  const protocol = _env.FRONTEND_HOST === 'localhost' ? 'http' : 'https';
  return `${protocol}://${_env.FRONTEND_HOST}:${_env.FRONTEND_PORT}`;
};


// ==========================================
// GETTERS AGRUPADOS
// ==========================================

export const getAppInfo = () => ({
  name:      _env.APP_NAME,
  version:   _env.APP_VERSION,
  env:       _env.APP_ENV,
  mode:      _env.MODE,
  buildTime: new Date().toISOString(),
});

/**
 * Configuración del logger — consumida por logger.js
 * Los strings '-' indican variable no configurada, el logger usa sus propios defaults.
 * Se entregan RAW para que el logger los interprete con envToBool / parseCsvSet.
 */
export const getLoggerConfig = () => ({
  enabled:      _env.LOG_ENABLED,                                    // undefined | 'true' | 'false'
  levels:       _env.LOG_LEVELS        === '-' ? '' : _env.LOG_LEVELS,        // '' → logger usa su default
  scopes:       _env.LOG_SCOPES        === '-' ? '' : _env.LOG_SCOPES,        // '' → sin restricción
  defaultScope: _env.LOG_DEFAULT_SCOPE === '-' ? 'core' : _env.LOG_DEFAULT_SCOPE,
  prefix:       _env.LOG_PREFIX        === '-' ? ''     : _env.LOG_PREFIX,
  mode:         _env.MODE,
});

export const getSpinnerConfig = () => ({
  variant:       _env.SPINNER_VARIANT,
  size:          _env.SPINNER_SIZE,
  spinnerType:   _env.SPINNER_TYPE,
  showProgress:  _env.SPINNER_SHOW_PROGRESS,
  indeterminate: _env.SPINNER_INDETERMINATE,
});

export const getFeatureFlags = () => ({
  darkMode:      _env.DARK_MODE,
  notifications: _env.NOTIFICATIONS,
  debugMode:     _env.DEBUG_MODE,
});


// ==========================================
// VALIDACIÓN
// ==========================================

const _isValidUrl = (str) => { try { new URL(str); return true; } catch { return false; } };

export const validateEnvironment = () => {
  const errors   = [];
  const warnings = [];

  // ----- Errores críticos -----
  if (!_env.API_URL || _env.API_URL === '-')
    errors.push('VITE_FRONTEND_API_URL no está definida');
  else if (!_isValidUrl(_env.API_URL))
    errors.push(`VITE_FRONTEND_API_URL no es una URL válida → "${_env.API_URL}"`);

  // ----- Warnings: variables con sentinel '-' -----
  const sentinels = {
    APP_NAME:          'VITE_FRONTEND_NAME',
    APP_VERSION:       'VITE_FRONTEND_VERSION',
    APP_ENV:           'VITE_FRONTEND_ENV',
    LOG_LEVELS:        'VITE_LOG_LEVELS',
    LOG_SCOPES:        'VITE_LOG_SCOPES',
    LOG_DEFAULT_SCOPE: 'VITE_LOG_DEFAULT_SCOPE',
    LOG_PREFIX:        'VITE_LOG_PREFIX',
    SPINNER_VARIANT:   'VITE_PAGE_SPINNER_VARIANT',
    SPINNER_SIZE:      'VITE_PAGE_SPINNER_SIZE',
    SPINNER_TYPE:      'VITE_PAGE_SPINNER_TYPE',
  };

  for (const [key, envVar] of Object.entries(sentinels)) {
    if (_env[key] === '-') warnings.push(`${envVar} no está definida (usando sentinel "-")`);
  }

  // ----- Salida por consola (EXCEPCIÓN: circular con logger) -----
  if (errors.length) {
    console.group('❌ [environment] Errores críticos de configuración');
    errors.forEach(e => console.error(`   • ${e}`));
    console.warn('⚠️  La app puede no funcionar correctamente');
    console.groupEnd();
  }

  if (isDev() && warnings.length) {
    console.group('⚠️  [environment] Variables no configuradas');
    warnings.forEach(w => console.warn(`   • ${w}`));
    console.groupEnd();
  }

  return errors.length === 0;
};

validateEnvironment();


// ==========================================
// DEBUG (solo dev + DEBUG_MODE)
// ==========================================

if (isDev() && _env.DEBUG_MODE) {
  console.group('🔧 Environment');
  console.log('Mode:',     _env.MODE);
  console.log('API URL:',  _env.API_URL);
  console.log('App:',      getAppInfo());
  console.log('Logger:',   getLoggerConfig());
  console.log('Features:', getFeatureFlags());
  console.groupEnd();
}


// ==========================================
// EXPORTS
// ==========================================

export const { MODE, DEV, PROD, APP_NAME, APP_VERSION, API_URL, DEBUG_MODE } = _env;

export const environment = Object.freeze({ ..._env });

export default environment;