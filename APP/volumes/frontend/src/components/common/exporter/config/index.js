// src/export/config/index.js
// Configuración principal centralizada del sistema de exportación

import {
    dataSchema,
    configSchema,
    pdfContentSchema,
    supportedDataTypes,
    supportedFormats
} from './data-schema.js';

import {
    formatDefaults,
    globalDefaults,
    presetConfigs,
    getFormatDefaults,
    mergeConfig,
    generateFilename,
    getPresetConfig
} from './format-defaults.js';

/**
 * Configuración principal del sistema de exportación
 */
export const exportConfig = {
    // Versión del sistema
    version: '1.0.0',

    // Nombre del sistema
    name: 'Export System',

    // Formatos habilitados por defecto
    enabledFormats: ['csv', 'json', 'excel', 'pdf', 'txt'],

    // Configuración de carga diferida
    lazyLoading: {
        enabled: true,
        timeout: 10000, // 10 segundos timeout para imports dinámicos
        retries: 3
    },

    // Configuración de validación
    validation: {
        enabled: true,
        strictMode: false, // Si es true, falla en cualquier error de validación
        logWarnings: true
    },

    // Configuración de logging
    logging: {
        enabled: true,
        level: 'info', // 'debug', 'info', 'warn', 'error'
        prefix: '[ExportSystem]'
    },

    // Configuración de errores
    errorHandling: {
        throwOnError: false,
        returnErrorDetails: true,
        fallbackToDownload: true
    },

    // Límites del sistema
    limits: {
        maxRows: 100000,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxColumns: 1000
    }
};

/**
 * Cache para dependencias cargadas
 */
const dependencyCache = new Map();

/**
 * Lazy imports para dependencias instaladas
 */
const dependencyImports = {
    xlsx: () => import('xlsx'),
    pdfmake: () => import('pdfmake/build/pdfmake'),
    exceljs: () => import('exceljs'),
    fileSaver: () => import('file-saver')
};

/**
 * Estado del sistema
 */
let systemState = {
    initialized: false,
    loadedDependencies: new Set(),
    errors: [],
    warnings: []
};

/**
 * Inicializa el sistema de exportación
 * @param {object} customConfig - Configuración personalizada
 */
export const initializeExportSystem = (customConfig = {}) => {
    // Combinar configuración personalizada
    Object.assign(exportConfig, customConfig);

    // Validar formatos habilitados
    exportConfig.enabledFormats = exportConfig.enabledFormats.filter(format =>
        supportedFormats[format]
    );

    systemState.initialized = true;

    if (exportConfig.logging.enabled) {
        console.log(`${exportConfig.logging.prefix} Sistema inicializado v${exportConfig.version}`);
        console.log(`${exportConfig.logging.prefix} Formatos habilitados:`, exportConfig.enabledFormats);
    }

    return systemState;
};

/**
 * Carga una dependencia externa de forma diferida
 * @param {string} dependency - Nombre de la dependencia
 * @returns {Promise<any>} Dependencia cargada
 */
export const loadDependency = async (dependency) => {
    // Verificar si ya está cargada
    if (dependencyCache.has(dependency)) {
        return dependencyCache.get(dependency);
    }

    // Verificar que la dependencia está disponible
    const importFn = dependencyImports[dependency];
    if (!importFn) {
        throw new Error(`Dependencia no soportada: ${dependency}`);
    }

    try {
        if (exportConfig.logging.enabled) {
            console.log(`${exportConfig.logging.prefix} Cargando dependencia: ${dependency}`);
        }

        const loadPromise = importFn();

        if (exportConfig.lazyLoading.timeout > 0) {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout cargando ${dependency}`)), exportConfig.lazyLoading.timeout)
            );

            const module = await Promise.race([loadPromise, timeoutPromise]);
            const loadedDependency = module.default || module;

            dependencyCache.set(dependency, loadedDependency);
            systemState.loadedDependencies.add(dependency);

            if (exportConfig.logging.enabled) {
                console.log(`${exportConfig.logging.prefix} Dependencia cargada: ${dependency}`);
            }

            return loadedDependency;
        } else {
            const module = await loadPromise;
            const loadedDependency = module.default || module;

            dependencyCache.set(dependency, loadedDependency);
            systemState.loadedDependencies.add(dependency);

            if (exportConfig.logging.enabled) {
                console.log(`${exportConfig.logging.prefix} Dependencia cargada: ${dependency}`);
            }

            return loadedDependency;
        }

    } catch (error) {
        systemState.errors.push({
            type: 'dependency_load_error',
            dependency,
            message: error.message,
            timestamp: new Date().toISOString()
        });

        if (exportConfig.logging.enabled) {
            console.error(`${exportConfig.logging.prefix} Error cargando ${dependency}:`, error);
        }

        throw error;
    }
};



/**
 * Obtiene la configuración completa para un formato y configuración dada
 * @param {string} format - Formato de exportación
 * @param {object} userConfig - Configuración del usuario
 * @param {string} preset - Preset opcional a aplicar
 * @returns {object} Configuración completa
 */
export const getExportConfig = (format, userConfig = {}, preset = null) => {
    let config = getFormatDefaults(format);

    // Aplicar preset si se especifica
    if (preset) {
        const presetConfig = getPresetConfig(preset, format);
        config = mergeConfig(format, presetConfig);
    }

    // Aplicar configuración del usuario
    config = mergeConfig(format, userConfig);

    return config;
};

/**
 * Valida si un formato está disponible
 * @param {string} format - Formato a validar
 * @returns {object} Resultado de validación
 */
export const validateFormat = (format) => {
    const result = {
        valid: false,
        enabled: false,
        requiresDependencies: false,
        dependencies: [],
        errors: []
    };

    // Verificar si el formato es soportado
    if (!supportedFormats[format]) {
        result.errors.push(`Formato no soportado: ${format}`);
        return result;
    }

    result.valid = true;

    // Verificar si está habilitado
    result.enabled = exportConfig.enabledFormats.includes(format);
    if (!result.enabled) {
        result.errors.push(`Formato deshabilitado: ${format}`);
    }

    // Verificar dependencias
    const formatInfo = supportedFormats[format];
    if (formatInfo.dependencies && formatInfo.dependencies.length > 0) {
        result.requiresDependencies = true;
        result.dependencies = formatInfo.dependencies;
    }

    return result;
};

/**
 * Obtiene el estado actual del sistema
 * @returns {object} Estado del sistema
 */
export const getSystemState = () => ({
    ...systemState,
    config: exportConfig,
    supportedFormats: Object.keys(supportedFormats),
    enabledFormats: exportConfig.enabledFormats,
    loadedDependencies: Array.from(systemState.loadedDependencies)
});

/**
 * Resetea el sistema (útil para testing)
 */
export const resetSystem = () => {
    systemState = {
        initialized: false,
        loadedDependencies: new Set(),
        errors: [],
        warnings: []
    };

    dependencyCache.clear();

    if (exportConfig.logging.enabled) {
        console.log(`${exportConfig.logging.prefix} Sistema reseteado`);
    }
};

/**
 * Re-exportar utilidades y esquemas
 */
export {
    // Esquemas
    dataSchema,
    configSchema,
    pdfContentSchema,
    supportedDataTypes,
    supportedFormats,

    // Configuraciones por defecto
    formatDefaults,
    globalDefaults,
    presetConfigs,

    // Utilidades de configuración
    getFormatDefaults,
    mergeConfig,
    generateFilename,
    getPresetConfig
};