/**
 * utils/errors.js
 * Manejo de errores compatible con el API Gateway wrapper.
 *
 * Estructura SIEMPRE del backend:
 *   {
 *     success: true,          ← siempre true, no es indicador de éxito/error
 *     status: 200|4xx|5xx,   ← status real aquí
 *     result: { ... },        ← payload o { detail: "..." } en errores
 *     error: null | { code, description, details },
 *     meta: { request_id, timestamp, duration_ms, route }
 *   }
 *
 * IMPORTANTE: axios lanza el error correctamente porque el HTTP status real
 * es 4xx/5xx. El body siempre tiene esta estructura envuelta.
 */

// ==========================================
// GATEWAY RESPONSE HELPERS
// ==========================================

/**
 * Desenvuelve el payload del gateway wrapper.
 * response.data.result ?? response.data
 */
export const unwrapResponse = (responseData) => responseData?.result ?? responseData;

/**
 * Extrae el mensaje de error del gateway wrapper.
 * Prioridad: error.description → result.detail → result.message → fallback
 */
export const extractErrorMessage = (data, fallback = 'Error desconocido') => {
  if (!data) return fallback;
  // error.description es el mensaje técnico del gateway
  if (data.error?.description) return data.error.description;
  // result.detail viene de FastAPI (HTTPException)
  if (data.result?.detail)     return data.result.detail;
  // result.message viene de errores de validación u otros
  if (data.result?.message)    return data.result.message;
  // Fallback al mensaje raíz
  return data.message || fallback;
};

/**
 * Extrae el código de error del gateway wrapper.
 */
export const extractErrorCode = (data, httpStatus) => {
  if (data?.error?.code) return data.error.code;
  // Inferir código desde HTTP status si no hay code explícito
  if (httpStatus === 401)  return ERROR_CODES.AUTH_TOKEN_MISSING;
  if (httpStatus === 403)  return ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS;
  if (httpStatus === 404)  return 'NOT_FOUND';
  if (httpStatus === 422)  return ERROR_CODES.VALIDATION_FIELD_FORMAT;
  if (httpStatus === 429)  return ERROR_CODES.RATE_LIMIT_EXCEEDED;
  if (httpStatus >= 500)   return ERROR_CODES.SYSTEM_INTERNAL_ERROR;
  return 'UNKNOWN_ERROR';
};

// ==========================================
// ERROR CODES
// ==========================================

export const ERROR_CODES = {
  // Auth
  AUTH_INVALID_CREDENTIALS:      'AUTH_001',
  AUTH_TOKEN_EXPIRED:             'AUTH_002',
  AUTH_TOKEN_BLACKLISTED:         'AUTH_003',
  AUTH_INSUFFICIENT_PERMISSIONS:  'AUTH_004',
  AUTH_USER_NOT_FOUND:            'AUTH_005',
  AUTH_USER_INACTIVE:             'AUTH_006',
  AUTH_TOKEN_MISSING:             'AUTH_007',
  AUTH_REFRESH_TOKEN_INVALID:     'AUTH_008',
  // Códigos literales que puede devolver el backend en error.code
  UNAUTHORIZED:                   'UNAUTHORIZED',
  // Validation
  VALIDATION_FIELD_FORMAT:        'VALIDATION_001',
  VALIDATION_REQUIRED_FIELD:      'VALIDATION_002',
  // Rate limiting
  RATE_LIMIT_EXCEEDED:            'RATE_LIMIT_001',
  // System
  SYSTEM_INTERNAL_ERROR:          'SYSTEM_001',
  SYSTEM_SERVICE_UNAVAILABLE:     'SYSTEM_002',
  SYSTEM_DATABASE_ERROR:          'SYSTEM_003',
};

// ==========================================
// ERROR MESSAGES (user-friendly)
// ==========================================

const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: {
    title:   'Credenciales incorrectas',
    message: 'Usuario o contraseña incorrectos',
    action:  'Verifique sus datos e intente nuevamente',
  },
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: {
    title:   'Sesión expirada',
    message: 'Su sesión ha expirado',
    action:  'Por favor, inicie sesión nuevamente',
  },
  [ERROR_CODES.AUTH_TOKEN_BLACKLISTED]: {
    title:   'Sesión inválida',
    message: 'Su sesión ya no es válida',
    action:  'Por favor, inicie sesión nuevamente',
  },
  [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: {
    title:   'Acceso denegado',
    message: 'No tiene permisos para realizar esta acción',
    action:  'Contacte al administrador si necesita acceso',
  },
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: {
    title:   'Usuario no encontrado',
    message: 'El usuario no existe',
    action:  'Verifique los datos ingresados',
  },
  [ERROR_CODES.AUTH_USER_INACTIVE]: {
    title:   'Cuenta inactiva',
    message: 'Su cuenta se encuentra inactiva',
    action:  'Contacte al administrador',
  },
  [ERROR_CODES.AUTH_TOKEN_MISSING]: {
    title:   'Sesión requerida',
    message: 'Debe estar autenticado para acceder',
    action:  'Por favor, inicie sesión',
  },
  [ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID]: {
    title:   'Sesión expirada',
    message: 'Su sesión ha expirado completamente',
    action:  'Por favor, inicie sesión nuevamente',
  },
  // Código literal devuelto por algunos endpoints
  UNAUTHORIZED: {
    title:   'Acceso denegado',
    message: 'Las credenciales ingresadas no son válidas',
    action:  'Verifica tus datos e intenta nuevamente',
  },
  [ERROR_CODES.VALIDATION_FIELD_FORMAT]: {
    title:   'Datos incorrectos',
    message: 'Algunos campos tienen formato incorrecto',
    action:  'Revise los datos marcados en rojo',
  },
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: {
    title:   'Campos requeridos',
    message: 'Faltan campos obligatorios',
    action:  'Complete todos los campos requeridos',
  },
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: {
    title:   'Demasiados intentos',
    message: 'Ha excedido el límite de intentos',
    action:  'Espere unos minutos antes de intentar nuevamente',
  },
  [ERROR_CODES.SYSTEM_INTERNAL_ERROR]: {
    title:   'Error del sistema',
    message: 'Ha ocurrido un error interno',
    action:  'Intente nuevamente. Si persiste, contacte soporte',
  },
  [ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE]: {
    title:   'Servicio no disponible',
    message: 'El servicio no está disponible temporalmente',
    action:  'Intente nuevamente en unos minutos',
  },
  [ERROR_CODES.SYSTEM_DATABASE_ERROR]: {
    title:   'Error de conexión',
    message: 'No se puede conectar a la base de datos',
    action:  'Intente nuevamente más tarde',
  },
};

const DEFAULT_ERROR = {
  title:   'Error inesperado',
  message: 'Ha ocurrido un error inesperado',
  action:  'Intente nuevamente o contacte soporte',
};

export const getErrorMessage = (errorCode) => ERROR_MESSAGES[errorCode] || DEFAULT_ERROR;

// ==========================================
// parseError — compatible con gateway wrapper
// ==========================================

/**
 * Normaliza cualquier error de axios en un objeto { code, message, details, status }.
 *
 * Entiende la estructura del gateway:
 *   error.response.data = { success, status, result, error, meta }
 */
export const parseError = (error) => {
  // ── Error de axios con respuesta del backend ──────────────────────────────
  if (error?.response?.data) {
    const data       = error.response.data;
    const httpStatus = error.response.status;

    // El status real puede venir en data.status (gateway) o en el HTTP status
    const realStatus = data.status ?? httpStatus;

    // Extraer mensaje y código usando los helpers del gateway
    const message = extractErrorMessage(data);
    const code    = extractErrorCode(data, realStatus);

    // Details pueden estar en error.details (array o string) o en result.detail
    let details = data.error?.details || data.result?.detail || null;

    // Normalizar details tipo FastAPI 422 (array de objetos)
    if (Array.isArray(details)) {
      details = details.map(d => d.msg || d.message || JSON.stringify(d)).join(', ');
    }

    return { code, message, details, status: realStatus };
  }

  // ── Error de red ──────────────────────────────────────────────────────────
  if (error?.code === 'ERR_NETWORK' || error?.code === 'NETWORK_ERROR' || !error?.response) {
    return {
      code:    'NETWORK_ERROR',
      message: 'Sin conexión a internet',
      details: 'Verifique su conexión e intente nuevamente',
      status:  0,
    };
  }

  // ── Timeout ───────────────────────────────────────────────────────────────
  if (error?.code === 'ECONNABORTED') {
    return {
      code:    'TIMEOUT_ERROR',
      message: 'La solicitud tardó demasiado',
      details: 'Intente nuevamente',
      status:  0,
    };
  }

  // ── Error ya formateado (lanzado manualmente con .code) ───────────────────
  if (error?.code && error?.message && !error?.response) {
    return {
      code:    error.code,
      message: error.message,
      details: error.details || null,
      status:  error.status || 0,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    code:    'UNKNOWN_ERROR',
    message: error?.message || 'Error desconocido',
    details: 'Ha ocurrido un error inesperado',
    status:  error?.response?.status || 0,
  };
};

/**
 * Combina parseError con mensajes user-friendly.
 * Retorna: { code, message, details, status, title, action, originalMessage }
 */
export const getFormattedError = (error) => {
  const parsed      = parseError(error);
  const userMessage = getErrorMessage(parsed.code);

  return {
    ...parsed,
    ...userMessage,
    originalMessage: parsed.message,
  };
};

// ==========================================
// HELPERS DE LÓGICA
// ==========================================

/**
 * Si el código de error requiere logout automático.
 */
export const shouldLogout = (errorCode) => [
  ERROR_CODES.AUTH_TOKEN_EXPIRED,
  ERROR_CODES.AUTH_TOKEN_BLACKLISTED,
  ERROR_CODES.AUTH_TOKEN_MISSING,
  ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID,
  ERROR_CODES.AUTH_USER_INACTIVE,
].includes(errorCode);

/**
 * Si el error se puede reintentar automáticamente.
 */
export const isRetryableError = (errorCode) => [
  ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE,
  ERROR_CODES.SYSTEM_DATABASE_ERROR,
  'NETWORK_ERROR',
  'TIMEOUT_ERROR',
].includes(errorCode);