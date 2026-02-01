/**
 * utils/errors.js
 * Mapeo simple de códigos de error del backend a mensajes user-friendly
 */

// Códigos de error principales de tu API
export const ERROR_CODES = {
  // Auth errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_TOKEN_EXPIRED: 'AUTH_002',
  AUTH_TOKEN_BLACKLISTED: 'AUTH_003',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_004',
  AUTH_USER_NOT_FOUND: 'AUTH_005',
  AUTH_USER_INACTIVE: 'AUTH_006',
  AUTH_TOKEN_MISSING: 'AUTH_007',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_008',
  
  // Validation errors
  VALIDATION_FIELD_FORMAT: 'VALIDATION_001',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_002',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_001',
  
  // System errors
  SYSTEM_INTERNAL_ERROR: 'SYSTEM_001',
  SYSTEM_SERVICE_UNAVAILABLE: 'SYSTEM_002',
  SYSTEM_DATABASE_ERROR: 'SYSTEM_003'
};

// Mapeo de códigos a mensajes user-friendly
const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: {
    title: 'Credenciales incorrectas',
    message: 'Usuario o contraseña incorrectos',
    action: 'Verifique sus datos e intente nuevamente'
  },
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: {
    title: 'Sesión expirada',
    message: 'Su sesión ha expirado',
    action: 'Por favor, inicie sesión nuevamente'
  },
  [ERROR_CODES.AUTH_TOKEN_BLACKLISTED]: {
    title: 'Sesión inválida',
    message: 'Su sesión ya no es válida',
    action: 'Por favor, inicie sesión nuevamente'
  },
  [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: {
    title: 'Acceso denegado',
    message: 'No tiene permisos para realizar esta acción',
    action: 'Contacte al administrador si necesita acceso'
  },
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: {
    title: 'Usuario no encontrado',
    message: 'El usuario no existe',
    action: 'Verifique los datos ingresados'
  },
  [ERROR_CODES.AUTH_USER_INACTIVE]: {
    title: 'Cuenta inactiva',
    message: 'Su cuenta se encuentra inactiva',
    action: 'Contacte al administrador'
  },
  [ERROR_CODES.AUTH_TOKEN_MISSING]: {
    title: 'Sesión requerida',
    message: 'Debe estar autenticado para acceder',
    action: 'Por favor, inicie sesión'
  },
  [ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID]: {
    title: 'Sesión expirada',
    message: 'Su sesión ha expirado completamente',
    action: 'Por favor, inicie sesión nuevamente'
  },
  [ERROR_CODES.VALIDATION_FIELD_FORMAT]: {
    title: 'Datos incorrectos',
    message: 'Algunos campos tienen formato incorrecto',
    action: 'Revise los datos marcados en rojo'
  },
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: {
    title: 'Campos requeridos',
    message: 'Faltan campos obligatorios',
    action: 'Complete todos los campos requeridos'
  },
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: {
    title: 'Demasiados intentos',
    message: 'Ha excedido el límite de intentos',
    action: 'Espere unos minutos antes de intentar nuevamente'
  },
  [ERROR_CODES.SYSTEM_INTERNAL_ERROR]: {
    title: 'Error del sistema',
    message: 'Ha ocurrido un error interno',
    action: 'Intente nuevamente. Si persiste, contacte soporte'
  },
  [ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE]: {
    title: 'Servicio no disponible',
    message: 'El servicio no está disponible temporalmente',
    action: 'Intente nuevamente en unos minutos'
  },
  [ERROR_CODES.SYSTEM_DATABASE_ERROR]: {
    title: 'Error de conexión',
    message: 'No se puede conectar a la base de datos',
    action: 'Intente nuevamente más tarde'
  }
};

// Mensaje por defecto para errores no mapeados
const DEFAULT_ERROR = {
  title: 'Error inesperado',
  message: 'Ha ocurrido un error inesperado',
  action: 'Intente nuevamente o contacte soporte'
};

/**
 * Obtiene el mensaje de error user-friendly basado en el código de error
 * @param {string} errorCode - Código de error del backend
 * @returns {object} Objeto con title, message y action
 */
export const getErrorMessage = (errorCode) => {
  return ERROR_MESSAGES[errorCode] || DEFAULT_ERROR;
};

/**
 * Extrae información de error de diferentes formatos de respuesta
 * @param {object} error - Error de axios o respuesta del backend
 * @returns {object} Error normalizado con código y mensaje
 */
export const parseError = (error) => {
  // Si es un error de axios con respuesta del backend
  if (error?.response?.data) {
    const { data } = error.response;
    
    // Formato estándar de tu API
    if (data.error?.code) {
      return {
        code: data.error.code,
        message: data.message || data.error.description,
        details: data.error.details,
        status: data.status || error.response.status
      };
    }
    
    // Formato alternativo
    if (data.success === false) {
      return {
        code: data.error_code || 'UNKNOWN_ERROR',
        message: data.message,
        details: data.details,
        status: data.status || error.response.status
      };
    }
  }
  
  // Error de red o sin conexión
  if (error?.code === 'NETWORK_ERROR' || error?.code === 'ERR_NETWORK') {
    return {
      code: 'NETWORK_ERROR',
      message: 'Sin conexión a internet',
      details: 'Verifique su conexión e intente nuevamente',
      status: 0
    };
  }
  
  // Error de timeout
  if (error?.code === 'ECONNABORTED') {
    return {
      code: 'TIMEOUT_ERROR',
      message: 'La solicitud tardó demasiado',
      details: 'Intente nuevamente',
      status: 0
    };
  }
  
  // Error genérico
  return {
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'Error desconocido',
    details: 'Ha ocurrido un error inesperado',
    status: error?.response?.status || 0
  };
};

/**
 * Obtiene un mensaje completo de error listo para mostrar al usuario
 * @param {object} error - Error de axios o respuesta del backend
 * @returns {object} Error con información user-friendly
 */
export const getFormattedError = (error) => {
  const parsedError = parseError(error);
  const errorMessage = getErrorMessage(parsedError.code);
  
  return {
    ...parsedError,
    ...errorMessage,
    originalMessage: parsedError.message
  };
};

/**
 * Determina si un error requiere logout automático
 * @param {string} errorCode - Código de error
 * @returns {boolean} True si requiere logout
 */
export const shouldLogout = (errorCode) => {
  const logoutCodes = [
    ERROR_CODES.AUTH_TOKEN_EXPIRED,
    ERROR_CODES.AUTH_TOKEN_BLACKLISTED,
    ERROR_CODES.AUTH_TOKEN_MISSING,
    ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID,
    ERROR_CODES.AUTH_USER_INACTIVE
  ];
  
  return logoutCodes.includes(errorCode);
};

/**
 * Determina si un error es retryable automáticamente
 * @param {string} errorCode - Código de error
 * @returns {boolean} True si se puede reintentar
 */
export const isRetryableError = (errorCode) => {
  const retryableCodes = [
    ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE,
    ERROR_CODES.SYSTEM_DATABASE_ERROR,
    'NETWORK_ERROR',
    'TIMEOUT_ERROR'
  ];
  
  return retryableCodes.includes(errorCode);
};