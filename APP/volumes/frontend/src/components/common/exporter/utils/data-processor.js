// src/export/utils/data-processor.js
// Procesamiento común de datos para exportación

import { formatValue, autoDetectColumns } from './validation.js';
import { supportedDataTypes } from '../config/data-schema.js';

/**
 * Procesador de datos para exportación
 */
export class DataProcessor {
    constructor(data, config = {}) {
        this.originalData = data;
        this.config = config;
        this.processedData = null;
        this.columns = null;
        this.metadata = null;
    }

    /**
     * Procesa los datos para exportación
     * @returns {DataProcessor} Instancia del procesador
     */
    process() {
        this.extractMetadata();
        this.processColumns();
        this.processRows();
        this.applyFilters();
        this.applySorting();

        return this;
    }

    /**
     * Extrae y procesa metadata
     */
    extractMetadata() {
        this.metadata = {
            title: this.originalData.metadata?.title || 'Exportación de Datos',
            author: this.originalData.metadata?.author || 'Sistema de Exportación',
            createdAt: this.originalData.metadata?.createdAt || new Date().toISOString(),
            description: this.originalData.metadata?.description || '',
            rowCount: 0,
            columnCount: 0,
            generatedAt: new Date().toISOString(),
            ...this.originalData.metadata
        };
    }

    /**
     * Procesa y normaliza las columnas
     */
    processColumns() {
        let columns = this.originalData.columns || [];

        // Auto-detectar columnas si no están definidas
        if (columns.length === 0 && this.originalData.data && this.originalData.data.length > 0) {
            columns = autoDetectColumns(this.originalData.data);
        }

        // Normalizar columnas a formato estándar
        this.columns = columns.map(column => {
            if (typeof column === 'string') {
                return {
                    key: column,
                    header: column.charAt(0).toUpperCase() + column.slice(1),
                    type: 'string',
                    formatter: null,
                    visible: true,
                    sortable: true
                };
            }

            return {
                key: column.key,
                header: column.header || column.key.charAt(0).toUpperCase() + column.key.slice(1),
                type: column.type || 'string',
                formatter: column.formatter || null,
                visible: column.visible !== false,
                sortable: column.sortable !== false,
                width: column.width || null,
                alignment: column.alignment || 'left'
            };
        });

        this.metadata.columnCount = this.columns.filter(col => col.visible).length;
    }

    /**
     * Procesa las filas de datos
     */
    processRows() {
        if (!this.originalData.data || !Array.isArray(this.originalData.data)) {
            this.processedData = [];
            return;
        }

        this.processedData = this.originalData.data.map((row, index) => {
            const processedRow = {};

            this.columns.forEach(column => {
                let value = row[column.key];

                // Aplicar formatter personalizado o por defecto
                if (column.formatter && typeof column.formatter === 'function') {
                    try {
                        value = column.formatter(value, row, index);
                    } catch (error) {
                        console.warn(`Error aplicando formatter para columna ${column.key}:`, error);
                        value = formatValue(value, column.type);
                    }
                } else {
                    value = formatValue(value, column.type);
                }

                // Manejar valores nulos/undefined
                if (value === null || value === undefined) {
                    value = this.getNullReplacement(column.type);
                }

                processedRow[column.key] = value;
            });

            return processedRow;
        });

        this.metadata.rowCount = this.processedData.length;
    }

    /**
     * Aplica filtros a los datos si están configurados
     */
    applyFilters() {
        if (!this.config.filters || !Array.isArray(this.config.filters)) {
            return;
        }

        this.processedData = this.processedData.filter(row => {
            return this.config.filters.every(filter => {
                const value = row[filter.column];

                switch (filter.operator) {
                    case 'equals':
                        return value === filter.value;
                    case 'not_equals':
                        return value !== filter.value;
                    case 'contains':
                        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'not_contains':
                        return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'starts_with':
                        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
                    case 'ends_with':
                        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
                    case 'greater_than':
                        return Number(value) > Number(filter.value);
                    case 'less_than':
                        return Number(value) < Number(filter.value);
                    case 'greater_equal':
                        return Number(value) >= Number(filter.value);
                    case 'less_equal':
                        return Number(value) <= Number(filter.value);
                    case 'is_empty':
                        return value === '' || value === null || value === undefined;
                    case 'is_not_empty':
                        return value !== '' && value !== null && value !== undefined;
                    default:
                        return true;
                }
            });
        });

        this.metadata.rowCount = this.processedData.length;
        this.metadata.filteredData = true;
    }

    /**
     * Aplica ordenamiento a los datos si está configurado
     */
    applySorting() {
        if (!this.config.sort || !this.config.sort.column) {
            return;
        }

        const { column, direction = 'asc' } = this.config.sort;
        const columnInfo = this.columns.find(col => col.key === column);

        if (!columnInfo || !columnInfo.sortable) {
            return;
        }

        this.processedData.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            // Manejar valores nulos
            if (valueA === null || valueA === undefined) valueA = '';
            if (valueB === null || valueB === undefined) valueB = '';

            // Comparar según el tipo de datos
            let comparison = 0;

            switch (columnInfo.type) {
                case 'number':
                    comparison = Number(valueA) - Number(valueB);
                    break;
                case 'date':
                    comparison = new Date(valueA).getTime() - new Date(valueB).getTime();
                    break;
                case 'boolean':
                    comparison = (valueA === valueB) ? 0 : valueA ? 1 : -1;
                    break;
                default: // string
                    comparison = String(valueA).localeCompare(String(valueB));
            }

            return direction === 'desc' ? -comparison : comparison;
        });

        this.metadata.sortedData = true;
        this.metadata.sortColumn = column;
        this.metadata.sortDirection = direction;
    }

    /**
     * Obtiene valor de reemplazo para valores nulos según el tipo
     * @param {string} type - Tipo de datos
     * @returns {any} Valor de reemplazo
     */
    getNullReplacement(type) {
        switch (type) {
            case 'number':
                return 0;
            case 'boolean':
                return false;
            case 'date':
                return '';
            default:
                return '';
        }
    }

    /**
     * Obtiene los datos procesados
     * @returns {array} Array de datos procesados
     */
    getData() {
        return this.processedData || [];
    }

    /**
     * Obtiene las columnas procesadas
     * @returns {array} Array de columnas
     */
    getColumns() {
        return this.columns || [];
    }

    /**
     * Obtiene solo las columnas visibles
     * @returns {array} Array de columnas visibles
     */
    getVisibleColumns() {
        return (this.columns || []).filter(column => column.visible);
    }

    /**
     * Obtiene los metadatos
     * @returns {object} Metadatos
     */
    getMetadata() {
        return this.metadata || {};
    }

    /**
     * Obtiene estadísticas de los datos
     * @returns {object} Estadísticas
     */
    getStatistics() {
        const data = this.getData();
        const columns = this.getVisibleColumns();

        const stats = {
            totalRows: data.length,
            totalColumns: columns.length,
            columnStats: {}
        };

        columns.forEach(column => {
            const values = data.map(row => row[column.key]).filter(value =>
                value !== null && value !== undefined && value !== ''
            );

            stats.columnStats[column.key] = {
                type: column.type,
                totalValues: values.length,
                emptyValues: data.length - values.length,
                uniqueValues: new Set(values).size
            };

            // Estadísticas específicas por tipo
            if (column.type === 'number' && values.length > 0) {
                const numbers = values.map(v => Number(v)).filter(n => !isNaN(n));
                if (numbers.length > 0) {
                    stats.columnStats[column.key].min = Math.min(...numbers);
                    stats.columnStats[column.key].max = Math.max(...numbers);
                    stats.columnStats[column.key].avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
                }
            }

            if (column.type === 'string' && values.length > 0) {
                const lengths = values.map(v => String(v).length);
                stats.columnStats[column.key].minLength = Math.min(...lengths);
                stats.columnStats[column.key].maxLength = Math.max(...lengths);
                stats.columnStats[column.key].avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
            }
        });

        return stats;
    }
}

/**
 * Transforma datos para diferentes formatos de salida
 */
export class DataTransformer {
    /**
     * Transforma datos a formato tabla simple (CSV, TXT)
     * @param {DataProcessor} processor - Procesador de datos
     * @returns {object} Datos transformados
     */
    static toTable(processor) {
        const columns = processor.getVisibleColumns();
        const data = processor.getData();

        return {
            headers: columns.map(col => col.header),
            keys: columns.map(col => col.key),
            rows: data.map(row => columns.map(col => row[col.key])),
            columns: columns,
            metadata: processor.getMetadata()
        };
    }

    /**
     * Transforma datos a formato estructurado (JSON)
     * @param {DataProcessor} processor - Procesador de datos
     * @param {string} format - Formato JSON específico
     * @returns {object} Datos transformados
     */
    static toStructured(processor, format = 'structured') {
        const data = processor.getData();
        const metadata = processor.getMetadata();
        const columns = processor.getVisibleColumns();

        switch (format) {
            case 'array':
                return data;

            case 'envelope':
                return {
                    success: true,
                    data: data,
                    metadata: {
                        ...metadata,
                        columns: columns.map(col => ({
                            key: col.key,
                            header: col.header,
                            type: col.type
                        }))
                    },
                    timestamp: new Date().toISOString()
                };

            case 'structured':
            default:
                return {
                    data: data,
                    columns: columns,
                    metadata: metadata,
                    statistics: processor.getStatistics()
                };
        }
    }

    /**
     * Transforma datos para Excel multi-hoja
     * @param {object} originalData - Datos originales
     * @param {object} config - Configuración
     * @returns {object} Datos transformados para Excel
     */
    static toExcelSheets(originalData, config) {
        // Si ya tiene sheets definidas, procesarlas
        if (originalData.sheets && Array.isArray(originalData.sheets)) {
            return originalData.sheets.map(sheet => {
                const processor = new DataProcessor(sheet, config).process();
                return {
                    name: sheet.name,
                    data: processor.getData(),
                    columns: processor.getVisibleColumns(),
                    metadata: processor.getMetadata()
                };
            });
        }

        // Si no, crear una sola hoja
        const processor = new DataProcessor(originalData, config).process();
        return [{
            name: config.sheetName || 'Datos',
            data: processor.getData(),
            columns: processor.getVisibleColumns(),
            metadata: processor.getMetadata()
        }];
    }

    /**
     * Transforma datos para contenido PDF complejo
     * @param {object} originalData - Datos originales
     * @param {object} config - Configuración
     * @returns {array} Contenido transformado para PDF
     */
    static toPdfContent(originalData, config) {
        // Si ya tiene content definido, devolverlo
        if (originalData.content && Array.isArray(originalData.content)) {
            return originalData.content;
        }

        // Si no, generar contenido automático
        const processor = new DataProcessor(originalData, config).process();
        const content = [];

        // Agregar portada si está habilitada
        if (config.cover && config.cover.enabled) {
            content.push({
                type: 'cover',
                title: config.cover.title || processor.getMetadata().title,
                subtitle: config.cover.subtitle || processor.getMetadata().description,
                logo: config.cover.logo
            });
        }

        // Agregar título del documento
        const metadata = processor.getMetadata();
        if (metadata.title) {
            content.push({
                type: 'title',
                text: metadata.title,
                level: 1
            });
        }

        // Agregar descripción si existe
        if (metadata.description) {
            content.push({
                type: 'paragraph',
                text: metadata.description
            });
        }

        // Agregar estadísticas
        const stats = processor.getStatistics();
        content.push({
            type: 'paragraph',
            text: `Este documento contiene ${stats.totalRows} filas y ${stats.totalColumns} columnas de datos.`
        });

        // Agregar tabla principal
        content.push({
            type: 'table',
            data: processor.getData(),
            columns: processor.getVisibleColumns(),
            title: 'Datos'
        });

        return content;
    }
}

/**
 * Utilidades de procesamiento de datos
 */
export const dataUtils = {
    /**
     * Aplana objetos anidados (convierte a string para evitar dot notation)
     * @param {object} obj - Objeto a aplanar
     * @param {string} separator - Separador para concatenar
     * @returns {object} Objeto aplanado
     */
    flattenObject(obj, separator = ' | ') {
        const flattened = {};

        Object.keys(obj).forEach(key => {
            const value = obj[key];

            if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                // Convertir objeto anidado a string legible
                flattened[key] = JSON.stringify(value, null, 2);
            } else if (Array.isArray(value)) {
                // Convertir array a string separado
                flattened[key] = value.join(separator);
            } else {
                flattened[key] = value;
            }
        });

        return flattened;
    },

    /**
     * Convierte diferentes formatos de fecha a Date
     * @param {any} value - Valor a convertir
     * @returns {Date|null} Fecha convertida o null
     */
    parseDate(value) {
        if (value instanceof Date) return value;
        if (typeof value === 'number') return new Date(value);
        if (typeof value === 'string') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date;
        }
        return null;
    },

    /**
     * Sanitiza texto para diferentes formatos
     * @param {string} text - Texto a sanitizar
     * @param {string} format - Formato objetivo
     * @returns {string} Texto sanitizado
     */
    sanitizeText(text, format) {
        if (typeof text !== 'string') return String(text || '');

        switch (format) {
            case 'csv':
                // Escapar comillas y caracteres especiales
                return text.replace(/"/g, '""');

            case 'xml':
            case 'html':
                // Escapar caracteres XML/HTML
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');

            case 'json':
                // JSON.stringify se encarga del escape
                return text;

            default:
                return text;
        }
    },

    /**
     * Genera ID únicos para elementos
     * @param {string} prefix - Prefijo del ID
     * @returns {string} ID único
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Calcula el tamaño estimado de los datos en bytes
     * @param {any} data - Datos a medir
     * @returns {number} Tamaño en bytes
     */
    estimateSize(data) {
        const json = JSON.stringify(data);
        return new Blob([json]).size;
    }
};