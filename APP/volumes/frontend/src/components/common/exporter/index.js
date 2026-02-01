// src/export/index.js
// API principal del sistema de exportación
import { isDevelopment, DEBUG_MODE } from '@utils/environment.js';

// =====================================================
// IMPORTS LOCALES (para uso interno de este módulo)
// =====================================================

// --- Exportadores (formato) ---
import { csv } from './exporters/csv.js';
import { json } from './exporters/json.js';
import { excel } from './exporters/excel.js';
import { pdf } from './exporters/pdf.js';
import { txt } from './exporters/txt.js';

// --- Hooks de React ---
import {
    useExport,
    useQuickExport,
    useConfigurableExport
} from './useExport.js';

// --- Componentes principales ---
import { ExportButton } from './components/buttons/ExportButton.jsx';
import { ExportDropdown } from './components/buttons/ExportDropdown.jsx';
import { ExportForm } from './components/forms/ExportForm.jsx';

// --- Formularios específicos ---
import { ExportFormJSON } from './components/forms/ExportFormJSON.jsx';
import { ExportFormCSV } from './components/forms/ExportFormCSV.jsx';
import { ExportFormExcel } from './components/forms/ExportFormExcel.jsx';
import { ExportFormPDF } from './components/forms/ExportFormPDF.jsx';
import { ExportFormTXT } from './components/forms/ExportFormTXT.jsx';

// --- Utilidades de UI ---
import {
    ExportProgress,
    ExportProgressInline,
    ExportProgressToast,
    ExportProgressBar
} from './utils/ExportProgress.jsx';

// --- Configuración y utilidades de sistema ---
import {
    exportConfig,
    initializeExportSystem,
    resetSystem,
    getSystemState,
    loadDependency,
    getExportConfig,
    validateFormat,
    dataSchema,
    configSchema,
    pdfContentSchema,
    supportedDataTypes,
    supportedFormats,
    formatDefaults,
    globalDefaults,
    presetConfigs,
    getFormatDefaults,
    mergeConfig,
    generateFilename,
    getPresetConfig
} from './config/index.js';

// --- Utilidades de procesamiento ---
import {
    DataProcessor,
    DataTransformer,
    dataUtils
} from './utils/data-processor.js';

// --- Validación ---
import {
    validateExportData,
    validateDataType,
    formatValue,
    cleanDataForExport,
    autoDetectColumns
} from './utils/validation.js';

// --- Descargas ---
import {
    DownloadManager,
    downloadManager,
    downloadFile,
    downloadUtils
} from './utils/download.js';


// =====================================================
// RE-EXPORTS (API pública)
// =====================================================

// === EXPORTADORES ===
export { csv } from './exporters/csv.js';
export { json } from './exporters/json.js';
export { excel } from './exporters/excel.js';
export { pdf } from './exporters/pdf.js';
export { txt } from './exporters/txt.js';

// === HOOKS DE REACT ===
export {
    useExport,
    useQuickExport,
    useConfigurableExport
} from './useExport.js';

// === COMPONENTES PRINCIPALES ===
export { ExportButton } from './components/buttons/ExportButton.jsx';
export { ExportDropdown } from './components/buttons/ExportDropdown.jsx';

// Formulario principal
export { ExportForm } from './components/forms/ExportForm.jsx';

// === FORMULARIOS ESPECÍFICOS ===
export { ExportFormJSON } from './components/forms/ExportFormJSON.jsx';
export { ExportFormCSV } from './components/forms/ExportFormCSV.jsx';
export { ExportFormExcel } from './components/forms/ExportFormExcel.jsx';
export { ExportFormPDF } from './components/forms/ExportFormPDF.jsx';
export { ExportFormTXT } from './components/forms/ExportFormTXT.jsx';

// === COMPONENTES DE UTILIDAD ===
export {
    ExportProgress,
    ExportProgressInline,
    ExportProgressToast,
    ExportProgressBar
} from './utils/ExportProgress.jsx';

// === CONFIGURACIÓN DEL SISTEMA ===
export {
    exportConfig,
    initializeExportSystem,
    resetSystem,
    getSystemState,
    loadDependency,
    getExportConfig,
    validateFormat,
    dataSchema,
    configSchema,
    pdfContentSchema,
    supportedDataTypes,
    supportedFormats,
    formatDefaults,
    globalDefaults,
    presetConfigs,
    getFormatDefaults,
    mergeConfig,
    generateFilename,
    getPresetConfig
} from './config/index.js';

// === UTILIDADES DE PROCESAMIENTO ===
export {
    DataProcessor,
    DataTransformer,
    dataUtils
} from './utils/data-processor.js';

// === VALIDACIÓN ===
export {
    validateExportData,
    validateDataType,
    formatValue,
    cleanDataForExport,
    autoDetectColumns
} from './utils/validation.js';

// === DESCARGAS ===
export {
    DownloadManager,
    downloadManager,
    downloadFile,
    downloadUtils
} from './utils/download.js';


// =====================================================
// VERSIÓN Y METADATOS
// =====================================================
export const EXPORT_SYSTEM_INFO = {
    version: '1.0.0',
    name: 'Export System',
    description: 'Sistema completo de exportación de datos para React',
    author: 'Export System Team',
    supportedFormats: ['csv', 'json', 'excel', 'pdf', 'txt'],
    features: {
        multiFormat: true,
        customConfiguration: true,
        realTimePreview: true,
        progressTracking: true,
        darkMode: true,
        typescript: false,
        accessibility: true
    },
    dependencies: {
        required: ['react'],
        optional: ['xlsx', 'exceljs', 'pdfmake', 'file-saver'],
        tailwind: true
    },
    compatibility: {
        react: '>=16.8.0',
        browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
        mobile: true
    }
};


// =====================================================
// FUNCIONES DE CONVENIENCIA
// =====================================================
export const initExportSystem = (customConfig = {}) => {
    return initializeExportSystem(customConfig);
};

export const quickExport = async (format, data, config = {}) => {
    // Mapa de exportadores disponibles
    const exporters = { csv, json, excel, pdf, txt };
    const exporter = exporters[format];

    if (!exporter) {
        throw new Error(`Formato no soportado: ${format}`);
    }

    // Configuración completa
    const fullConfig = getExportConfig(format, config);

    // Ejecutar exportación
    return await exporter.export(data, fullConfig);
};

export const multiExport = async (formats, data, baseConfig = {}) => {
    const results = {
        successful: [],
        failed: [],
        total: formats.length
    };

    const promises = formats.map(async (format) => {
        try {
            const result = await quickExport(format, data, {
                ...baseConfig,
                filename: baseConfig.filename
                    ? `${baseConfig.filename}_${format}`
                    : `export_${format}`
            });

            results.successful.push({ format, result });
            return { format, success: true, result };
        } catch (error) {
            results.failed.push({ format, error: error.message });
            return { format, success: false, error: error.message };
        }
    });

    await Promise.allSettled(promises);
    return results;
};

export const validateData = (data, format, config = {}) => {
    const fullConfig = getExportConfig(format, config);
    return validateExportData(data, fullConfig, format, exportConfig.limits);
};

export const getFormatInfo = (format) => {
    const exporters = { csv, json, excel, pdf, txt };
    const exporter = exporters[format];

    if (!exporter || typeof exporter.getFormatInfo !== 'function') {
        return null;
    }

    // Nota: supportedFormats suele ser un array; si en tu config es un mapa, esto seguirá funcionando.
    const systemInfo =
        Array.isArray(supportedFormats)
            ? (supportedFormats.includes(format) ? { supported: true } : null)
            : (supportedFormats?.[format] ?? null);

    return {
        ...exporter.getFormatInfo(),
        systemInfo,
        available: validateFormat(format).valid
    };
};

export const createSampleData = (rows = 10, columns = null) => {
    const defaultColumns = [
        { key: 'id', header: 'ID', type: 'number' },
        { key: 'name', header: 'Nombre', type: 'string' },
        { key: 'email', header: 'Email', type: 'string' },
        { key: 'active', header: 'Activo', type: 'boolean' },
        { key: 'created', header: 'Creado', type: 'date' }
    ];

    const sampleColumns = columns || defaultColumns;
    const data = [];

    for (let i = 0; i < rows; i++) {
        const row = {};
        sampleColumns.forEach(column => {
            switch (column.type) {
                case 'number':
                    row[column.key] = i + 1;
                    break;
                case 'string':
                    row[column.key] =
                        column.key === 'name'
                            ? `Usuario ${i + 1}`
                            : column.key === 'email'
                                ? `user${i + 1}@example.com`
                                : `Valor ${i + 1}`;
                    break;
                case 'boolean':
                    row[column.key] = Math.random() > 0.5;
                    break;
                case 'date':
                    row[column.key] = new Date(
                        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
                    ).toISOString();
                    break;
                default:
                    row[column.key] = `Dato ${i + 1}`;
            }
        });
        data.push(row);
    }

    return {
        data,
        columns: sampleColumns,
        metadata: {
            title: 'Datos de Ejemplo',
            description: `Dataset de ejemplo con ${rows} registros`,
            author: 'Sistema de Exportación',
            createdAt: new Date().toISOString()
        }
    };
};


// =====================================================
// EXPORT POR DEFECTO (bundling friendly)
// =====================================================
export default {
    // Funciones principales
    quickExport,
    multiExport,
    validateData,
    createSampleData,

    // Hooks
    useExport,
    useQuickExport,
    useConfigurableExport,

    // Componentes principales
    ExportButton,
    ExportDropdown,
    ExportForm,
    ExportProgress,

    // Sistema
    initExportSystem,
    getSystemState,
    getFormatInfo,

    // Información
    version: EXPORT_SYSTEM_INFO.version,
    supportedFormats: EXPORT_SYSTEM_INFO.supportedFormats
};


// =====================================================
// VERIFICACIÓN DE DEPENDENCIAS (opcional en navegador)
// =====================================================
if (typeof window !== 'undefined') {
    const optionalDeps = {
        xlsx: () => typeof window.XLSX !== 'undefined' || Boolean(require?.resolve?.('xlsx')),
        exceljs: () => Boolean(require?.resolve?.('exceljs')),
        pdfmake: () => typeof window.pdfMake !== 'undefined' || Boolean(require?.resolve?.('pdfmake')),
        fileSaver: () => Boolean(require?.resolve?.('file-saver'))
    };

    // Evalúa solo en desarrollo y cuando el debug está activado (para tree-shaking en build)
    const shouldDebugLog = isDevelopment() && (DEBUG_MODE === true);

    if (shouldDebugLog) {
        const availability = Object.entries(optionalDeps).reduce((acc, [key, checker]) => {
            try { acc[key] = checker(); } catch { acc[key] = false; }
            return acc;
        }, {});
        // eslint-disable-next-line no-console
        console.log('[Export System] Dependencias disponibles:', availability);
    }
}
