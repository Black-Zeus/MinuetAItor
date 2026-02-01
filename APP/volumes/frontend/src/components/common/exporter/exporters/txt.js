// src/export/exporters/txt.js
// Exportador TXT - sin dependencias externas

import { DataProcessor, DataTransformer } from '../utils/data-processor.js';
import { validateExportData } from '../utils/validation.js';
import { downloadFile } from '../utils/download.js';
import { getExportConfig } from '../config/index.js';

/**
 * Exportador TXT
 */
export const txt = {
    /**
     * Exporta datos a formato TXT
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración de exportación
     * @returns {Promise<object>} Resultado de exportación
     */
    async export(data, config = {}) {
        const result = {
            success: false,
            format: 'txt',
            filename: null,
            content: null,
            size: 0,
            downloadId: null,
            errors: [],
            warnings: []
        };

        try {
            // Obtener configuración completa
            const fullConfig = getExportConfig('txt', config);

            // Validar datos y configuración
            const validation = validateExportData(data, fullConfig, 'txt');

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

            // Generar contenido TXT según el layout especificado
            const txtContent = this.generateTxtContent(tableData, fullConfig);

            // Preparar información del archivo
            const filename = fullConfig.filename || 'export';
            result.filename = filename;
            result.content = txtContent;
            result.size = new Blob([txtContent]).size;

            // Auto-descarga si está habilitada
            if (fullConfig.autoDownload) {
                const downloadSuccess = await downloadFile(
                    txtContent,
                    filename,
                    'txt',
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
            result.errors.push(`Error en exportación TXT: ${error.message}`);
            console.error('Error en exportador TXT:', error);
            return result;
        }
    },

    /**
     * Genera el contenido TXT según el layout configurado
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Contenido TXT
     */
    generateTxtContent(tableData, config) {
        const layout = config.layout || 'delimited';

        switch (layout) {
            case 'delimited':
                return this.generateDelimitedContent(tableData, config);
            case 'fixed':
                return this.generateFixedWidthContent(tableData, config);
            case 'aligned':
                return this.generateAlignedContent(tableData, config);
            case 'report':
                return this.generateReportContent(tableData, config);
            default:
                return this.generateDelimitedContent(tableData, config);
        }
    },

    /**
     * Genera contenido delimitado (similar a CSV pero con tab por defecto)
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Contenido delimitado
     */
    generateDelimitedContent(tableData, config) {
        const delimiter = config.delimiter || '\t';
        const lineBreak = config.lineBreak || '\n';
        const lines = [];

        // Agregar encabezados si están habilitados
        if (config.includeHeader !== false && tableData.headers) {
            const headerLine = tableData.headers
                .map(header => this.sanitizeField(String(header)))
                .join(delimiter);
            lines.push(headerLine);
        }

        // Agregar filas de datos
        if (tableData.rows && tableData.rows.length > 0) {
            tableData.rows.forEach(row => {
                const txtRow = row
                    .map(cell => this.sanitizeField(this.prepareCellValue(cell)))
                    .join(delimiter);
                lines.push(txtRow);
            });
        }

        return lines.join(lineBreak);
    },

    /**
     * Genera contenido con ancho fijo
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Contenido de ancho fijo
     */
    generateFixedWidthContent(tableData, config) {
        const lineBreak = config.lineBreak || '\n';
        const fillChar = config.fillChar || ' ';
        const lines = [];

        // Calcular anchos de columna
        const columnWidths = this.calculateColumnWidths(tableData, config);

        // Agregar encabezados si están habilitados
        if (config.includeHeader !== false && tableData.headers) {
            const headerLine = tableData.headers
                .map((header, index) => this.padField(
                    this.sanitizeField(String(header)),
                    columnWidths[index],
                    'left',
                    fillChar
                ))
                .join('');
            lines.push(headerLine);

            // Agregar línea separadora
            if (config.includeSeparator !== false) {
                const separatorLine = columnWidths
                    .map(width => '-'.repeat(width))
                    .join('');
                lines.push(separatorLine);
            }
        }

        // Agregar filas de datos
        if (tableData.rows && tableData.rows.length > 0) {
            tableData.rows.forEach(row => {
                const txtRow = row
                    .map((cell, index) => {
                        const alignment = this.getCellAlignment(tableData.columns[index]);
                        return this.padField(
                            this.sanitizeField(this.prepareCellValue(cell)),
                            columnWidths[index],
                            alignment,
                            fillChar
                        );
                    })
                    .join('');
                lines.push(txtRow);
            });
        }

        return lines.join(lineBreak);
    },

    /**
     * Genera contenido alineado (columnas visualmente alineadas)
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Contenido alineado
     */
    generateAlignedContent(tableData, config) {
        const lineBreak = config.lineBreak || '\n';
        const columnSeparator = config.columnSeparator || ' | ';
        const lines = [];

        // Calcular anchos de columna
        const columnWidths = this.calculateColumnWidths(tableData, config);

        // Agregar encabezados si están habilitados
        if (config.includeHeader !== false && tableData.headers) {
            const headerLine = tableData.headers
                .map((header, index) => this.padField(
                    this.sanitizeField(String(header)),
                    columnWidths[index],
                    'center'
                ))
                .join(columnSeparator);
            lines.push(headerLine);

            // Agregar línea separadora
            if (config.includeSeparator !== false) {
                const separatorLine = columnWidths
                    .map(width => '='.repeat(width))
                    .join(columnSeparator.replace(/./g, '='));
                lines.push(separatorLine);
            }
        }

        // Agregar filas de datos
        if (tableData.rows && tableData.rows.length > 0) {
            tableData.rows.forEach(row => {
                const txtRow = row
                    .map((cell, index) => {
                        const alignment = this.getCellAlignment(tableData.columns[index]);
                        return this.padField(
                            this.sanitizeField(this.prepareCellValue(cell)),
                            columnWidths[index],
                            alignment
                        );
                    })
                    .join(columnSeparator);
                lines.push(txtRow);
            });
        }

        return lines.join(lineBreak);
    },

    /**
     * Genera contenido en formato reporte
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Contenido en formato reporte
     */
    generateReportContent(tableData, config) {
        const lineBreak = config.lineBreak || '\n';
        const sections = [];

        // Encabezado del reporte
        if (tableData.metadata && tableData.metadata.title) {
            sections.push(this.createReportHeader(tableData.metadata, config));
        }

        // Resumen de datos
        if (config.includeSummary !== false) {
            sections.push(this.createDataSummary(tableData, config));
        }

        // Datos principales
        sections.push(this.createDataSection(tableData, config));

        // Pie del reporte
        if (config.includeFooter !== false) {
            sections.push(this.createReportFooter(tableData.metadata, config));
        }

        return sections.filter(section => section).join(lineBreak + lineBreak);
    },

    /**
     * Crea encabezado del reporte
     * @param {object} metadata - Metadatos
     * @param {object} config - Configuración
     * @returns {string} Encabezado
     */
    createReportHeader(metadata, config) {
        const lines = [];
        const separator = '='.repeat(config.reportWidth || 80);

        lines.push(separator);
        lines.push(this.centerText(metadata.title || 'REPORTE DE DATOS', config.reportWidth || 80));

        if (metadata.description) {
            lines.push(this.centerText(metadata.description, config.reportWidth || 80));
        }

        lines.push(separator);

        // Información adicional
        const now = new Date();
        lines.push(`Generado: ${now.toLocaleString()}`);

        if (metadata.author) {
            lines.push(`Autor: ${metadata.author}`);
        }

        return lines.join('\n');
    },

    /**
     * Crea resumen de datos
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Resumen
     */
    createDataSummary(tableData, config) {
        const lines = [];

        lines.push('RESUMEN DE DATOS');
        lines.push('-'.repeat(20));
        lines.push(`Total de registros: ${tableData.rows ? tableData.rows.length : 0}`);
        lines.push(`Total de columnas: ${tableData.headers ? tableData.headers.length : 0}`);

        if (tableData.headers) {
            lines.push('');
            lines.push('Columnas disponibles:');
            tableData.headers.forEach((header, index) => {
                lines.push(`  ${index + 1}. ${header}`);
            });
        }

        return lines.join('\n');
    },

    /**
     * Crea sección de datos
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {string} Sección de datos
     */
    createDataSection(tableData, config) {
        const lines = [];

        lines.push('DATOS');
        lines.push('-'.repeat(10));

        // Generar tabla alineada para la sección de datos
        const tableContent = this.generateAlignedContent(tableData, config);
        lines.push(tableContent);

        return lines.join('\n');
    },

    /**
     * Crea pie del reporte
     * @param {object} metadata - Metadatos
     * @param {object} config - Configuración
     * @returns {string} Pie
     */
    createReportFooter(metadata, config) {
        const lines = [];
        const separator = '='.repeat(config.reportWidth || 80);

        lines.push(separator);
        lines.push('FIN DEL REPORTE');

        if (config.includeTimestamp !== false) {
            lines.push(`Timestamp: ${new Date().toISOString()}`);
        }

        return lines.join('\n');
    },

    /**
     * Calcula los anchos de columna necesarios
     * @param {object} tableData - Datos en formato tabla
     * @param {object} config - Configuración
     * @returns {array} Array de anchos
     */
    calculateColumnWidths(tableData, config) {
        const minWidth = config.minColumnWidth || 5;
        const maxWidth = config.maxColumnWidth || 50;
        const widths = [];

        // Inicializar con headers si existen
        if (tableData.headers) {
            tableData.headers.forEach(header => {
                widths.push(Math.max(minWidth, String(header).length));
            });
        }

        // Examinar todas las filas para encontrar el ancho máximo necesario
        if (tableData.rows && tableData.rows.length > 0) {
            tableData.rows.forEach(row => {
                row.forEach((cell, index) => {
                    const cellLength = String(this.prepareCellValue(cell)).length;
                    if (widths[index]) {
                        widths[index] = Math.max(widths[index], cellLength);
                    } else {
                        widths[index] = Math.max(minWidth, cellLength);
                    }
                });
            });
        }

        // Aplicar límite máximo
        return widths.map(width => Math.min(width, maxWidth));
    },

    /**
     * Prepara el valor de una celda para TXT
     * @param {any} value - Valor original
     * @returns {string} Valor preparado
     */
    prepareCellValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'boolean') {
            return value ? 'Sí' : 'No';
        }

        if (typeof value === 'number') {
            if (isNaN(value)) return 'N/A';
            if (value === Infinity) return '∞';
            if (value === -Infinity) return '-∞';

            // Formatear números grandes
            if (Math.abs(value) >= 1000000) {
                return (value / 1000000).toFixed(2) + 'M';
            } else if (Math.abs(value) >= 1000) {
                return (value / 1000).toFixed(1) + 'K';
            }

            return String(value);
        }

        if (value instanceof Date) {
            return value.toLocaleDateString();
        }

        if (Array.isArray(value)) {
            return value.join(', ');
        }

        if (typeof value === 'object') {
            return '[Objeto]';
        }

        return String(value);
    },

    /**
     * Sanitiza un campo para TXT
     * @param {string} field - Campo a sanitizar
     * @returns {string} Campo sanitizado
     */
    sanitizeField(field) {
        return String(field)
            .replace(/\n/g, ' ')  // Remover saltos de línea
            .replace(/\r/g, ' ')  // Remover retornos de carro
            .replace(/\t/g, ' ')  // Convertir tabs a espacios
            .trim();
    },

    /**
     * Rellena un campo a un ancho específico
     * @param {string} text - Texto a rellenar
     * @param {number} width - Ancho objetivo
     * @param {string} alignment - Alineación (left, right, center)
     * @param {string} fillChar - Carácter de relleno
     * @returns {string} Texto rellenado
     */
    padField(text, width, alignment = 'left', fillChar = ' ') {
        const str = String(text);

        if (str.length >= width) {
            return str.substring(0, width);
        }

        const padding = width - str.length;

        switch (alignment) {
            case 'right':
                return fillChar.repeat(padding) + str;
            case 'center':
                const leftPad = Math.floor(padding / 2);
                const rightPad = padding - leftPad;
                return fillChar.repeat(leftPad) + str + fillChar.repeat(rightPad);
            case 'left':
            default:
                return str + fillChar.repeat(padding);
        }
    },

    /**
     * Centra texto en un ancho específico
     * @param {string} text - Texto a centrar
     * @param {number} width - Ancho total
     * @returns {string} Texto centrado
     */
    centerText(text, width) {
        return this.padField(text, width, 'center');
    },

    /**
     * Obtiene la alineación de una celda según su tipo
     * @param {object} column - Información de columna
     * @returns {string} Tipo de alineación
     */
    getCellAlignment(column) {
        if (!column || !column.type) return 'left';

        switch (column.type) {
            case 'number':
                return 'right';
            case 'boolean':
                return 'center';
            case 'date':
                return 'center';
            default:
                return 'left';
        }
    },

    /**
     * Obtiene información sobre el formato TXT
     * @returns {object} Información del formato
     */
    getFormatInfo() {
        return {
            name: 'TXT',
            extension: 'txt',
            mimeType: 'text/plain',
            description: 'Archivo de texto plano con datos tabulares',
            features: {
                supportsMetadata: false,
                supportsMultiSheet: false,
                supportsFormatting: true, // Alineación y formato visual
                preservesDataTypes: false
            },
            options: {
                layout: {
                    type: 'string',
                    values: ['delimited', 'fixed', 'aligned', 'report'],
                    default: 'delimited',
                    description: 'Tipo de layout del archivo'
                },
                delimiter: {
                    type: 'string',
                    default: '\t',
                    description: 'Separador para layout delimitado'
                },
                includeHeader: {
                    type: 'boolean',
                    default: true,
                    description: 'Incluir fila de encabezados'
                },
                columnSeparator: {
                    type: 'string',
                    default: ' | ',
                    description: 'Separador de columnas para layout alineado'
                },
                reportWidth: {
                    type: 'number',
                    default: 80,
                    description: 'Ancho del reporte en caracteres'
                }
            }
        };
    },

    /**
     * Genera preview del contenido TXT
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @param {number} maxLines - Número máximo de líneas para preview
     * @returns {string} Preview del contenido
     */
    generatePreview(data, config = {}, maxLines = 15) {
        try {
            const processor = new DataProcessor(data, config).process();
            const tableData = DataTransformer.toTable(processor);

            // Limitar filas para preview
            const previewData = {
                ...tableData,
                rows: tableData.rows ? tableData.rows.slice(0, maxLines - 2) : []
            };

            let preview = this.generateTxtContent(previewData, config);
            const lines = preview.split('\n');

            if (lines.length > maxLines) {
                preview = lines.slice(0, maxLines).join('\n');
                preview += `\n... (${lines.length - maxLines} líneas más)`;
            }

            if (tableData.rows && tableData.rows.length > (maxLines - 2)) {
                preview += `\n\nTotal de registros: ${tableData.rows.length}`;
            }

            return preview;

        } catch (error) {
            return `Error generando preview: ${error.message}`;
        }
    },

    /**
     * Convierte archivo TXT a datos estructurados
     * @param {string} txtContent - Contenido TXT
     * @param {object} config - Configuración de parsing
     * @returns {object} Datos parseados
     */
    parseTxt(txtContent, config = {}) {
        const result = {
            success: false,
            data: [],
            headers: [],
            errors: [],
            warnings: []
        };

        try {
            const layout = config.layout || 'delimited';

            switch (layout) {
                case 'delimited':
                    return this.parseDelimitedTxt(txtContent, config);
                case 'fixed':
                    return this.parseFixedWidthTxt(txtContent, config);
                default:
                    result.errors.push(`Layout no soportado para parsing: ${layout}`);
                    return result;
            }

        } catch (error) {
            result.errors.push(`Error parseando TXT: ${error.message}`);
            return result;
        }
    },

    /**
     * Parsea contenido TXT delimitado
     * @param {string} txtContent - Contenido
     * @param {object} config - Configuración
     * @returns {object} Resultado del parsing
     */
    parseDelimitedTxt(txtContent, config) {
        const delimiter = config.delimiter || '\t';
        const hasHeader = config.hasHeader !== false;

        // Reutilizar el parser CSV con el delimitador apropiado
        const { csv } = require('./csv.js');
        return csv.parseCsv(txtContent, { delimiter, hasHeader });
    },

    /**
     * Parsea contenido TXT de ancho fijo
     * @param {string} txtContent - Contenido
     * @param {object} config - Configuración
     * @returns {object} Resultado del parsing
     */
    parseFixedWidthTxt(txtContent, config) {
        const result = {
            success: false,
            data: [],
            headers: [],
            errors: [],
            warnings: []
        };

        if (!config.columnWidths || !Array.isArray(config.columnWidths)) {
            result.errors.push('Se requiere definir columnWidths para parsear archivos de ancho fijo');
            return result;
        }

        try {
            const lines = txtContent.split(/\r?\n/).filter(line => line.trim());
            const hasHeader = config.hasHeader !== false;
            let dataLines = lines;

            // Extraer headers si están presentes
            if (hasHeader && lines.length > 0) {
                const headerLine = lines[0];
                result.headers = this.parseFixedWidthLine(headerLine, config.columnWidths);
                dataLines = lines.slice(1);

                // Saltar línea separadora si existe
                if (dataLines.length > 0 && dataLines[0].match(/^[-=\s]+$/)) {
                    dataLines = dataLines.slice(1);
                }
            }

            // Parsear líneas de datos
            dataLines.forEach((line, index) => {
                try {
                    const row = this.parseFixedWidthLine(line, config.columnWidths);

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
            result.errors.push(`Error parseando archivo de ancho fijo: ${error.message}`);
        }

        return result;
    },

    /**
     * Parsea una línea de ancho fijo
     * @param {string} line - Línea a parsear
     * @param {array} widths - Anchos de columna
     * @returns {array} Campos parseados
     */
    parseFixedWidthLine(line, widths) {
        const fields = [];
        let position = 0;

        widths.forEach(width => {
            const field = line.substring(position, position + width).trim();
            fields.push(field);
            position += width;
        });

        return fields;
    }
};