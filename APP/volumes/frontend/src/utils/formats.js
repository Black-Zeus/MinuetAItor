// ====================================
// /utils/formats.js
// Utilidades de formateo para el sistema de inventario
// ====================================

// ==========================================
// FORMATOS DE MONEDA
// ==========================================

/**
 * Formatea un número como moneda CLP sin decimales
 * @param {number} amount - Cantidad a formatear
 * @returns {string} Formato: $123.456
 */
export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';
    
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

/**
 * Formatea un número como moneda CLP con decimales
 * @param {number} amount - Cantidad a formatear
 * @param {number} decimals - Número de decimales (default: 2)
 * @returns {string} Formato: $123.456,78
 */
export const formatCurrencyWithDecimals = (amount, decimals = 2) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0,00';
    
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);
};

/**
 * Formatea solo el número sin símbolo de moneda
 * @param {number} amount - Cantidad a formatear
 * @param {number} decimals - Número de decimales (default: 0)
 * @returns {string} Formato: 123.456 o 123.456,78
 */
export const formatNumber = (amount, decimals = 0) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0';
    
    return new Intl.NumberFormat('es-CL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);
};

// ==========================================
// FORMATOS DE FECHA Y HORA
// ==========================================

/**
 * Formatea fecha tipo YYYY-MM-DD a formato local chileno
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} Formato: DD/MM/YYYY
 */
export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Fecha inválida';
        
        return date.toLocaleDateString('es-CL');
    } catch (error) {
        return 'Fecha inválida';
    }
};

/**
 * Formatea fecha y hora tipo YYYY-MM-DD HH:mm:ss a formato local
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} Formato: DD/MM/YYYY, HH:mm
 */
export const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Fecha inválida';
        
        return date.toLocaleString('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Fecha inválida';
    }
};

/**
 * Formatea fecha y hora en formato técnico YYYY-MM-DD HH:mm
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} Formato: 2025-01-14 07:30
 */
export const formatDateTimeTechnical = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Fecha inválida';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
        return 'Fecha inválida';
    }
};

/**
 * Formatea solo la hora en formato HH:mm
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} Formato: 14:30
 */
export const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Hora inválida';
        
        return date.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (error) {
        return 'Hora inválida';
    }
};

/**
 * Calcula tiempo relativo (hace X tiempo)
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} Formato: "hace 2 horas", "hace 3 días"
 */
export const formatTimeAgo = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 1) return 'ahora mismo';
        if (diffMinutes < 60) return `hace ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
        if (diffHours < 24) return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
        if (diffDays < 30) return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
        
        return formatDate(dateString); // Si es muy antiguo, mostrar fecha
    } catch (error) {
        return 'Fecha inválida';
    }
};

// ==========================================
// FORMATOS COMPACTOS Y ESPECIALES
// ==========================================

/**
 * Formatea un número grande con notación compacta (e.g. 1.5K)
 * @param {number} value - Valor a formatear
 * @returns {string} Formato: 1.5K, 2.3M, etc.
 */
export const formatNumberCompact = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    
    return new Intl.NumberFormat('es-CL', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
    }).format(value);
};

/**
 * Formatea porcentajes
 * @param {number} value - Valor decimal (0.15 = 15%)
 * @param {number} decimals - Decimales a mostrar (default: 1)
 * @returns {string} Formato: 15,0%
 */
export const formatPercentage = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    
    return new Intl.NumberFormat('es-CL', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
};

/**
 * Formatea números de teléfono chilenos
 * @param {string} phone - Número de teléfono
 * @returns {string} Formato: +56 9 1234 5678
 */
export const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    
    // Limpiar el número
    const cleaned = phone.replace(/\D/g, '');
    
    // Formato móvil chileno
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
        return `+56 ${cleaned.substring(0, 1)} ${cleaned.substring(1, 5)} ${cleaned.substring(5)}`;
    }
    
    // Formato fijo chileno (8 dígitos)
    if (cleaned.length === 8) {
        return `+56 2 ${cleaned.substring(0, 4)} ${cleaned.substring(4)}`;
    }
    
    // Si ya tiene código de país
    if (cleaned.length === 11 && cleaned.startsWith('56')) {
        const number = cleaned.substring(2);
        return `+56 ${number.substring(0, 1)} ${number.substring(1, 5)} ${number.substring(5)}`;
    }
    
    return phone; // Devolver original si no coincide con patrones
};

/**
 * Formatea RUT chileno
 * @param {string} rut - RUT sin formato
 * @returns {string} Formato: 12.345.678-9
 */
export const formatRUT = (rut) => {
    if (!rut) return 'N/A';
    
    // Limpiar el RUT
    const cleaned = rut.replace(/[^0-9kK]/g, '');
    
    if (cleaned.length < 2) return rut;
    
    // Separar número y dígito verificador
    const number = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    // Formatear número con puntos
    const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return `${formatted}-${dv}`;
};

// ==========================================
// VALIDACIONES DE FORMATO
// ==========================================

/**
 * Valida si una fecha es válida
 * @param {string|Date} dateString - Fecha a validar
 * @returns {boolean}
 */
export const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};

/**
 * Valida si un RUT chileno es válido
 * @param {string} rut - RUT a validar
 * @returns {boolean}
 */
export const isValidRUT = (rut) => {
    if (!rut) return false;
    
    const cleaned = rut.replace(/[^0-9kK]/g, '');
    if (cleaned.length < 2) return false;
    
    const number = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    // Algoritmo de validación del RUT
    let sum = 0;
    let multiplier = 2;
    
    for (let i = number.length - 1; i >= 0; i--) {
        sum += parseInt(number[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const remainder = sum % 11;
    const calculatedDV = remainder < 2 ? remainder.toString() : remainder === 10 ? 'K' : (11 - remainder).toString();
    
    return dv === calculatedDV;
};

// ==========================================
// UTILIDADES DE TEXTO
// ==========================================

/**
 * Capitaliza la primera letra de cada palabra
 * @param {string} text - Texto a formatear
 * @returns {string}
 */
export const formatCapitalize = (text) => {
    if (!text) return '';
    return text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Trunca texto a una longitud específica
 * @param {string} text - Texto a truncar
 * @param {number} length - Longitud máxima
 * @returns {string}
 */
export const formatTruncate = (text, length = 50) => {
    if (!text) return '';
    return text.length > length ? `${text.substring(0, length)}...` : text;
};

/**
 * Formatea tamaño de archivo
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Formato: 1.5 MB
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'N/A';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};