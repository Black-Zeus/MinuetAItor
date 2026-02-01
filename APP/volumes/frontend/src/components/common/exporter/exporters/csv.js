// src/export/exporters/csv.js
// Exportador CSV - sin dependencias externas

import { DataProcessor, DataTransformer } from '../utils/data-processor.js';
import { validateExportData } from '../utils/validation.js';
import { downloadFile } from '../utils/download.js';
import { getExportConfig } from '../config/index.js';

/**
 * Exportador CSV
 */
export const csv = {
    /**
     * Exporta datos a formato CSV
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración de exportación
     * @returns {Promise<object>} Resultado de exportación
     */
    async export(data, config = {}) {
        const result = {
            success: false,
            format: 'csv',
            filename: null,
            content: null,
            size: 0,
            downloadId: null,
            errors: [],
            warnings: []
        };

        try {
            // Obtener configuración completa
            const fullConfig = getExportConfig('csv', config);

            // Validar datos y configuración
            const validation = validateExportData(data, fullConfig, 'csv');

            if (validation.hasErrors()) {
                result.errors = validation.getErrorMessages();
                return result;
            }

            if (validation.hasWarnings()) {
                result.warnings = validation.getWarningMessages();
            }

            // Procesar datos
            const processor = new DataProcessor(validation.data.data, fullConfig).process();

            // Transformar a formato tabla
            const tableData = DataTransformer.toTable(processor);

            // Generar contenido CSV
            const csvContent = this.generateCsvContent(tableData, fullConfig);

            // Preparar información del archivo
            const filename = fullConfig.filename || 'export';
            result.filename = filename;
            result.content = csvContent;
            result.size = new Blob([csvContent]).size;

            // Auto-descarga si está habilitada
            if (fullConfig.autoDownload) {
                const downloadSuccess = await downloadFile(
                    csvContent,
                    filename,
                    'csv',
                    {
                        includeTimestamp: fullConfig.timestamp,
                        useFileSaver: true
                    }
                );

                if (!downloadSuccess) {
                    result.warnings.push('La descarga automática falló, pero el archivo se generó correctamente');
                }
            }

            result.success = true;
            return result;

        } catch (error) {
            result.errors.push(`Error en exportación CSV: ${error.message}`);
            console.error('Error en exportador CSV:', error);
            return result;
        }
    },

    /**
     * Genera el contenido CSV
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Contenido CSV
     */
    generateCsvContent(tableData, config) {
        const delimiter = config.delimiter || ',';
        const lineBreak = config.lineBreak || '\n';
        const quoteStrings = config.quoteStrings !== false;
        const escapeQuotes = config.escapeQuotes !== false;

        const lines = [];

        // Agregar encabezados si están habilitados
        if (config.includeHeader !== false && tableData.headers) {
            const headerLine = tableData.headers
                .map(header => this.formatCsvField(String(header), delimiter, quoteStrings, escapeQuotes))
                .join(delimiter);
            lines.push(headerLine);
        }

        // Agregar filas de datos
        if (tableData.rows && tableData.rows.length > 0) {
            tableData.rows.forEach(row => {
                const csvRow = row
                    .map(cell => this.formatCsvField(this.prepareCellValue(cell), delimiter, quoteStrings, escapeQuotes))
                    .join(delimiter);
                lines.push(csvRow);
            });
        }

        return lines.join(lineBreak);
    },

    /**
     * Prepara el valor de una celda para CSV
     * @param {any} value - Valor original
     * @returns {string} Valor preparado
     */
    prepareCellValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        }

        if (typeof value === 'number') {
            // Manejar números especiales
            if (isNaN(value)) return 'NaN';
            if (value === Infinity) return 'Infinity';
            if (value === -Infinity) return '-Infinity';
            return String(value);
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (Array.isArray(value)) {
            return value.join('; ');
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    },

    /**
     * Formatea un campo para CSV según las reglas de escape
     * @param {string} field - Campo a formatear
     * @param {string} delimiter - Delimitador usado
     * @param {boolean} quoteStrings - Si envolver strings en comillas
     * @param {boolean} escapeQuotes - Si escapar comillas internas
     * @returns {string} Campo formateado
     */
    formatCsvField(field, delimiter, quoteStrings, escapeQuotes) {
        let formattedField = String(field);

        // Verificar si necesita ser envuelto en comillas
        const needsQuoting = quoteStrings && (
            formattedField.includes(delimiter) ||
            formattedField.includes('\n') ||
            formattedField.includes('\r') ||
            formattedField.includes('"')
        );

        if (needsQuoting || (quoteStrings && isNaN(Number(formattedField)) && formattedField !== '')) {
            // Escapar comillas internas si está habilitado
            if (escapeQuotes) {
                formattedField = formattedField.replace(/"/g, '""');
            }

            // Envolver en comillas
            formattedField = `"${formattedField}"`;
        }

        return formattedField;
    },

    /**
     * Valida configuración específica de CSV
     * @param {object} config - Configuración a validar
     * @returns {object} Resultado de validación
     */
    validateCsvConfig(config) {
        const result = { valid: true, errors: [], warnings: [] };

        // Validar delimitador
        if (config.delimiter) {
            if (typeof config.delimiter !== 'string') {
                result.valid = false;
                result.errors.push('El delimitador debe ser un string');
            } else if (config.delimiter.length !== 1) {
                result.warnings.push('Se recomienda usar delimitadores de un solo carácter');
            }
        }

        // Validar encoding
        if (config.encoding && !['utf-8', 'latin1', 'ascii'].includes(config.encoding)) {
            result.warnings.push('Encoding no estándar, puede causar problemas de compatibilidad');
        }

        return result;
    },

    /**
     * Detecta el delimitador más apropiado según los datos
     * @param {object} tableData - Datos en formato tabla
     * @returns {string} Delimitador recomendado
     */
    detectOptimalDelimiter(tableData) {
        const delimiters = [',', ';', '\t', '|'];
        const scores = {};

        // Inicializar scores
        delimiters.forEach(delim => {
            scores[delim] = 0;
        });

        // Analizar contenido para encontrar conflictos
        if (tableData.rows && tableData.rows.length > 0) {
            tableData.rows.forEach(row => {
                row.forEach(cell => {
                    const cellStr = String(cell);
                    delimiters.forEach(delim => {
                        if (cellStr.includes(delim)) {
                            scores[delim] += 1; // Penalizar si el delimitador aparece en los datos
                        }
                    });
                });
            });
        }

        // Retornar el delimitador con menor score (menos conflictos)
        return delimiters.reduce((best, current) =>
            scores[current] < scores[best] ? current : best
        );
    },

    /**
     * Genera estadísticas del archivo CSV
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {object} Estadísticas
     */
    generateStats(tableData, config) {
        const stats = {
            totalRows: tableData.rows ? tableData.rows.length : 0,
            totalColumns: tableData.headers ? tableData.headers.length : 0,
            hasHeader: config.includeHeader !== false,
            delimiter: config.delimiter || ',',
            encoding: config.encoding || 'utf-8',
            estimatedSize: 0
        };

        // Estimar tamaño
        const sampleContent = this.generateCsvContent(
            {
                headers: tableData.headers,
                rows: tableData.rows ? tableData.rows.slice(0, 10) : []
            },
            config
        );

        if (tableData.rows && tableData.rows.length > 0) {
            stats.estimatedSize = Math.ceil(
                (sampleContent.length / Math.min(10, tableData.rows.length)) * tableData.rows.length
            );
        }

        // Detectar problemas potenciales
        stats.warnings = [];

        if (stats.totalRows > 1000000) {
            stats.warnings.push('Archivo muy grande, puede tener problemas de rendimiento');
        }

        if (stats.totalColumns > 100) {
            stats.warnings.push('Muchas columnas, considere dividir en múltiples archivos');
        }

        // Verificar si hay campos que contienen el delimitador
        const delimiter = config.delimiter || ',';
        let fieldsWithDelimiter = 0;

        if (tableData.rows) {
            tableData.rows.forEach(row => {
                row.forEach(cell => {
                    if (String(cell).includes(delimiter)) {
                        fieldsWithDelimiter++;
                    }
                });
            });
        }

        if (fieldsWithDelimiter > 0) {
            stats.warnings.push(`${fieldsWithDelimiter} campos contienen el delimitador, se envolverán en comillas`);
        }

        return stats;
    },

    /**
     * Parsea contenido CSV
     * @param {string} csvContent - Contenido CSV a parsear
     * @param {object} config - Configuración de parsing
     * @returns {object} Datos parseados
     */
    parseCsv(csvContent, config = {}) {
        const result = {
            success: false,
            data: [],
            headers: [],
            errors: [],
            warnings: []
        };

        try {
            const delimiter = config.delimiter || this.detectDelimiter(csvContent);
            const hasHeader = config.hasHeader !== false;
            const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

            if (lines.length === 0) {
                result.warnings.push('Archivo CSV vacío');
                result.success = true;
                return result;
            }

            let dataLines = lines;

            // Extraer headers si están presentes
            if (hasHeader && lines.length > 0) {
                const headerLine = lines[0];
                result.headers = this.parseCsvLine(headerLine, delimiter);
                dataLines = lines.slice(1);
            }

            // Parsear líneas de datos
            dataLines.forEach((line, index) => {
                try {
                    const row = this.parseCsvLine(line, delimiter);

                    // Convertir array a objeto si hay headers
                    if (result.headers.length > 0) {
                        const rowObject = {};
                        result.headers.forEach((header, i) => {
                            rowObject[header] = row[i] || '';
                        });
                        result.data.push(rowObject);
                    } else {
                        result.data.push(row);
                    }

                } catch (error) {
                    result.warnings.push(`Error en línea ${index + (hasHeader ? 2 : 1)}: ${error.message}`);
                }
            });

            result.success = true;

        } catch (error) {
            result.errors.push(`Error parseando CSV: ${error.message}`);
        }

        return result;
    },

    /**
     * Parsea una línea CSV individual
     * @param {string} line - Línea a parsear
     * @param {string} delimiter - Delimitador
     * @returns {array} Array de campos
     */
    parseCsvLine(line, delimiter) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Comilla escapada
                    current += '"';
                    i += 2;
                } else {
                    // Inicio o fin de campo entre comillas
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === delimiter && !inQuotes) {
                // Fin de campo
                fields.push(current);
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }

        // Agregar último campo
        fields.push(current);

        return fields;
    },

    /**
     * Detecta el delimitador de un contenido CSV
     * @param {string} csvContent - Contenido CSV
     * @returns {string} Delimitador detectado
     */
    detectDelimiter(csvContent) {
        const delimiters = [',', ';', '\t', '|'];
        const firstLine = csvContent.split(/\r?\n/)[0] || '';

        const counts = delimiters.map(delim => ({
            delimiter: delim,
            count: (firstLine.match(new RegExp(`\\${delim}`, 'g')) || []).length
        }));

        // Retornar el delimitador con más ocurrencias
        const best = counts.reduce((max, current) =>
            current.count > max.count ? current : max
        );

        return best.count > 0 ? best.delimiter : ',';
    },

    /**
     * Obtiene información sobre el formato CSV
     * @returns {object} Información del formato
     */
    getFormatInfo() {
        return {
            name: 'CSV',
            extension: 'csv',
            mimeType: 'text/csv',
            description: 'Comma Separated Values - formato de datos tabulares',
            features: {
                supportsMetadata: false,
                supportsMultiSheet: false,
                supportsFormatting: false,
                preservesDataTypes: false
            },
            options: {
                delimiter: {
                    type: 'string',
                    default: ',',
                    description: 'Separador de campos'
                },
                includeHeader: {
                    type: 'boolean',
                    default: true,
                    description: 'Incluir fila de encabezados'
                },
                quoteStrings: {
                    type: 'boolean',
                    default: true,
                    description: 'Envolver strings en comillas'
                },
                escapeQuotes: {
                    type: 'boolean',
                    default: true,
                    description: 'Escapar comillas internas'
                },
                encoding: {
                    type: 'string',
                    default: 'utf-8',
                    description: 'Codificación del archivo'
                }
            }
        };
    },

    /**
     * Genera preview del contenido CSV
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @param {number} maxRows - Número máximo de filas para preview
     * @returns {string} Preview del contenido
     */
    generatePreview(data, config = {}, maxRows = 10) {
        try {
            const processor = new DataProcessor(data, config).process();
            const tableData = DataTransformer.toTable(processor);

            // Limitar filas para preview
            const previewData = {
                ...tableData,
                rows: tableData.rows ? tableData.rows.slice(0, maxRows) : []
            };

            let preview = this.generateCsvContent(previewData, config);

            if (tableData.rows && tableData.rows.length > maxRows) {
                preview += `\n... (${tableData.rows.length - maxRows} filas más)`;
            }

            return preview;

        } catch (error) {
            return `Error generando preview: ${error.message}`;
        }
    }
};