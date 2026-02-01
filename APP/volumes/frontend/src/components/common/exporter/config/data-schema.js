// src/export/config/data-schema.js
// Esquemas de validación para el sistema de exportación

/**
 * Esquema base para estructura de datos de exportación
 */
export const dataSchema = {
    data: {
        type: 'array',
        required: true,
        items: {
            type: 'object',
            properties: 'flat' // Solo propiedades de primer nivel
        }
    },
    columns: {
        type: 'array',
        required: false,
        items: [
            {
                // Definición completa de columna
                type: 'object',
                properties: {
                    key: { type: 'string', required: true },
                    header: { type: 'string', required: false },
                    type: { type: 'string', enum: ['string', 'number', 'boolean', 'date'], default: 'string' },
                    formatter: { type: 'function', required: false }
                }
            },
            {
                // Definición simple (solo string con key)
                type: 'string'
            }
        ]
    },
    metadata: {
        type: 'object',
        required: false,
        properties: {
            title: { type: 'string' },
            author: { type: 'string' },
            createdAt: { type: 'string', format: 'iso-date' },
            description: { type: 'string' }
        }
    },
    sheets: {
        type: 'array',
        required: false,
        description: 'Para exportadores multi-hoja como Excel',
        items: {
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                data: { type: 'array', required: true },
                columns: { type: 'array', required: false }
            }
        }
    },
    content: {
        type: 'array',
        required: false,
        description: 'Para documentos complejos como PDF',
        items: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['cover', 'title', 'paragraph', 'table', 'pageBreak', 'image'],
                    required: true
                }
            }
        }
    }
};

/**
 * Esquema para configuración de exportación
 */
export const configSchema = {
    // Configuración de portada
    cover: {
        type: 'object',
        required: false,
        properties: {
            enabled: { type: 'boolean', default: false },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            logo: { type: 'string', description: 'URL o base64 de imagen' }
        }
    },

    // Configuración de encabezado
    header: {
        type: 'object',
        required: false,
        properties: {
            enabled: { type: 'boolean', default: false },
            text: { type: 'string' },
            logo: { type: 'string' }
        }
    },

    // Configuración de pie de página
    footer: {
        type: 'object',
        required: false,
        properties: {
            enabled: { type: 'boolean', default: false },
            text: { type: 'string' },
            pageNumbers: { type: 'boolean', default: false }
        }
    },

    // Configuración de marca/branding
    branding: {
        type: 'object',
        required: false,
        properties: {
            orgName: { type: 'string' },
            primaryColor: { type: 'string', format: 'hex-color' },
            secondaryColor: { type: 'string', format: 'hex-color' },
            logo: { type: 'string' }
        }
    },

    // Configuraciones específicas por formato
    delimiter: {
        type: 'string',
        default: ',',
        description: 'Para CSV - separador de campos'
    },

    format: {
        type: 'string',
        enum: ['array', 'structured', 'envelope'],
        default: 'structured',
        description: 'Para JSON - formato de salida'
    },

    autoFitColumns: {
        type: 'boolean',
        default: true,
        description: 'Para Excel - ajuste automático de columnas'
    },

    freezeHeader: {
        type: 'boolean',
        default: true,
        description: 'Para Excel - congelar fila de encabezados'
    },

    autoDownload: {
        type: 'boolean',
        default: true,
        description: 'Descargar automáticamente el archivo'
    },

    filename: {
        type: 'string',
        description: 'Nombre base del archivo (sin extensión)'
    }
};

/**
 * Esquemas específicos para contenido PDF complejo
 */
export const pdfContentSchema = {
    cover: {
        type: 'object',
        properties: {
            type: { type: 'string', value: 'cover' },
            title: { type: 'string', required: true },
            subtitle: { type: 'string' },
            logo: { type: 'string' },
            backgroundColor: { type: 'string' }
        }
    },

    title: {
        type: 'object',
        properties: {
            type: { type: 'string', value: 'title' },
            text: { type: 'string', required: true },
            level: { type: 'number', min: 1, max: 6, default: 1 },
            alignment: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' }
        }
    },

    paragraph: {
        type: 'object',
        properties: {
            type: { type: 'string', value: 'paragraph' },
            text: { type: 'string', required: true },
            alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'], default: 'left' },
            style: { type: 'string', enum: ['normal', 'bold', 'italic'], default: 'normal' }
        }
    },

    table: {
        type: 'object',
        properties: {
            type: { type: 'string', value: 'table' },
            data: { type: 'array', required: true },
            columns: { type: 'array' },
            title: { type: 'string' },
            headerStyle: { type: 'object' }
        }
    },

    pageBreak: {
        type: 'object',
        properties: {
            type: { type: 'string', value: 'pageBreak' }
        }
    },

    image: {
        type: 'object',
        properties: {
            type: { type: 'string', value: 'image' },
            src: { type: 'string', required: true },
            width: { type: 'number' },
            height: { type: 'number' },
            alignment: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' }
        }
    }
};

/**
 * Tipos de datos soportados
 */
export const supportedDataTypes = {
    string: {
        validate: (value) => typeof value === 'string',
        defaultFormatter: (value) => String(value || '')
    },

    number: {
        validate: (value) => typeof value === 'number' && !isNaN(value),
        defaultFormatter: (value) => Number(value) || 0
    },

    boolean: {
        validate: (value) => typeof value === 'boolean',
        defaultFormatter: (value) => Boolean(value)
    },

    date: {
        validate: (value) => value instanceof Date || !isNaN(Date.parse(value)),
        defaultFormatter: (value) => {
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'string') return new Date(value).toISOString();
            return new Date().toISOString();
        }
    }
};

/**
 * Formatos de archivo soportados
 */
export const supportedFormats = {
    csv: {
        extension: 'csv',
        mimeType: 'text/csv',
        supportsMultiSheet: false,
        supportsMetadata: false,
        supportsFormatting: false,
        dependencies: []
    },

    json: {
        extension: 'json',
        mimeType: 'application/json',
        supportsMultiSheet: false,
        supportsMetadata: true,
        supportsFormatting: false,
        dependencies: []
    },

    excel: {
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        supportsMultiSheet: true,
        supportsMetadata: true,
        supportsFormatting: true,
        dependencies: ['xlsx']
    },

    pdf: {
        extension: 'pdf',
        mimeType: 'application/pdf',
        supportsMultiSheet: false,
        supportsMetadata: true,
        supportsFormatting: true,
        dependencies: ['pdfmake']
    },

    txt: {
        extension: 'txt',
        mimeType: 'text/plain',
        supportsMultiSheet: false,
        supportsMetadata: false,
        supportsFormatting: false,
        dependencies: []
    }
};