// src/export/utils/validation.js
// Sistema de validaciones para el sistema de exportación

import {
    dataSchema,
    configSchema,
    pdfContentSchema,
    supportedDataTypes,
    supportedFormats
} from '../config/data-schema.js';

/**
 * Resultado de validación
 */
class ValidationResult {
    constructor() {
        this.valid = true;
        this.errors = [];
        this.warnings = [];
        this.data = null;
    }

    addError(field, message, value = null) {
        this.valid = false;
        this.errors.push({
            field,
            message,
            value,
            type: 'error'
        });
        return this;
    }

    addWarning(field, message, value = null) {
        this.warnings.push({
            field,
            message,
            value,
            type: 'warning'
        });
        return this;
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    hasWarnings() {
        return this.warnings.length > 0;
    }

    getErrorMessages() {
        return this.errors.map(error => error.message);
    }

    getWarningMessages() {
        return this.warnings.map(warning => warning.message);
    }
}

/**
 * Valida un valor contra un tipo de datos soportado
 * @param {any} value - Valor a validar
 * @param {string} type - Tipo esperado
 * @returns {boolean} Si el valor es válido
 */
export const validateDataType = (value, type) => {
    if (value === null || value === undefined) {
        return true; // Los valores nulos son válidos por defecto
    }

    const typeValidator = supportedDataTypes[type];
    if (!typeValidator) {
        return false;
    }

    return typeValidator.validate(value);
};

/**
 * Formatea un valor usando el formatter apropiado
 * @param {any} value - Valor a formatear
 * @param {string} type - Tipo de datos
 * @param {function} customFormatter - Formatter personalizado opcional
 * @returns {any} Valor formateado
 */
export const formatValue = (value, type, customFormatter = null) => {
    if (customFormatter && typeof customFormatter === 'function') {
        try {
            return customFormatter(value);
        } catch (error) {
            console.warn('Error aplicando formatter personalizado:', error);
            // Continuar con formatter por defecto
        }
    }

    const typeInfo = supportedDataTypes[type] || supportedDataTypes.string;
    return typeInfo.defaultFormatter(value);
};

/**
 * Valida la estructura básica de datos
 * @param {any} data - Datos a validar
 * @returns {ValidationResult} Resultado de validación
 */
export const validateDataStructure = (data) => {
    const result = new ValidationResult();

    if (!data) {
        return result.addError('data', 'Los datos son requeridos');
    }

    if (typeof data !== 'object') {
        return result.addError('data', 'Los datos deben ser un objeto');
    }

    // Validar que tenga al menos data o content
    if (!data.data && !data.content) {
        return result.addError('data', 'Los datos deben tener una propiedad "data" o "content"');
    }

    // Validar array de datos
    if (data.data) {
        if (!Array.isArray(data.data)) {
            result.addError('data.data', 'La propiedad "data" debe ser un array');
        } else if (data.data.length === 0) {
            result.addWarning('data.data', 'El array de datos está vacío');
        } else {
            // Validar que todos los elementos sean objetos planos
            data.data.forEach((item, index) => {
                if (typeof item !== 'object' || item === null) {
                    result.addError(`data.data[${index}]`, 'Todos los elementos deben ser objetos');
                } else {
                    // Verificar que no hay propiedades anidadas (no dot notation)
                    Object.keys(item).forEach(key => {
                        if (typeof item[key] === 'object' && item[key] !== null && !Array.isArray(item[key]) && !(item[key] instanceof Date)) {
                            result.addWarning(`data.data[${index}].${key}`, 'Se encontró objeto anidado, se convertirá a string');
                        }
                    });
                }
            });
        }
    }

    // Validar columnas si están presentes
    if (data.columns) {
        if (!Array.isArray(data.columns)) {
            result.addError('data.columns', 'Las columnas deben ser un array');
        } else {
            data.columns.forEach((column, index) => {
                if (typeof column === 'string') {
                    // Validar que existe en los datos
                    if (data.data && data.data.length > 0) {
                        const firstRow = data.data[0];
                        if (!Object.prototype.hasOwnProperty.call(firstRow, column)) {
                            result.addWarning(`data.columns[${index}]`, `La columna "${column}" no existe en los datos`);
                        }
                    }
                } else if (typeof column === 'object') {
                    if (!column.key) {
                        result.addError(`data.columns[${index}]`, 'La columna debe tener una propiedad "key"');
                    } else if (data.data && data.data.length > 0) {
                        const firstRow = data.data[0];
                        if (!Object.prototype.hasOwnProperty.call(firstRow, column.key)) {
                            result.addWarning(`data.columns[${index}]`, `La columna "${column.key}" no existe en los datos`);
                        }
                    }

                    // Validar tipo si está especificado
                    if (column.type && !supportedDataTypes[column.type]) {
                        result.addError(`data.columns[${index}]`, `Tipo de columna no soportado: ${column.type}`);
                    }
                } else {
                    result.addError(`data.columns[${index}]`, 'La columna debe ser string u objeto');
                }
            });
        }
    }

    // Validar metadata si está presente
    if (data.metadata) {
        if (typeof data.metadata !== 'object') {
            result.addError('data.metadata', 'Los metadatos deben ser un objeto');
        } else {
            // Validar fecha de creación si está presente
            if (data.metadata.createdAt) {
                const date = new Date(data.metadata.createdAt);
                if (isNaN(date.getTime())) {
                    result.addError('data.metadata.createdAt', 'Fecha de creación inválida');
                }
            }
        }
    }

    // Validar sheets para Excel si está presente
    if (data.sheets) {
        if (!Array.isArray(data.sheets)) {
            result.addError('data.sheets', 'Las hojas deben ser un array');
        } else {
            data.sheets.forEach((sheet, index) => {
                if (!sheet.name) {
                    result.addError(`data.sheets[${index}]`, 'Cada hoja debe tener un nombre');
                }
                if (!sheet.data || !Array.isArray(sheet.data)) {
                    result.addError(`data.sheets[${index}]`, 'Cada hoja debe tener un array de datos');
                }
            });
        }
    }

    // Validar content para PDF si está presente
    if (data.content) {
        if (!Array.isArray(data.content)) {
            result.addError('data.content', 'El contenido debe ser un array');
        } else {
            data.content.forEach((item, index) => {
                if (!item.type) {
                    result.addError(`data.content[${index}]`, 'Cada elemento debe tener una propiedad "type"');
                } else if (!pdfContentSchema[item.type]) {
                    result.addError(`data.content[${index}]`, `Tipo de contenido no soportado: ${item.type}`);
                }
            });
        }
    }

    result.data = data;
    return result;
};

/**
 * Valida la configuración de exportación
 * @param {object} config - Configuración a validar
 * @param {string} format - Formato de exportación
 * @returns {ValidationResult} Resultado de validación
 */
export const validateConfig = (config, format) => {
    const result = new ValidationResult();

    if (!config) {
        result.addWarning('config', 'No se proporcionó configuración, usando valores por defecto');
        result.data = {};
        return result;
    }

    if (typeof config !== 'object') {
        result.addError('config', 'La configuración debe ser un objeto');
        return result;
    }

    // Validar formato
    if (!supportedFormats[format]) {
        result.addError('format', `Formato no soportado: ${format}`);
        return result;
    }

    // Validar filename si está presente
    if (config.filename) {
        if (typeof config.filename !== 'string') {
            result.addError('config.filename', 'El nombre de archivo debe ser string');
        } else if (config.filename.includes('/') || config.filename.includes('\\')) {
            result.addError('config.filename', 'El nombre de archivo no puede contener rutas');
        }
    }

    // Validar configuraciones específicas por formato
    if (format === 'csv') {
        if (config.delimiter && typeof config.delimiter !== 'string') {
            result.addError('config.delimiter', 'El delimitador debe ser string');
        }
    }

    if (format === 'json') {
        if (config.format && !['array', 'structured', 'envelope'].includes(config.format)) {
            result.addError('config.format', 'Formato JSON debe ser: array, structured o envelope');
        }
    }

    if (format === 'pdf') {
        if (config.pageSize && typeof config.pageSize !== 'string') {
            result.addError('config.pageSize', 'El tamaño de página debe ser string');
        }

        if (config.pageMargins && !Array.isArray(config.pageMargins)) {
            result.addError('config.pageMargins', 'Los márgenes deben ser un array');
        }

        // Validar colores si están presentes
        ['primaryColor', 'secondaryColor'].forEach(colorField => {
            if (config.branding && config.branding[colorField]) {
                const color = config.branding[colorField];
                if (typeof color !== 'string' || !color.match(/^#[0-9A-F]{6}$/i)) {
                    result.addWarning(`config.branding.${colorField}`, 'El color debe ser formato hexadecimal (#RRGGBB)');
                }
            }
        });
    }

    result.data = config;
    return result;
};

/**
 * Valida límites del sistema
 * @param {object} data - Datos a validar
 * @param {object} limits - Límites del sistema
 * @returns {ValidationResult} Resultado de validación
 */
export const validateLimits = (data, limits) => {
    const result = new ValidationResult();

    if (data.data && Array.isArray(data.data)) {
        // Validar número de filas
        if (limits.maxRows && data.data.length > limits.maxRows) {
            result.addError('limits.maxRows', `Se excede el límite de ${limits.maxRows} filas (${data.data.length} filas)`);
        }

        // Validar número de columnas
        if (limits.maxColumns && data.data.length > 0) {
            const columnCount = Object.keys(data.data[0]).length;
            if (columnCount > limits.maxColumns) {
                result.addError('limits.maxColumns', `Se excede el límite de ${limits.maxColumns} columnas (${columnCount} columnas)`);
            }
        }
    }

    result.data = data;
    return result;
};

/**
 * Auto-detecta columnas desde los datos
 * @param {array} data - Array de datos
 * @returns {array} Array de columnas detectadas
 */
export const autoDetectColumns = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Obtener todas las keys únicas de todos los objetos
    const allKeys = new Set();
    data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(key => allKeys.add(key));
        }
    });

    // Convertir a array y detectar tipos
    return Array.from(allKeys).map(key => {
        // Intentar detectar el tipo basado en los valores
        let detectedType = 'string';

        for (const item of data) {
            const value = item[key];
            if (value !== null && value !== undefined) {
                if (typeof value === 'number') {
                    detectedType = 'number';
                    break;
                } else if (typeof value === 'boolean') {
                    detectedType = 'boolean';
                    break;
                } else if (value instanceof Date || !isNaN(Date.parse(value))) {
                    detectedType = 'date';
                    break;
                }
            }
        }

        return {
            key,
            header: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizar primera letra
            type: detectedType
        };
    });
};

/**
 * Limpia y normaliza los datos para exportación
 * @param {object} data - Datos a limpiar
 * @returns {object} Datos limpios
 */
export const cleanDataForExport = (data) => {
    const cleaned = { ...data };

    if (cleaned.data && Array.isArray(cleaned.data)) {
        cleaned.data = cleaned.data.map(item => {
            const cleanItem = {};

            Object.keys(item).forEach(key => {
                let value = item[key];

                // Convertir objetos anidados a string (no dot notation)
                if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value)) {
                    value = JSON.stringify(value);
                }

                // Limpiar arrays convirtiéndolos a string
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }

                cleanItem[key] = value;
            });

            return cleanItem;
        });
    }

    // Auto-detectar columnas si no están definidas
    if (!cleaned.columns && cleaned.data && cleaned.data.length > 0) {
        cleaned.columns = autoDetectColumns(cleaned.data);
    }

    return cleaned;
};

/**
 * Validación completa de datos y configuración
 * @param {object} data - Datos a exportar
 * @param {object} config - Configuración de exportación
 * @param {string} format - Formato de exportación
 * @param {object} systemLimits - Límites del sistema
 * @returns {ValidationResult} Resultado de validación completa
 */
export const validateExportData = (data, config, format, systemLimits) => {
    const result = new ValidationResult();

    // Validar estructura de datos
    const dataValidation = validateDataStructure(data);
    result.errors.push(...dataValidation.errors);
    result.warnings.push(...dataValidation.warnings);

    // Si hay errores críticos en los datos, no continuar
    if (dataValidation.hasErrors()) {
        return result;
    }

    // Validar configuración
    const configValidation = validateConfig(config, format);
    result.errors.push(...configValidation.errors);
    result.warnings.push(...configValidation.warnings);

    // Validar límites del sistema
    if (systemLimits) {
        const limitsValidation = validateLimits(data, systemLimits);
        result.errors.push(...limitsValidation.errors);
        result.warnings.push(...limitsValidation.warnings);
    }

    // Si todo está válido, limpiar y preparar los datos
    if (!result.hasErrors()) {
        result.data = {
            data: cleanDataForExport(data),
            config: configValidation.data
        };
    }

    return result;
};