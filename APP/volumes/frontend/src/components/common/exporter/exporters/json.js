// src/export/exporters/json.js
// Exportador JSON - sin dependencias externas

import { DataProcessor, DataTransformer } from '../utils/data-processor.js';
import { validateExportData } from '../utils/validation.js';
import { downloadFile } from '../utils/download.js';
import { getExportConfig } from '../config/index.js';

/**
 * Exportador JSON
 */
export const json = {
    /**
     * Exporta datos a formato JSON
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración de exportación
     * @returns {Promise<object>} Resultado de exportación
     */
    async export(data, config = {}) {
        const result = {
            success: false,
            format: 'json',
            filename: null,
            content: null,
            size: 0,
            downloadId: null,
            errors: [],
            warnings: []
        };

        try {
            // Obtener configuración completa
            const fullConfig = getExportConfig('json', config);

            // Validar datos y configuración
            const validation = validateExportData(data, fullConfig, 'json');

            if (validation.hasErrors()) {
                result.errors = validation.getErrorMessages();
                return result;
            }

            if (validation.hasWarnings()) {
                result.warnings = validation.getWarningMessages();
            }

            // Procesar datos
            const processor = new DataProcessor(validation.data.data, fullConfig).process();

            // Transformar según el formato especificado
            const transformedData = DataTransformer.toStructured(processor, fullConfig.format);

            // Generar contenido JSON
            const jsonContent = this.generateJsonContent(transformedData, fullConfig);

            // Preparar información del archivo
            const filename = fullConfig.filename || 'export';
            result.filename = filename;
            result.content = jsonContent;
            result.size = new Blob([jsonContent]).size;

            // Auto-descarga si está habilitada
            if (fullConfig.autoDownload) {
                const downloadSuccess = await downloadFile(
                    jsonContent,
                    filename,
                    'json',
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
            result.errors.push(`Error en exportación JSON: ${error.message}`);
            console.error('Error en exportador JSON:', error);
            return result;
        }
    },

    /**
     * Genera el contenido JSON según la configuración
     * @param {any} data - Datos transformados
     * @param {object} config - Configuración
     * @returns {string} Contenido JSON
     */
    generateJsonContent(data, config) {
        const indent = config.indent !== undefined ? config.indent : 2;

        // Aplicar configuraciones específicas de JSON
        let finalData = data;

        // Si no incluir metadata, removerla del objeto
        if (!config.includeMetadata && typeof data === 'object' && data.metadata) {
            const { metadata, ...dataWithoutMetadata } = data;
            finalData = dataWithoutMetadata;
        }

        // Preservar tipos o convertir todo a string
        if (!config.preserveTypes) {
            finalData = this.convertToStrings(finalData);
        }

        return JSON.stringify(finalData, this.createReplacer(config), indent);
    },

    /**
     * Convierte todos los valores a strings si preserveTypes está deshabilitado
     * @param {any} obj - Objeto a convertir
     * @returns {any} Objeto convertido
     */
    convertToStrings(obj) {
        if (obj === null || obj === undefined) {
            return '';
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.convertToStrings(item));
        }

        if (typeof obj === 'object' && obj.constructor === Object) {
            const converted = {};
            Object.keys(obj).forEach(key => {
                converted[key] = this.convertToStrings(obj[key]);
            });
            return converted;
        }

        if (obj instanceof Date) {
            return obj.toISOString();
        }

        return String(obj);
    },

    /**
     * Crea función replacer para JSON.stringify
     * @param {object} config - Configuración
     * @returns {function} Función replacer
     */
    createReplacer(config) {
        return function (key, value) {
            // Manejar fechas
            if (value instanceof Date) {
                return config.preserveTypes ? value.toISOString() : value.toISOString();
            }

            // Manejar funciones (no serializables)
            if (typeof value === 'function') {
                return '[Function]';
            }

            // Manejar undefined
            if (value === undefined) {
                return null;
            }

            // Manejar números especiales
            if (typeof value === 'number') {
                if (isNaN(value)) return 'NaN';
                if (value === Infinity) return 'Infinity';
                if (value === -Infinity) return '-Infinity';
            }

            return value;
        };
    },

    /**
     * Valida si los datos son válidos para JSON
     * @param {any} data - Datos a validar
     * @returns {object} Resultado de validación
     */
    validateJsonData(data) {
        const result = { valid: true, errors: [] };

        try {
            // Intentar serializar para detectar problemas
            JSON.stringify(data);
        } catch (error) {
            result.valid = false;

            if (error.message.includes('circular')) {
                result.errors.push('Estructura circular detectada en los datos');
            } else if (error.message.includes('BigInt')) {
                result.errors.push('Valores BigInt no soportados en JSON');
            } else {
                result.errors.push(`Error de serialización JSON: ${error.message}`);
            }
        }

        return result;
    },

    /**
     * Obtiene información sobre el formato JSON
     * @returns {object} Información del formato
     */
    getFormatInfo() {
        return {
            name: 'JSON',
            extension: 'json',
            mimeType: 'application/json',
            description: 'JavaScript Object Notation - formato de intercambio de datos',
            features: {
                supportsMetadata: true,
                supportsMultiSheet: false,
                supportsFormatting: false,
                preservesDataTypes: true
            },
            options: {
                format: {
                    type: 'string',
                    values: ['array', 'structured', 'envelope'],
                    default: 'structured',
                    description: 'Formato de estructura JSON'
                },
                indent: {
                    type: 'number',
                    default: 2,
                    description: 'Espacios para indentación (0 para compacto)'
                },
                includeMetadata: {
                    type: 'boolean',
                    default: true,
                    description: 'Incluir metadatos en el archivo'
                },
                preserveTypes: {
                    type: 'boolean',
                    default: true,
                    description: 'Preservar tipos de datos originales'
                }
            }
        };
    },

    /**
     * Estima el tamaño del archivo JSON
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @returns {number} Tamaño estimado en bytes
     */
    estimateSize(data, config = {}) {
        try {
            const processor = new DataProcessor(data, config).process();
            const transformedData = DataTransformer.toStructured(processor, config.format || 'structured');
            const content = this.generateJsonContent(transformedData, config);
            return new Blob([content]).size;
        } catch (error) {
            console.warn('Error estimando tamaño JSON:', error);
            return 0;
        }
    },

    /**
     * Genera preview del contenido JSON
     * @param {object} data - Datos a exportar
     * @param {object} config - Configuración
     * @param {number} maxLength - Longitud máxima del preview
     * @returns {string} Preview del contenido
     */
    generatePreview(data, config = {}, maxLength = 1000) {
        try {
            const processor = new DataProcessor(data, config).process();
            const transformedData = DataTransformer.toStructured(processor, config.format || 'structured');

            // Generar contenido completo
            const fullContent = this.generateJsonContent(transformedData, config);

            // Truncar si es necesario
            if (fullContent.length <= maxLength) {
                return fullContent;
            }

            // Truncar de manera inteligente
            const truncated = fullContent.substring(0, maxLength);
            const lastCompleteProperty = truncated.lastIndexOf(',');

            if (lastCompleteProperty > 0) {
                return truncated.substring(0, lastCompleteProperty) + '\n  ...\n}';
            }

            return truncated + '...';

        } catch (error) {
            return `Error generando preview: ${error.message}`;
        }
    },

    /**
     * Parsea y valida JSON de entrada
     * @param {string} jsonString - String JSON a parsear
     * @returns {object} Resultado del parsing
     */
    parseJson(jsonString) {
        const result = {
            success: false,
            data: null,
            errors: []
        };

        try {
            if (typeof jsonString !== 'string') {
                result.errors.push('El contenido debe ser un string JSON válido');
                return result;
            }

            result.data = JSON.parse(jsonString);
            result.success = true;

        } catch (error) {
            result.errors.push(`Error parseando JSON: ${error.message}`);

            // Intentar dar información más específica sobre el error
            const match = error.message.match(/position (\d+)/);
            if (match) {
                const position = parseInt(match[1]);
                const context = jsonString.substring(Math.max(0, position - 20), position + 20);
                result.errors.push(`Contexto del error: "${context}"`);
            }
        }

        return result;
    },

    /**
     * Optimiza JSON para diferentes casos de uso
     * @param {object} data - Datos originales
     * @param {string} optimization - Tipo de optimización
     * @returns {object} Datos optimizados
     */
    optimizeForUseCase(data, optimization = 'general') {
        switch (optimization) {
            case 'minimal':
                // Eliminar metadata y mantener solo datos esenciales
                return {
                    data: data.data || []
                };

            case 'api':
                // Formato optimizado para APIs
                return {
                    success: true,
                    data: data.data || [],
                    metadata: {
                        count: (data.data || []).length,
                        timestamp: new Date().toISOString()
                    }
                };

            case 'backup':
                // Formato completo para backup/restore
                return {
                    ...data,
                    exportInfo: {
                        version: '1.0',
                        timestamp: new Date().toISOString(),
                        type: 'backup'
                    }
                };

            case 'general':
            default:
                return data;
        }
    }
};