// src/export/exporters/excel.js
// Exportador Excel - usando ExcelJS y XLSX según configuración

import { DataProcessor, DataTransformer } from '../utils/data-processor.js';
import { validateExportData } from '../utils/validation.js';
import { downloadFile } from '../utils/download.js';
import { getExportConfig, loadDependency } from '../config/index.js';

/**
 * Exportador Excel
 */
export const excel = {
    /**
     * Exporta datos a formato Excel
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración de exportación
     * @returns {Promise<object>} Resultado de exportación
     */
    async export(data, config = {}) {
        const result = {
            success: false,
            format: 'excel',
            filename: null,
            content: null,
            size: 0,
            downloadId: null,
            errors: [],
            warnings: []
        };

        try {
            // Obtener configuración completa
            const fullConfig = getExportConfig('excel', config);

            // Validar datos y configuración
            const validation = validateExportData(data, fullConfig, 'excel');

            if (validation.hasErrors()) {
                result.errors = validation.getErrorMessages();
                return result;
            }

            if (validation.hasWarnings()) {
                result.warnings = validation.getWarningMessages();
            }

            // Determinar qué librería usar
            const useExcelJS = fullConfig.useExcelJS !== false;

            let excelBuffer;
            if (useExcelJS && await this.isExcelJSAvailable()) {
                excelBuffer = await this.exportWithExcelJS(validation.data, fullConfig);
            } else {
                excelBuffer = await this.exportWithXLSX(validation.data, fullConfig);
                if (useExcelJS) {
                    result.warnings.push('ExcelJS no disponible, usando XLSX como alternativa');
                }
            }

            // Preparar información del archivo
            const filename = `${fullConfig.filename || 'export'}.xlsx`;
            result.filename = filename;
            result.content = excelBuffer;
            result.size = excelBuffer.byteLength || excelBuffer.length;

            // Auto-descarga si está habilitada
            if (fullConfig.autoDownload) {
                const downloadSuccess = await downloadFile(
                    excelBuffer,
                    filename,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    {
                        includeTimestamp: fullConfig.timestamp
                    }
                );

                if (!downloadSuccess) {
                    result.warnings.push('La descarga automática falló, pero el archivo se generó correctamente');
                }
            }

            result.success = true;
            return result;

        } catch (error) {
            result.errors.push(`Error en exportación Excel: ${error.message}`);
            console.error('Error en exportador Excel:', error);
            return result;
        }
    },

    /**
     * Exporta usando ExcelJS (más funcionalidades)
     * @param {object} data - Datos validados
     * @param {object} config - Configuración completa
     * @returns {Promise<ArrayBuffer>} Buffer del archivo Excel
     */
    async exportWithExcelJS(data, config) {
        // Cargar ExcelJS
        const ExcelJS = await loadDependency('exceljs');

        // Crear workbook
        const workbook = new ExcelJS.Workbook();

        // Configurar metadatos del workbook
        this.setupWorkbookMetadata(workbook, data, config);

        // Preparar datos para hojas múltiples
        const sheets = DataTransformer.toExcelSheets(data, config);

        // Crear hojas
        for (const sheetData of sheets) {
            const worksheet = workbook.addWorksheet(sheetData.name);
            await this.setupWorksheetWithExcelJS(worksheet, sheetData, config);
        }

        // Generar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    },

    /**
     * Exporta usando XLSX (más liviano)
     * @param {object} data - Datos validados
     * @param {object} config - Configuración completa
     * @returns {Promise<ArrayBuffer>} Buffer del archivo Excel
     */
    async exportWithXLSX(data, config) {
        // Cargar XLSX
        const XLSX = await loadDependency('xlsx');

        // Crear workbook
        const workbook = XLSX.utils.book_new();

        // Preparar datos para hojas múltiples
        const sheets = DataTransformer.toExcelSheets(data, config);

        // Crear hojas
        sheets.forEach(sheetData => {
            const worksheet = this.createWorksheetWithXLSX(XLSX, sheetData, config);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetData.name);
        });

        // Configurar propiedades del workbook
        this.setupWorkbookPropertiesXLSX(workbook, data, config);

        // Generar buffer
        const buffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array',
            compression: true
        });

        return buffer;
    },

    /**
     * Configura metadatos del workbook con ExcelJS
     * @param {object} workbook - Workbook de ExcelJS
     * @param {object} data - Datos
     * @param {object} config - Configuración
     */
    setupWorkbookMetadata(workbook, data, config) {
        const metadata = data.metadata || {};

        workbook.creator = metadata.author || 'Sistema de Exportación';
        workbook.lastModifiedBy = metadata.author || 'Sistema de Exportación';
        workbook.created = metadata.createdAt ? new Date(metadata.createdAt) : new Date();
        workbook.modified = new Date();
        workbook.lastPrinted = new Date();

        // Propiedades personalizadas
        workbook.title = metadata.title || 'Exportación de Datos';
        workbook.subject = metadata.description || '';
        workbook.keywords = 'exportación, datos, excel';
        workbook.category = 'Reportes';
        workbook.manager = config.branding?.orgName || '';
        workbook.company = config.branding?.orgName || '';
    },

    /**
     * Configura una worksheet con ExcelJS
     * @param {object} worksheet - Worksheet de ExcelJS
     * @param {object} sheetData - Datos de la hoja
     * @param {object} config - Configuración
     */
    async setupWorksheetWithExcelJS(worksheet, sheetData, config) {
        const { data: rows, columns, metadata } = sheetData;

        if (!rows || rows.length === 0) {
            return;
        }

        const visibleColumns = columns.filter(col => col.visible !== false);

        // Configurar columnas
        worksheet.columns = visibleColumns.map(col => ({
            header: col.header,
            key: col.key,
            width: this.calculateColumnWidth(col, rows),
            style: this.getColumnStyle(col, config)
        }));

        // Agregar datos
        rows.forEach(row => {
            const excelRow = worksheet.addRow(row);
            this.styleDataRow(excelRow, visibleColumns, config);
        });

        // Aplicar estilos de encabezado
        if (worksheet.getRow(1)) {
            this.styleHeaderRow(worksheet.getRow(1), config);
        }

        // Congelar encabezados si está configurado
        if (config.freezeHeader !== false) {
            worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        }

        // Aplicar filtros automáticos
        if (config.autoFilter !== false) {
            worksheet.autoFilter = {
                from: 'A1',
                to: this.getLastColumnLetter(visibleColumns.length) + '1'
            };
        }

        // Configurar zoom
        if (config.zoom) {
            worksheet.views = [{
                ...worksheet.views?.[0],
                zoomScale: config.zoom
            }];
        }
    },

    /**
     * Crea worksheet con XLSX
     * @param {object} XLSX - Librería XLSX
     * @param {object} sheetData - Datos de la hoja
     * @param {object} config - Configuración
     * @returns {object} Worksheet
     */
    createWorksheetWithXLSX(XLSX, sheetData, config) {
        const { data: rows, columns } = sheetData;

        if (!rows || rows.length === 0) {
            return XLSX.utils.aoa_to_sheet([]);
        }

        const visibleColumns = columns.filter(col => col.visible !== false);

        // Preparar datos para XLSX
        const headers = visibleColumns.map(col => col.header);
        const dataRows = rows.map(row =>
            visibleColumns.map(col => this.formatCellValue(row[col.key], col))
        );

        // Crear worksheet desde array of arrays
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

        // Configurar anchos de columna
        const columnWidths = visibleColumns.map(col => ({
            wch: this.calculateColumnWidthXLSX(col, rows)
        }));
        worksheet['!cols'] = columnWidths;

        // Configurar filtros automáticos
        if (config.autoFilter !== false && rows.length > 0) {
            const range = XLSX.utils.encode_range({
                s: { c: 0, r: 0 },
                e: { c: visibleColumns.length - 1, r: rows.length }
            });
            worksheet['!autofilter'] = { ref: range };
        }

        return worksheet;
    },

    /**
     * Configura propiedades del workbook con XLSX
     * @param {object} workbook - Workbook XLSX
     * @param {object} data - Datos
     * @param {object} config - Configuración
     */
    setupWorkbookPropertiesXLSX(workbook, data, config) {
        const metadata = data.metadata || {};

        workbook.Props = {
            Title: metadata.title || 'Exportación de Datos',
            Subject: metadata.description || '',
            Author: metadata.author || 'Sistema de Exportación',
            Manager: config.branding?.orgName || '',
            Company: config.branding?.orgName || '',
            Category: 'Reportes',
            Keywords: 'exportación, datos, excel',
            Comments: 'Generado por Sistema de Exportación',
            LastAuthor: metadata.author || 'Sistema de Exportación',
            CreatedDate: metadata.createdAt ? new Date(metadata.createdAt) : new Date()
        };
    },

    /**
     * Calcula el ancho de columna para ExcelJS
     * @param {object} column - Información de columna
     * @param {array} rows - Filas de datos
     * @returns {number} Ancho calculado
     */
    calculateColumnWidth(column, rows) {
        if (column.width) {
            return column.width;
        }

        // Calcular basado en contenido
        let maxLength = column.header ? column.header.length : 10;

        // Examinar una muestra de los datos
        const sampleSize = Math.min(100, rows.length);
        for (let i = 0; i < sampleSize; i++) {
            const value = rows[i][column.key];
            const length = String(value || '').length;
            maxLength = Math.max(maxLength, length);
        }

        // Aplicar límites
        return Math.max(8, Math.min(50, maxLength + 2));
    },

    /**
     * Calcula el ancho de columna para XLSX
     * @param {object} column - Información de columna
     * @param {array} rows - Filas de datos
     * @returns {number} Ancho calculado
     */
    calculateColumnWidthXLSX(column, rows) {
        // Similar a ExcelJS pero con diferentes unidades
        const baseWidth = this.calculateColumnWidth(column, rows);
        return Math.max(10, Math.min(60, baseWidth * 1.2));
    },

    /**
     * Obtiene el estilo de columna
     * @param {object} column - Información de columna
     * @param {object} config - Configuración
     * @returns {object} Estilo
     */
    getColumnStyle(column, config) {
        const baseStyle = {
            alignment: {
                horizontal: this.getColumnAlignment(column),
                vertical: 'middle',
                wrapText: column.type === 'string'
            }
        };

        // Estilos específicos por tipo
        switch (column.type) {
            case 'number':
                baseStyle.numFmt = '#,##0.00';
                break;
            case 'date':
                baseStyle.numFmt = 'yyyy-mm-dd';
                break;
            case 'boolean':
                baseStyle.alignment.horizontal = 'center';
                break;
        }

        return baseStyle;
    },

    /**
     * Obtiene la alineación de columna
     * @param {object} column - Información de columna
     * @returns {string} Tipo de alineación
     */
    getColumnAlignment(column) {
        if (column.alignment) {
            return column.alignment;
        }

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
     * Aplica estilos a la fila de encabezado
     * @param {object} headerRow - Fila de encabezado ExcelJS
     * @param {object} config - Configuración
     */
    styleHeaderRow(headerRow, config) {
        const headerStyle = config.headerStyle || {};

        headerRow.eachCell((cell) => {
            cell.font = {
                bold: headerStyle.bold !== false,
                size: headerStyle.fontSize || 11,
                color: { argb: headerStyle.textColor || '000000' }
            };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: headerStyle.backgroundColor || 'F2F2F2' }
            };

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            cell.alignment = {
                horizontal: 'center',
                vertical: 'middle'
            };
        });

        headerRow.height = headerStyle.height || 20;
    },

    /**
     * Aplica estilos a una fila de datos
     * @param {object} dataRow - Fila de datos ExcelJS
     * @param {array} columns - Información de columnas
     * @param {object} config - Configuración
     */
    styleDataRow(dataRow, columns, config) {
        const cellStyle = config.cellStyle || {};

        dataRow.eachCell((cell, colNumber) => {
            const column = columns[colNumber - 1];

            cell.font = {
                size: cellStyle.fontSize || 10,
                color: { argb: cellStyle.textColor || '000000' }
            };

            if (cellStyle.backgroundColor) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: cellStyle.backgroundColor }
                };
            }

            // Aplicar formato específico por tipo de columna
            if (column) {
                Object.assign(cell, this.getColumnStyle(column, config));
            }

            // Bordes sutiles
            if (config.showBorders !== false) {
                cell.border = {
                    top: { style: 'hair', color: { argb: 'E0E0E0' } },
                    left: { style: 'hair', color: { argb: 'E0E0E0' } },
                    bottom: { style: 'hair', color: { argb: 'E0E0E0' } },
                    right: { style: 'hair', color: { argb: 'E0E0E0' } }
                };
            }
        });
    },

    /**
     * Formatea el valor de una celda
     * @param {any} value - Valor original
     * @param {object} column - Información de columna
     * @returns {any} Valor formateado
     */
    formatCellValue(value, column) {
        if (value === null || value === undefined) {
            return '';
        }

        switch (column.type) {
            case 'date':
                if (value instanceof Date) {
                    return value;
                }
                const date = new Date(value);
                return isNaN(date.getTime()) ? value : date;

            case 'number':
                const num = Number(value);
                return isNaN(num) ? value : num;

            case 'boolean':
                if (typeof value === 'boolean') {
                    return value;
                }
                return String(value).toLowerCase() === 'true';

            default:
                return String(value);
        }
    },

    /**
     * Obtiene la letra de la última columna
     * @param {number} columnCount - Número de columnas
     * @returns {string} Letra de columna
     */
    getLastColumnLetter(columnCount) {
        let result = '';
        let num = columnCount;

        while (num > 0) {
            num--;
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26);
        }

        return result;
    },

    /**
     * Obtiene información sobre el formato Excel
     * @returns {object} Información del formato
     */
    getFormatInfo() {
        return {
            name: 'Excel',
            extension: 'xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            description: 'Archivo Excel con soporte completo de formato y múltiples hojas',
            features: {
                supportsMetadata: true,
                supportsMultiSheet: true,
                supportsFormatting: true,
                preservesDataTypes: true
            },
            options: {
                useExcelJS: {
                    type: 'boolean',
                    default: true,
                    description: 'Usar ExcelJS (más funcionalidades) vs XLSX (más liviano)'
                },
                autoFitColumns: {
                    type: 'boolean',
                    default: true,
                    description: 'Ajustar ancho de columnas automáticamente'
                },
                freezeHeader: {
                    type: 'boolean',
                    default: true,
                    description: 'Congelar fila de encabezados'
                },
                autoFilter: {
                    type: 'boolean',
                    default: true,
                    description: 'Activar filtros automáticos'
                },
                showBorders: {
                    type: 'boolean',
                    default: true,
                    description: 'Mostrar bordes de celdas'
                },
                zoom: {
                    type: 'number',
                    default: 100,
                    description: 'Nivel de zoom inicial (50-200)'
                }
            }
        };
    },

    /**
     * Estima el tamaño del archivo Excel
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @returns {Promise<number>} Tamaño estimado en bytes
     */
    async estimateSize(data, config = {}) {
        try {
            const processor = new DataProcessor(data, config).process();
            const stats = processor.getStatistics();

            // Estimación basada en contenido
            const baseSize = stats.totalRows * stats.totalColumns * 8; // Aproximado por celda
            const overhead = 5000; // Overhead del formato Excel
            const metadata = 2000; // Espacio para metadatos

            return baseSize + overhead + metadata;

        } catch (error) {
            console.warn('Error estimando tamaño Excel:', error);
            return 0;
        }
    },

    /**
     * Genera preview del contenido Excel (como tabla)
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @param {number} maxRows - Número máximo de filas para preview
     * @returns {string} Preview del contenido
     */
    generatePreview(data, config = {}, maxRows = 10) {
        try {
            const sheets = DataTransformer.toExcelSheets(data, config);

            let preview = '';

            sheets.forEach((sheet, index) => {
                if (index > 0) preview += '\n\n';

                preview += `HOJA: ${sheet.name}\n`;
                preview += '='.repeat(20) + '\n';

                const visibleColumns = sheet.columns.filter(col => col.visible !== false);
                const headers = visibleColumns.map(col => col.header).join('\t');
                preview += headers + '\n';
                preview += '-'.repeat(headers.length) + '\n';

                const previewRows = sheet.data.slice(0, maxRows);
                previewRows.forEach(row => {
                    const cells = visibleColumns.map(col => String(row[col.key] || '')).join('\t');
                    preview += cells + '\n';
                });

                if (sheet.data.length > maxRows) {
                    preview += `... (${sheet.data.length - maxRows} filas más)\n`;
                }

                preview += `\nTotal: ${sheet.data.length} filas, ${visibleColumns.length} columnas`;
            });

            return preview;

        } catch (error) {
            return `Error generando preview: ${error.message}`;
        }
    },

    /**
     * Valida configuración específica de Excel
     * @param {object} config - Configuración a validar
     * @returns {object} Resultado de validación
     */
    validateExcelConfig(config) {
        const result = { valid: true, errors: [], warnings: [] };

        // Validar zoom
        if (config.zoom && (config.zoom < 50 || config.zoom > 200)) {
            result.warnings.push('El zoom debe estar entre 50 y 200');
        }

        // Validar colores
        if (config.headerStyle?.backgroundColor) {
            if (!/^[0-9A-F]{6}$/i.test(config.headerStyle.backgroundColor.replace('#', ''))) {
                result.warnings.push('Color de fondo del encabezado debe ser hexadecimal válido');
            }
        }

        // Validar si se puede usar ExcelJS
        if (config.useExcelJS && !this.isExcelJSAvailable()) {
            result.warnings.push('ExcelJS no disponible, se usará XLSX');
        }

        return result;
    },

    /**
     * Verifica si ExcelJS está disponible
     * @returns {Promise<boolean>} Disponibilidad
     */
    async isExcelJSAvailable() {
        try {
            await loadDependency('exceljs');
            return true;
        } catch {
            return false;
        }
    }
};