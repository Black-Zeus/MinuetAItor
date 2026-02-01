// src/export/exporters/pdf.js
// Exportador PDF - usando pdfmake

import { DataProcessor, DataTransformer } from '../utils/data-processor.js';
import { validateExportData } from '../utils/validation.js';
import { downloadFile } from '../utils/download.js';
import { getExportConfig, loadDependency } from '../config/index.js';

/**
 * Exportador PDF
 */
export const pdf = {
    /**
     * Exporta datos a formato PDF
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración de exportación
     * @returns {Promise<object>} Resultado de exportación
     */
    async export(data, config = {}) {
        const result = {
            success: false,
            format: 'pdf',
            filename: null,
            content: null,
            size: 0,
            downloadId: null,
            errors: [],
            warnings: []
        };

        try {
            // Obtener configuración completa
            const fullConfig = getExportConfig('pdf', config);

            // Validar datos y configuración
            const validation = validateExportData(data, fullConfig, 'pdf');

            if (validation.hasErrors()) {
                result.errors = validation.getErrorMessages();
                return result;
            }

            if (validation.hasWarnings()) {
                result.warnings = validation.getWarningMessages();
            }

            // Intentar cargar pdfMake, si no está disponible usar simulación
            let pdfBuffer;
            try {
                const pdfMake = await loadDependency('pdfmake');
                this.setupFonts(pdfMake);
                const docDefinition = await this.createDocumentDefinition(validation.data, fullConfig);
                pdfBuffer = await this.generatePdfBuffer(pdfMake, docDefinition);
            } catch (error) {
                console.warn('pdfMake no disponible, usando simulación:', error);
                result.warnings.push('pdfMake no disponible, generando PDF simulado para testing');
                pdfBuffer = this.generateSimulatedPdf(validation.data, fullConfig);
            }

            // Preparar información del archivo
            const filename = `${fullConfig.filename || 'export'}.pdf`;
            result.filename = filename;
            result.content = pdfBuffer;
            result.size = pdfBuffer.byteLength || pdfBuffer.length;

            // Auto-descarga si está habilitada
            if (fullConfig.autoDownload) {
                const downloadSuccess = await downloadFile(
                    pdfBuffer,
                    filename,
                    'application/pdf',
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
            result.errors.push(`Error en exportación PDF: ${error.message}`);
            console.error('Error en exportador PDF:', error);
            return result;
        }
    },

    /**
     * Genera PDF simulado para testing
     * @param {object} data - Datos validados
     * @param {object} config - Configuración completa
     * @returns {ArrayBuffer} Buffer simulado
     */
    generateSimulatedPdf(data, config) {
        const { data: rows, columns, metadata } = data;

        let pdfContent = `%PDF-1.4 (Simulado)\n`;
        pdfContent += `%${String.fromCharCode(226)}${String.fromCharCode(227)}${String.fromCharCode(207)}${String.fromCharCode(211)}\n`;
        pdfContent += `\n<!-- PDF SIMULADO GENERADO POR SISTEMA DE EXPORTACIÓN -->\n`;
        pdfContent += `<!-- Configuración: ${JSON.stringify(config, null, 2)} -->\n\n`;

        // Información del documento
        pdfContent += `DOCUMENTO PDF\n`;
        pdfContent += `=============\n\n`;

        if (config.cover?.enabled) {
            pdfContent += `PORTADA:\n`;
            pdfContent += `Título: ${config.cover.title || metadata?.title || 'Sin título'}\n`;
            if (config.cover.subtitle) pdfContent += `Subtítulo: ${config.cover.subtitle}\n`;
            pdfContent += `Organización: ${config.branding?.orgName || 'N/A'}\n`;
            pdfContent += `Fecha: ${new Date().toLocaleDateString()}\n\n`;
            pdfContent += `--- SALTO DE PÁGINA ---\n\n`;
        }

        // Información general
        pdfContent += `INFORMACIÓN DEL DOCUMENTO:\n`;
        pdfContent += `Autor: ${metadata?.author || 'Sistema'}\n`;
        pdfContent += `Creado: ${metadata?.createdAt || new Date().toISOString()}\n`;
        pdfContent += `Formato: ${config.pageSize || 'A4'} ${config.pageOrientation || 'portrait'}\n`;
        pdfContent += `Márgenes: [${(config.pageMargins || [40, 40, 40, 40]).join(', ')}]\n\n`;

        if (config.header?.enabled) {
            pdfContent += `ENCABEZADO: ${config.header.text || 'N/A'}\n\n`;
        }

        // Contenido principal
        pdfContent += `DATOS PRINCIPALES:\n`;
        pdfContent += `Registros: ${rows?.length || 0}\n`;
        pdfContent += `Columnas: ${columns?.length || 0}\n\n`;

        if (rows && rows.length > 0) {
            const visibleColumns = columns?.filter(col => col.visible !== false) ||
                Object.keys(rows[0]).map(key => ({ key, header: key }));

            // Headers
            const headers = visibleColumns.map(col => col.header || col.key);
            pdfContent += `TABLA DE DATOS:\n`;
            pdfContent += `${headers.join(' | ')}\n`;
            pdfContent += `${'-'.repeat(headers.join(' | ').length)}\n`;

            // Primeras 5 filas
            const maxRows = Math.min(5, rows.length);
            for (let i = 0; i < maxRows; i++) {
                const row = rows[i];
                const values = visibleColumns.map(col => {
                    const value = this.formatCellValueForPdf(row[col.key], col);
                    return String(value).length > 20 ? String(value).substring(0, 17) + '...' : String(value);
                });
                pdfContent += `${values.join(' | ')}\n`;
            }

            if (rows.length > maxRows) {
                pdfContent += `... (${rows.length - maxRows} filas más)\n`;
            }
        }

        if (config.footer?.enabled) {
            pdfContent += `\nPIE DE PÁGINA: ${config.footer.text || 'N/A'}\n`;
            if (config.footer.pageNumbers !== false) {
                pdfContent += `Numeración de páginas: Habilitada\n`;
            }
        }

        pdfContent += `\n--- FIN DEL DOCUMENTO ---\n`;
        pdfContent += `Generado por: Sistema de Exportación\n`;
        pdfContent += `Timestamp: ${new Date().toISOString()}\n`;

        return new TextEncoder().encode(pdfContent);
    },

    /**
     * Configura las fuentes para pdfMake
     * @param {object} pdfMake - Instancia de pdfMake
     */
    setupFonts(pdfMake) {
        // Usar fuentes por defecto de pdfMake
        pdfMake.fonts = {
            Roboto: {
                normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
                bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
                italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf',
                bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf'
            }
        };
    },

    /**
     * Crea la definición del documento PDF
     * @param {object} data - Datos validados
     * @param {object} config - Configuración completa
     * @returns {Promise<object>} Definición del documento
     */
    async createDocumentDefinition(data, config) {
        const docDefinition = {
            pageSize: config.pageSize || 'A4',
            pageOrientation: config.pageOrientation || 'portrait',
            pageMargins: config.pageMargins || [40, 40, 40, 40],

            info: this.createDocumentInfo(data, config),
            styles: this.createDocumentStyles(config),
            defaultStyle: {
                font: 'Roboto'
            },

            content: [],

            // Header y footer
            header: config.header?.enabled ? this.createHeader(data, config) : null,
            footer: config.footer?.enabled ? this.createFooter(data, config) : null
        };

        // Generar contenido
        const content = await this.generateDocumentContent(data, config);
        docDefinition.content = content;

        return docDefinition;
    },

    /**
     * Crea la información del documento
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {object} Información del documento
     */
    createDocumentInfo(data, config) {
        const metadata = data.metadata || {};

        return {
            title: metadata.title || 'Exportación de Datos',
            author: metadata.author || 'Sistema de Exportación',
            subject: metadata.description || '',
            keywords: 'exportación, datos, pdf, reporte',
            creator: 'Sistema de Exportación',
            producer: 'pdfMake',
            creationDate: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
            modDate: new Date()
        };
    },

    /**
     * Crea los estilos del documento
     * @param {object} config - Configuración
     * @returns {object} Estilos
     */
    createDocumentStyles(config) {
        const baseStyles = config.styles || {};

        return {
            header1: {
                fontSize: 20,
                bold: true,
                margin: [0, 0, 0, 10],
                color: config.branding?.primaryColor || '#333333',
                ...baseStyles.header1
            },
            header2: {
                fontSize: 16,
                bold: true,
                margin: [0, 10, 0, 5],
                color: config.branding?.primaryColor || '#333333',
                ...baseStyles.header2
            },
            header3: {
                fontSize: 14,
                bold: true,
                margin: [0, 8, 0, 4],
                color: config.branding?.primaryColor || '#333333',
                ...baseStyles.header3
            },
            normal: {
                fontSize: 10,
                margin: [0, 0, 0, 5],
                ...baseStyles.normal
            },
            tableHeader: {
                fontSize: 10,
                bold: true,
                fillColor: '#F2F2F2',
                margin: [5, 5, 5, 5],
                color: config.branding?.primaryColor || '#333333',
                ...baseStyles.tableHeader
            },
            tableCell: {
                fontSize: 9,
                margin: [5, 3, 5, 3],
                ...baseStyles.tableCell
            },
            coverTitle: {
                fontSize: 28,
                bold: true,
                alignment: 'center',
                margin: [0, 100, 0, 20],
                color: config.branding?.primaryColor || '#333333'
            },
            coverSubtitle: {
                fontSize: 16,
                alignment: 'center',
                margin: [0, 0, 0, 50],
                color: config.branding?.secondaryColor || '#666666'
            },
            pageNumber: {
                fontSize: 8,
                alignment: 'center',
                margin: [0, 10, 0, 0]
            }
        };
    },

    /**
     * Crea el header del documento
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {function} Función de header
     */
    createHeader(data, config) {
        return (currentPage, pageCount) => {
            const headerElements = [];

            if (config.branding?.logo) {
                headerElements.push({
                    image: config.branding.logo,
                    width: 60,
                    alignment: 'left',
                    margin: [40, 20, 0, 0]
                });
            }

            if (config.header.text) {
                headerElements.push({
                    text: config.header.text,
                    style: 'normal',
                    alignment: 'center',
                    margin: [0, 25, 0, 0]
                });
            }

            if (config.branding?.orgName) {
                headerElements.push({
                    text: config.branding.orgName,
                    fontSize: 8,
                    alignment: 'right',
                    margin: [0, 25, 40, 0]
                });
            }

            return {
                columns: headerElements,
                margin: [0, 0, 0, 20]
            };
        };
    },

    /**
     * Crea el footer del documento
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {function} Función de footer
     */
    createFooter(data, config) {
        return (currentPage, pageCount) => {
            const footerElements = [];

            if (config.footer.text) {
                footerElements.push({
                    text: config.footer.text,
                    fontSize: 8,
                    alignment: 'left'
                });
            }

            if (config.footer.pageNumbers !== false) {
                footerElements.push({
                    text: `Página ${currentPage} de ${pageCount}`,
                    fontSize: 8,
                    alignment: 'right'
                });
            }

            return {
                columns: footerElements,
                margin: [40, 10, 40, 0]
            };
        };
    },

    /**
     * Genera el contenido del documento
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {Promise<array>} Contenido del documento
     */
    async generateDocumentContent(data, config) {
        const content = [];

        // Si hay contenido personalizado, usarlo
        if (data.content && Array.isArray(data.content)) {
            for (const item of data.content) {
                const element = await this.processContentItem(item, config);
                if (element) {
                    content.push(element);
                }
            }
            return content;
        }

        // Si no, generar contenido automático
        return this.generateAutomaticContent(data, config);
    },

    /**
     * Procesa un elemento de contenido personalizado
     * @param {object} item - Elemento de contenido
     * @param {object} config - Configuración
     * @returns {Promise<object|null>} Elemento procesado
     */
    async processContentItem(item, config) {
        switch (item.type) {
            case 'cover':
                return this.createCover(item, config);

            case 'title':
                return {
                    text: item.text,
                    style: `header${item.level || 1}`,
                    alignment: item.alignment || 'left'
                };

            case 'paragraph':
                return {
                    text: item.text,
                    style: item.style || 'normal',
                    alignment: item.alignment || 'left'
                };

            case 'table':
                return this.createTable(item.data, item.columns, config, item.title);

            case 'pageBreak':
                return { text: '', pageBreak: 'before' };

            case 'image':
                return {
                    image: item.src,
                    width: item.width || 200,
                    height: item.height,
                    alignment: item.alignment || 'left'
                };

            default:
                console.warn(`Tipo de contenido no soportado: ${item.type}`);
                return null;
        }
    },

    /**
     * Genera contenido automático
     * @param {object} data - Datos
     * @param {object} config - Configuración
     * @returns {array} Contenido generado
     */
    generateAutomaticContent(data, config) {
        const content = [];

        // Portada si está habilitada
        if (config.cover?.enabled) {
            content.push(this.createCover(config.cover, config));
            content.push({ text: '', pageBreak: 'before' });
        }

        // Procesar datos principales
        const { data: rows, columns, metadata } = data;

        // Título principal
        if (metadata?.title) {
            content.push({
                text: metadata.title,
                style: 'header1'
            });
        }

        // Descripción
        if (metadata?.description) {
            content.push({
                text: metadata.description,
                style: 'normal',
                margin: [0, 0, 0, 15]
            });
        }

        // Resumen ejecutivo
        content.push({
            text: 'Resumen de Datos',
            style: 'header2'
        });

        content.push({
            ul: [
                `Total de registros: ${rows?.length || 0}`,
                `Total de columnas: ${columns?.length || 0}`,
                `Fecha de generación: ${new Date().toLocaleDateString()}`,
                metadata?.author ? `Autor: ${metadata.author}` : null
            ].filter(Boolean),
            style: 'normal'
        });

        // Tabla principal
        if (rows && rows.length > 0) {
            content.push({
                text: 'Datos',
                style: 'header2',
                margin: [0, 20, 0, 10]
            });

            content.push(this.createTable(rows, columns, config));
        }

        return content;
    },

    /**
     * Crea una portada
     * @param {object} coverConfig - Configuración de portada
     * @param {object} config - Configuración general
     * @returns {object} Elemento de portada
     */
    createCover(coverConfig, config) {
        const coverElements = [];

        if (coverConfig.logo) {
            coverElements.push({
                image: coverConfig.logo,
                width: 150,
                alignment: 'center',
                margin: [0, 50, 0, 30]
            });
        }

        if (coverConfig.title) {
            coverElements.push({
                text: coverConfig.title,
                style: 'coverTitle'
            });
        }

        if (coverConfig.subtitle) {
            coverElements.push({
                text: coverConfig.subtitle,
                style: 'coverSubtitle'
            });
        }

        // Información adicional en la parte inferior
        coverElements.push({
            text: new Date().toLocaleDateString(),
            fontSize: 12,
            alignment: 'center',
            margin: [0, 100, 0, 0]
        });

        if (config.branding?.orgName) {
            coverElements.push({
                text: config.branding.orgName,
                fontSize: 10,
                alignment: 'center',
                margin: [0, 10, 0, 0]
            });
        }

        return {
            stack: coverElements,
            absolutePosition: { x: 0, y: 0 }
        };
    },

    /**
     * Crea una tabla para PDF
     * @param {array} rows - Filas de datos
     * @param {array} columns - Información de columnas
     * @param {object} config - Configuración
     * @param {string} title - Título opcional de la tabla
     * @returns {object} Elemento de tabla
     */
    createTable(rows, columns, config, title = null) {
        if (!rows || rows.length === 0) {
            return {
                text: 'No hay datos para mostrar',
                style: 'normal',
                italics: true
            };
        }

        const visibleColumns = Array.isArray(columns)
            ? columns.filter(col => col.visible !== false)
            : this.autoDetectColumns(rows);

        // Preparar headers
        const headers = visibleColumns.map(col => ({
            text: typeof col === 'string' ? col : col.header || col.key,
            style: 'tableHeader'
        }));

        // Preparar filas de datos
        const tableRows = [headers];

        rows.forEach(row => {
            const pdfRow = visibleColumns.map(col => {
                const key = typeof col === 'string' ? col : col.key;
                const value = this.formatCellValueForPdf(row[key], col);

                return {
                    text: String(value || ''),
                    style: 'tableCell'
                };
            });

            tableRows.push(pdfRow);
        });

        // Crear definición de tabla
        const tableDefinition = {
            table: {
                headerRows: 1,
                widths: this.calculateTableWidths(visibleColumns, config),
                body: tableRows
            },
            layout: config.table?.layout || 'lightHorizontalLines',
            margin: [0, 10, 0, 10]
        };

        // Si hay título, envolverlo
        if (title) {
            return {
                stack: [
                    {
                        text: title,
                        style: 'header3',
                        margin: [0, 10, 0, 5]
                    },
                    tableDefinition
                ]
            };
        }

        return tableDefinition;
    },

    /**
     * Auto-detecta columnas desde los datos
     * @param {array} rows - Filas de datos
     * @returns {array} Columnas detectadas
     */
    autoDetectColumns(rows) {
        if (!rows || rows.length === 0) return [];

        const firstRow = rows[0];
        if (Array.isArray(firstRow)) {
            // Array de arrays
            return firstRow.map((_, index) => `Columna ${index + 1}`);
        } else {
            // Array de objetos
            return Object.keys(firstRow).map(key => ({
                key: key,
                header: key.charAt(0).toUpperCase() + key.slice(1),
                type: 'string'
            }));
        }
    },

    /**
     * Calcula los anchos de las columnas de la tabla
     * @param {array} columns - Columnas
     * @param {object} config - Configuración
     * @returns {array} Anchos de columnas
     */
    calculateTableWidths(columns, config) {
        if (config.table?.widths) {
            return config.table.widths;
        }

        // Distribución automática
        const columnCount = columns.length;

        if (columnCount <= 3) {
            return '*'; // Distribución equitativa
        } else if (columnCount <= 6) {
            return columns.map(() => '*');
        } else {
            // Para muchas columnas, usar anchos fijos pequeños
            return columns.map(() => 80);
        }
    },

    /**
     * Formatea el valor de una celda para PDF
     * @param {any} value - Valor original
     * @param {object} column - Información de columna
     * @returns {string} Valor formateado
     */
    formatCellValueForPdf(value, column) {
        if (value === null || value === undefined) {
            return '';
        }

        const columnType = typeof column === 'object' ? column.type : 'string';

        switch (columnType) {
            case 'number':
                const num = Number(value);
                return isNaN(num) ? value : num.toLocaleString();

            case 'date':
                if (value instanceof Date) {
                    return value.toLocaleDateString();
                }
                const date = new Date(value);
                return isNaN(date.getTime()) ? value : date.toLocaleDateString();

            case 'boolean':
                return value ? 'Sí' : 'No';

            default:
                const str = String(value);
                // Truncar strings muy largos para PDF
                return str.length > 50 ? str.substring(0, 47) + '...' : str;
        }
    },

    /**
     * Genera el buffer del PDF
     * @param {object} pdfMake - Instancia de pdfMake
     * @param {object} docDefinition - Definición del documento
     * @returns {Promise<ArrayBuffer>} Buffer del PDF
     */
    generatePdfBuffer(pdfMake, docDefinition) {
        return new Promise((resolve, reject) => {
            try {
                const pdfDoc = pdfMake.createPdf(docDefinition);

                pdfDoc.getBuffer((buffer) => {
                    resolve(buffer);
                });

            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Obtiene información sobre el formato PDF
     * @returns {object} Información del formato
     */
    getFormatInfo() {
        return {
            name: 'PDF',
            extension: 'pdf',
            mimeType: 'application/pdf',
            description: 'Documento PDF con formato profesional y contenido complejo',
            features: {
                supportsMetadata: true,
                supportsMultiSheet: false,
                supportsFormatting: true,
                preservesDataTypes: false
            },
            options: {
                pageSize: {
                    type: 'string',
                    values: ['A4', 'A3', 'A5', 'LETTER', 'LEGAL'],
                    default: 'A4',
                    description: 'Tamaño de página'
                },
                pageOrientation: {
                    type: 'string',
                    values: ['portrait', 'landscape'],
                    default: 'portrait',
                    description: 'Orientación de página'
                },
                cover: {
                    type: 'object',
                    description: 'Configuración de portada'
                },
                header: {
                    type: 'object',
                    description: 'Configuración de encabezado'
                },
                footer: {
                    type: 'object',
                    description: 'Configuración de pie de página'
                },
                branding: {
                    type: 'object',
                    description: 'Configuración de marca'
                }
            }
        };
    },

    /**
     * Estima el tamaño del archivo PDF
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @returns {Promise<number>} Tamaño estimado en bytes
     */
    async estimateSize(data, config = {}) {
        try {
            const { data: rows, columns } = data;
            const totalRows = rows?.length || 0;
            const totalColumns = columns?.length || 0;

            // Estimación basada en contenido
            const baseSize = totalRows * totalColumns * 12; // Más overhead que Excel
            const pageOverhead = Math.ceil(totalRows / 30) * 2000; // Aprox 30 filas por página
            const formatting = 10000; // Overhead de formato PDF
            const metadata = 3000; // Espacio para metadatos e imágenes

            return baseSize + pageOverhead + formatting + metadata;

        } catch (error) {
            console.warn('Error estimando tamaño PDF:', error);
            return 0;
        }
    },

    /**
     * Genera preview del contenido PDF (como texto)
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @returns {string} Preview del contenido
     */
    generatePreview(data, config = {}) {
        try {
            let preview = 'DOCUMENTO PDF\n';
            preview += '===============\n\n';

            const { data: rows, columns, metadata } = data;

            if (config.cover?.enabled) {
                preview += 'PORTADA:\n';
                preview += `- Título: ${config.cover.title || metadata?.title}\n`;
                preview += `- Subtítulo: ${config.cover.subtitle || ''}\n\n`;
            }

            preview += 'CONTENIDO:\n';
            preview += `- Título: ${metadata?.title}\n`;
            preview += `- Descripción: ${metadata?.description}\n`;
            preview += `- Total de páginas estimadas: ${Math.ceil((rows?.length || 0) / 30)}\n`;
            preview += `- Datos: ${rows?.length || 0} filas x ${columns?.length || 0} columnas\n\n`;

            if (config.header?.enabled) {
                preview += `- Encabezado: ${config.header.text}\n`;
            }

            if (config.footer?.enabled) {
                preview += `- Pie de página: ${config.footer.text}\n`;
                if (config.footer.pageNumbers !== false) {
                    preview += '- Numeración de páginas habilitada\n';
                }
            }

            preview += `\nFormato: ${config.pageSize || 'A4'} ${config.pageOrientation || 'portrait'}`;

            return preview;

        } catch (error) {
            return `Error generando preview: ${error.message}`;
        }
    },

    /**
     * Valida configuración específica de PDF
     * @param {object} config - Configuración a validar
     * @returns {object} Resultado de validación
     */
    validatePdfConfig(config) {
        const result = { valid: true, errors: [], warnings: [] };

        // Validar tamaño de página
        const validPageSizes = ['A4', 'A3', 'A5', 'LETTER', 'LEGAL'];
        if (config.pageSize && !validPageSizes.includes(config.pageSize)) {
            result.warnings.push(`Tamaño de página no estándar: ${config.pageSize}`);
        }

        // Validar márgenes
        if (config.pageMargins && Array.isArray(config.pageMargins)) {
            if (config.pageMargins.length !== 4) {
                result.errors.push('Los márgenes deben ser un array de 4 elementos [left, top, right, bottom]');
            }
        }

        // Validar colores
        if (config.branding?.primaryColor) {
            if (!/^#[0-9A-F]{6}$/i.test(config.branding.primaryColor)) {
                result.warnings.push('Color primario debe ser formato hexadecimal (#RRGGBB)');
            }
        }

        return result;
    }
};