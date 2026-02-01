// src/export/useExport.js
// Hook personalizado para manejo de exportaciones

import { useState, useCallback, useRef } from 'react';
import { csv } from './exporters/csv.js';
import { json } from './exporters/json.js';
import { excel } from './exporters/excel.js';
import { pdf } from './exporters/pdf.js';
import { txt } from './exporters/txt.js';
import {
    validateFormat,
    getExportConfig,
    getSystemState,
    supportedFormats
} from './config/index.js';

/**
 * Hook para manejo de exportaciones
 * @param {object} options - Opciones del hook
 * @returns {object} API del hook
 */
export const useExport = (options = {}) => {
    // Estados del hook
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(null);
    const [lastExportResult, setLastExportResult] = useState(null);
    const [exportHistory, setExportHistory] = useState([]);
    const [availableFormats, setAvailableFormats] = useState([]);

    // Referencias
    const abortController = useRef(null);
    const exportersMap = useRef({
        csv,
        json,
        excel,
        pdf,
        txt
    });

    // Configuración por defecto del hook
    const hookConfig = {
        enabledFormats: ['csv', 'json', 'excel', 'pdf', 'txt'],
        autoValidate: true,
        trackHistory: true,
        maxHistorySize: 10,
        showProgress: false,
        onExportStart: null,
        onExportComplete: null,
        onExportError: null,
        onExportProgress: null,
        ...options
    };

    /**
     * Inicializa los formatos disponibles
     */
    const initializeFormats = useCallback(() => {
        const systemState = getSystemState();
        const enabled = hookConfig.enabledFormats;

        const formats = enabled
            .filter(format => systemState.enabledFormats.includes(format))
            .map(format => {
                const formatInfo = supportedFormats[format];
                const validation = validateFormat(format);

                return {
                    key: format,
                    name: formatInfo?.name || format.toUpperCase(),
                    extension: formatInfo?.extension || format,
                    mimeType: formatInfo?.mimeType || 'application/octet-stream',
                    description: formatInfo?.description || '',
                    features: {
                        supportsMetadata: formatInfo?.supportsMetadata || false,
                        supportsMultiSheet: formatInfo?.supportsMultiSheet || false,
                        supportsFormatting: formatInfo?.supportsFormatting || false,
                        preservesDataTypes: formatInfo?.preservesDataTypes || false
                    },
                    available: validation.enabled,
                    requiresDependencies: validation.requiresDependencies,
                    dependencies: validation.dependencies || [],
                    errors: validation.errors || []
                };
            })
            .filter(format => format.available);

        setAvailableFormats(formats);
        return formats;
    }, [hookConfig.enabledFormats]);

    /**
     * Exporta datos en el formato especificado
     * @param {string} format - Formato de exportación
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración de exportación
     * @returns {Promise<object>} Resultado de exportación
     */
    const exportData = useCallback(async (format, data, config = {}) => {
        // Verificar si hay una exportación en progreso
        if (isExporting) {
            throw new Error('Ya hay una exportación en progreso');
        }

        // Validar formato
        const formatValidation = validateFormat(format);
        if (!formatValidation.valid || !formatValidation.enabled) {
            throw new Error(`Formato no disponible: ${format}`);
        }

        // Preparar estado
        setIsExporting(true);
        setExportProgress({ status: 'starting', message: 'Iniciando exportación...' });
        setLastExportResult(null);

        // Crear AbortController para cancelaciones
        abortController.current = new AbortController();

        const exportInfo = {
            id: generateExportId(),
            format,
            startTime: Date.now(),
            data: hookConfig.trackHistory ? { ...data } : null,
            config: { ...config }
        };

        try {
            // Callback de inicio
            if (hookConfig.onExportStart) {
                hookConfig.onExportStart(exportInfo);
            }

            // Actualizar progreso
            updateProgress('preparing', 'Preparando datos...');

            // Obtener configuración completa
            const fullConfig = getExportConfig(format, config);

            // Validar datos si está habilitado
            if (hookConfig.autoValidate) {
                updateProgress('validating', 'Validando datos...');
                await validateExportData(data, fullConfig, format);
            }

            // Obtener el exportador
            const exporter = exportersMap.current[format];
            if (!exporter) {
                throw new Error(`Exportador no encontrado para formato: ${format}`);
            }

            // Realizar exportación
            updateProgress('exporting', `Generando archivo ${format.toUpperCase()}...`);

            const result = await exporter.export(data, fullConfig);

            // Completar información del resultado
            const completeResult = {
                ...result,
                exportInfo,
                duration: Date.now() - exportInfo.startTime,
                timestamp: new Date().toISOString()
            };

            // Actualizar estados
            setLastExportResult(completeResult);
            setExportProgress({ status: 'completed', message: 'Exportación completada' });

            // Agregar al historial si está habilitado
            if (hookConfig.trackHistory) {
                addToHistory(completeResult);
            }

            // Callback de completado
            if (hookConfig.onExportComplete) {
                hookConfig.onExportComplete(completeResult);
            }

            return completeResult;

        } catch (error) {
            const errorResult = {
                success: false,
                format,
                error: error.message,
                exportInfo,
                duration: Date.now() - exportInfo.startTime,
                timestamp: new Date().toISOString()
            };

            setLastExportResult(errorResult);
            setExportProgress({ status: 'error', message: error.message });

            // Callback de error
            if (hookConfig.onExportError) {
                hookConfig.onExportError(error, errorResult);
            }

            throw error;

        } finally {
            setIsExporting(false);
            abortController.current = null;

            // Limpiar progreso después de un tiempo
            setTimeout(() => {
                setExportProgress(null);
            }, 3000);
        }
    }, [isExporting, hookConfig]);

    /**
     * Actualiza el progreso de exportación
     * @param {string} status - Estado actual
     * @param {string} message - Mensaje de progreso
     */
    const updateProgress = useCallback((status, message) => {
        const progress = { status, message, timestamp: Date.now() };
        setExportProgress(progress);

        if (hookConfig.showProgress && hookConfig.onExportProgress) {
            hookConfig.onExportProgress(progress);
        }
    }, [hookConfig]);

    /**
     * Agrega un resultado al historial
     * @param {object} result - Resultado de exportación
     */
    const addToHistory = useCallback((result) => {
        setExportHistory(prev => {
            const updated = [result, ...prev];

            // Limitar tamaño del historial
            if (updated.length > hookConfig.maxHistorySize) {
                return updated.slice(0, hookConfig.maxHistorySize);
            }

            return updated;
        });
    }, [hookConfig.maxHistorySize]);

    /**
     * Cancela la exportación actual
     */
    const cancelExport = useCallback(() => {
        if (abortController.current) {
            abortController.current.abort();
            setIsExporting(false);
            setExportProgress({ status: 'cancelled', message: 'Exportación cancelada' });

            setTimeout(() => {
                setExportProgress(null);
            }, 2000);
        }
    }, []);

    /**
     * Limpia el historial de exportaciones
     */
    const clearHistory = useCallback(() => {
        setExportHistory([]);
    }, []);

    /**
     * Obtiene información de un formato específico
     * @param {string} format - Formato a consultar
     * @returns {object|null} Información del formato
     */
    const getFormatInfo = useCallback((format) => {
        return availableFormats.find(f => f.key === format) || null;
    }, [availableFormats]);

    /**
     * Obtiene las opciones de configuración para un formato
     * @param {string} format - Formato
     * @returns {object|null} Opciones de configuración
     */
    const getFormatOptions = useCallback((format) => {
        const exporter = exportersMap.current[format];
        if (exporter && typeof exporter.getFormatInfo === 'function') {
            const info = exporter.getFormatInfo();
            return info.options || {};
        }
        return {};
    }, []);

    /**
     * Estima el tamaño del archivo para un formato
     * @param {string} format - Formato
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {Promise<number>} Tamaño estimado en bytes
     */
    const estimateFileSize = useCallback(async (format, data, config = {}) => {
        const exporter = exportersMap.current[format];
        if (exporter && typeof exporter.estimateSize === 'function') {
            try {
                return await exporter.estimateSize(data, config);
            } catch (error) {
                console.warn(`Error estimando tamaño para ${format}:`, error);
                return 0;
            }
        }
        return 0;
    }, []);

    /**
     * Genera preview del contenido para un formato
     * @param {string} format - Formato
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {Promise<string>} Preview del contenido
     */
    const generatePreview = useCallback(async (format, data, config = {}) => {
        const exporter = exportersMap.current[format];
        if (exporter && typeof exporter.generatePreview === 'function') {
            try {
                return await exporter.generatePreview(data, config);
            } catch (error) {
                console.warn(`Error generando preview para ${format}:`, error);
                return `Error generando preview: ${error.message}`;
            }
        }
        return 'Preview no disponible para este formato';
    }, []);

    /**
     * Valida datos para un formato específico
     * @param {object} data - Datos a validar
     * @param {object} config - Configuración
     * @param {string} format - Formato
     * @returns {Promise<object>} Resultado de validación
     */
    const validateExportData = useCallback(async (data, config, format) => {
        // Usar el validador del sistema
        const { validateExportData: systemValidator } = await import('./utils/validation.js');
        const { exportConfig } = await import('./config/index.js');

        return systemValidator(data, config, format, exportConfig.limits);
    }, []);

    /**
     * Exporta en múltiples formatos
     * @param {array} formats - Array de formatos
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración base
     * @returns {Promise<object>} Resultados de todas las exportaciones
     */
    const exportMultiple = useCallback(async (formats, data, config = {}) => {
        const results = {
            success: [],
            failed: [],
            total: formats.length
        };

        for (const format of formats) {
            try {
                const result = await exportData(format, data, config);
                results.success.push({ format, result });
            } catch (error) {
                results.failed.push({ format, error: error.message });
            }
        }

        return results;
    }, [exportData]);

    /**
     * Genera un ID único para la exportación
     * @returns {string} ID único
     */
    const generateExportId = useCallback(() => {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Inicializar formatos al cargar el hook
    useState(() => {
        initializeFormats();
    });

    // API del hook
    return {
        // Estado
        isExporting,
        exportProgress,
        lastExportResult,
        exportHistory,
        availableFormats,

        // Funciones principales
        exportData,
        exportMultiple,
        cancelExport,

        // Utilidades
        getFormatInfo,
        getFormatOptions,
        estimateFileSize,
        generatePreview,
        validateExportData,

        // Gestión
        initializeFormats,
        clearHistory,

        // Estado del sistema
        canExport: !isExporting,
        hasFormats: availableFormats.length > 0,
        systemReady: availableFormats.length > 0
    };
};

/**
 * Hook simplificado para exportación rápida
 * @param {string} format - Formato por defecto
 * @param {object} options - Opciones del hook
 * @returns {object} API simplificada
 */
export const useQuickExport = (format, options = {}) => {
    const exportHook = useExport({
        enabledFormats: [format],
        trackHistory: false,
        ...options
    });

    const quickExport = useCallback(async (data, config = {}) => {
        return exportHook.exportData(format, data, config);
    }, [exportHook.exportData, format]);

    return {
        export: quickExport,
        isExporting: exportHook.isExporting,
        lastResult: exportHook.lastExportResult,
        progress: exportHook.exportProgress,
        canExport: exportHook.canExport
    };
};

/**
 * Hook para exportación con configuración personalizada
 * @param {object} options - Opciones del hook
 * @returns {object} API con configuración
 */
export const useConfigurableExport = (options = {}) => {
    const [currentConfig, setCurrentConfig] = useState({});
    const [showConfigForm, setShowConfigForm] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);

    const exportHook = useExport(options);

    const openConfigForm = useCallback((format, initialConfig = {}) => {
        setSelectedFormat(format);
        setCurrentConfig(initialConfig);
        setShowConfigForm(true);
    }, []);

    const closeConfigForm = useCallback(() => {
        setShowConfigForm(false);
        setSelectedFormat(null);
        setCurrentConfig({});
    }, []);

    const updateConfig = useCallback((config) => {
        setCurrentConfig(prev => ({ ...prev, ...config }));
    }, []);

    const exportWithConfig = useCallback(async (data) => {
        if (!selectedFormat) {
            throw new Error('No hay formato seleccionado');
        }

        const result = await exportHook.exportData(selectedFormat, data, currentConfig);
        closeConfigForm();
        return result;
    }, [selectedFormat, currentConfig, exportHook.exportData, closeConfigForm]);

    return {
        ...exportHook,

        // Estado de configuración
        showConfigForm,
        selectedFormat,
        currentConfig,

        // Funciones de configuración
        openConfigForm,
        closeConfigForm,
        updateConfig,
        exportWithConfig
    };
};