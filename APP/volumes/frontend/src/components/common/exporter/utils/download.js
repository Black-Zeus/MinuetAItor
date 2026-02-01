// src/export/utils/download.js
// Utilidad de auto-descarga para archivos generados

import { supportedFormats } from '../config/data-schema.js';
import { generateFilename } from '../config/format-defaults.js';

/**
 * Gestor de descargas automáticas
 */
export class DownloadManager {
    constructor(config = {}) {
        this.config = {
            autoDownload: true,
            showProgress: false,
            timeout: 30000, // 30 segundos timeout
            ...config
        };

        this.downloads = new Map(); // Tracking de descargas activas
    }

    /**
     * Descarga un archivo automáticamente
     * @param {string|Blob|ArrayBuffer} content - Contenido del archivo
     * @param {string} filename - Nombre del archivo
     * @param {string} format - Formato del archivo
     * @param {object} options - Opciones adicionales
     * @returns {Promise<boolean>} Success status
     */
    async downloadFile(content, filename, format, options = {}) {
        const downloadId = this.generateDownloadId();

        try {
            // Registrar descarga
            this.downloads.set(downloadId, {
                filename,
                format,
                startTime: Date.now(),
                status: 'starting'
            });

            // Preparar contenido y blob
            const blob = await this.prepareBlob(content, format);
            const finalFilename = this.prepareFinalFilename(filename, format, options);

            // Actualizar status
            this.downloads.get(downloadId).status = 'downloading';

            // Realizar descarga según el método disponible
            const success = await this.performDownload(blob, finalFilename, downloadId, options);

            // Limpiar tracking después de un tiempo
            setTimeout(() => {
                this.downloads.delete(downloadId);
            }, 5000);

            return success;

        } catch (error) {
            console.error('Error en descarga:', error);

            // Actualizar status de error
            if (this.downloads.has(downloadId)) {
                this.downloads.get(downloadId).status = 'error';
                this.downloads.get(downloadId).error = error.message;
            }

            // Intentar descarga de emergencia
            if (options.fallbackToDownload !== false) {
                return this.emergencyDownload(content, filename, format);
            }

            return false;
        }
    }

    /**
     * Prepara el blob para descarga
     * @param {string|Blob|ArrayBuffer} content - Contenido
     * @param {string} format - Formato
     * @returns {Blob} Blob preparado
     */
    async prepareBlob(content, format) {
        // Si ya es un Blob, devolverlo
        if (content instanceof Blob) {
            return content;
        }

        // Si es ArrayBuffer, convertir a Blob
        if (content instanceof ArrayBuffer) {
            const formatInfo = supportedFormats[format];
            return new Blob([content], {
                type: formatInfo?.mimeType || 'application/octet-stream'
            });
        }

        // Si es string, convertir a Blob con encoding adecuado
        if (typeof content === 'string') {
            const formatInfo = supportedFormats[format];

            // Para formatos de texto, usar UTF-8
            if (['csv', 'txt', 'json'].includes(format)) {
                return new Blob([content], {
                    type: formatInfo?.mimeType || 'text/plain',
                    encoding: 'utf-8'
                });
            }

            // Para otros formatos, asumir que ya está en formato correcto
            return new Blob([content], {
                type: formatInfo?.mimeType || 'application/octet-stream'
            });
        }

        // Fallback: convertir a JSON string
        const jsonContent = JSON.stringify(content, null, 2);
        return new Blob([jsonContent], { type: 'application/json' });
    }

    /**
     * Prepara el nombre final del archivo
     * @param {string} filename - Nombre base
     * @param {string} format - Formato
     * @param {object} options - Opciones
     * @returns {string} Nombre final
     */
    prepareFinalFilename(filename, format, options) {
        let finalName = filename;

        // Agregar timestamp si está configurado
        if (options.includeTimestamp !== false) {
            finalName = generateFilename(filename, format, true);
        } else {
            // Solo agregar extensión si no la tiene
            if (!finalName.endsWith(`.${format}`)) {
                finalName = `${finalName}.${format}`;
            }
        }

        // Sanitizar nombre de archivo
        finalName = this.sanitizeFilename(finalName);

        return finalName;
    }

    /**
     * Realiza la descarga usando el método más apropiado
     * @param {Blob} blob - Blob a descargar
     * @param {string} filename - Nombre del archivo
     * @param {string} downloadId - ID de descarga
     * @param {object} options - Opciones
     * @returns {boolean} Success status
     */
    async performDownload(blob, filename, downloadId, options) {
        // Método 1: File System Access API (si está disponible y es soportado)
        if (options.useFileSystemAPI && 'showSaveFilePicker' in window) {
            try {
                return await this.downloadWithFileSystemAPI(blob, filename, downloadId);
            } catch (error) {
                console.warn('File System API falló, usando método alternativo:', error);
            }
        }

        // Método 2: FileSaver.js (si está disponible)
        if (options.useFileSaver && this.isFileSaverAvailable()) {
            try {
                return await this.downloadWithFileSaver(blob, filename, downloadId);
            } catch (error) {
                console.warn('FileSaver falló, usando método nativo:', error);
            }
        }

        // Método 3: Descarga nativa con anchor element
        return this.downloadWithAnchor(blob, filename, downloadId);
    }

    /**
     * Descarga usando File System Access API
     * @param {Blob} blob - Blob a descargar
     * @param {string} filename - Nombre del archivo
     * @param {string} downloadId - ID de descarga
     * @returns {boolean} Success status
     */
    async downloadWithFileSystemAPI(blob, filename, downloadId) {
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Archivo exportado',
                accept: { [blob.type]: [`.${filename.split('.').pop()}`] }
            }]
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        this.downloads.get(downloadId).status = 'completed';
        return true;
    }

    /**
     * Descarga usando FileSaver.js
     * @param {Blob} blob - Blob a descargar
     * @param {string} filename - Nombre del archivo
     * @param {string} downloadId - ID de descarga
     * @returns {boolean} Success status
     */
    async downloadWithFileSaver(blob, filename, downloadId) {
        // Importar FileSaver dinámicamente
        const { saveAs } = await import('file-saver');

        saveAs(blob, filename);

        this.downloads.get(downloadId).status = 'completed';
        return true;
    }

    /**
     * Descarga usando anchor element (método nativo)
     * @param {Blob} blob - Blob a descargar
     * @param {string} filename - Nombre del archivo
     * @param {string} downloadId - ID de descarga
     * @returns {boolean} Success status
     */
    downloadWithAnchor(blob, filename, downloadId) {
        try {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = filename;
            anchor.style.display = 'none';

            // Agregar al DOM temporalmente
            document.body.appendChild(anchor);

            // Trigger download
            anchor.click();

            // Limpiar
            document.body.removeChild(anchor);

            // Liberar URL después de un tiempo
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

            this.downloads.get(downloadId).status = 'completed';
            return true;

        } catch (error) {
            console.error('Error en descarga nativa:', error);
            this.downloads.get(downloadId).status = 'error';
            return false;
        }
    }

    /**
     * Descarga de emergencia para casos críticos
     * @param {any} content - Contenido
     * @param {string} filename - Nombre del archivo
     * @param {string} format - Formato
     * @returns {boolean} Success status
     */
    emergencyDownload(content, filename, format) {
        try {
            // Convertir contenido a string si es necesario
            let textContent;
            if (typeof content === 'string') {
                textContent = content;
            } else if (content instanceof Blob) {
                // No podemos hacer descarga de emergencia con Blob de forma síncrona
                return false;
            } else {
                textContent = JSON.stringify(content, null, 2);
            }

            // Crear data URI
            const dataUri = `data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`;

            // Crear anchor para descarga
            const anchor = document.createElement('a');
            anchor.href = dataUri;
            anchor.download = this.sanitizeFilename(`${filename}.${format}`);
            anchor.style.display = 'none';

            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);

            return true;

        } catch (error) {
            console.error('Descarga de emergencia falló:', error);
            return false;
        }
    }

    /**
     * Verifica si FileSaver está disponible
     * @returns {boolean} Disponibilidad
     */
    isFileSaverAvailable() {
        try {
            // Verificar si podemos importar file-saver
            return typeof window !== 'undefined' &&
                (window.saveAs ||
                    (typeof require !== 'undefined' && require.resolve && require.resolve('file-saver')));
        } catch {
            return false;
        }
    }

    /**
     * Sanitiza nombre de archivo
     * @param {string} filename - Nombre a sanitizar
     * @returns {string} Nombre sanitizado
     */
    sanitizeFilename(filename) {
        // Remover caracteres no permitidos
        return filename
            .replace(/[<>:"/\\|?*]/g, '_') // Caracteres prohibidos en Windows
            .replace(/\s+/g, '_') // Espacios múltiples a underscore
            .replace(/_+/g, '_') // Underscores múltiples a uno solo
            .replace(/^_|_$/g, '') // Remover underscores al inicio/final
            .substring(0, 255); // Limitar longitud
    }

    /**
     * Genera ID único para descarga
     * @returns {string} ID único
     */
    generateDownloadId() {
        return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtiene el estado de una descarga
     * @param {string} downloadId - ID de descarga
     * @returns {object|null} Estado de descarga
     */
    getDownloadStatus(downloadId) {
        return this.downloads.get(downloadId) || null;
    }

    /**
     * Obtiene todas las descargas activas
     * @returns {array} Array de descargas
     */
    getActiveDownloads() {
        return Array.from(this.downloads.entries()).map(([id, info]) => ({
            id,
            ...info
        }));
    }

    /**
     * Cancela una descarga (si es posible)
     * @param {string} downloadId - ID de descarga
     * @returns {boolean} Si se canceló exitosamente
     */
    cancelDownload(downloadId) {
        if (this.downloads.has(downloadId)) {
            const download = this.downloads.get(downloadId);
            download.status = 'cancelled';
            return true;
        }
        return false;
    }
}

/**
 * Instancia global del gestor de descargas
 */
export const downloadManager = new DownloadManager();

/**
 * Función de conveniencia para descarga rápida
 * @param {any} content - Contenido a descargar
 * @param {string} filename - Nombre del archivo
 * @param {string} format - Formato del archivo
 * @param {object} options - Opciones adicionales
 * @returns {Promise<boolean>} Success status
 */
export const downloadFile = async (content, filename, format, options = {}) => {
    return downloadManager.downloadFile(content, filename, format, options);
};

/**
 * Utilidades adicionales de descarga
 */
export const downloadUtils = {
    /**
     * Verifica si el navegador soporta descargas automáticas
     * @returns {boolean} Soporte disponible
     */
    isDownloadSupported() {
        return typeof document !== 'undefined' &&
            typeof URL !== 'undefined' &&
            typeof Blob !== 'undefined';
    },

    /**
     * Estima el tiempo de descarga basado en el tamaño del archivo
     * @param {number} sizeBytes - Tamaño en bytes
     * @param {number} speedBytesPerSecond - Velocidad estimada
     * @returns {number} Tiempo estimado en segundos
     */
    estimateDownloadTime(sizeBytes, speedBytesPerSecond = 1024 * 1024) { // 1MB/s por defecto
        return Math.ceil(sizeBytes / speedBytesPerSecond);
    },

    /**
     * Formatea el tamaño de archivo para mostrar
     * @param {number} bytes - Tamaño en bytes
     * @returns {string} Tamaño formateado
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Verifica si el formato requiere dependencias especiales
     * @param {string} format - Formato a verificar
     * @returns {object} Información de dependencias
     */
    checkFormatDependencies(format) {
        const formatInfo = supportedFormats[format];

        if (!formatInfo) {
            return { required: false, dependencies: [] };
        }

        return {
            required: formatInfo.dependencies && formatInfo.dependencies.length > 0,
            dependencies: formatInfo.dependencies || []
        };
    },

    /**
     * Crea un preview URL temporal para el contenido
     * @param {Blob} blob - Blob para preview
     * @returns {string} URL temporal
     */
    createPreviewUrl(blob) {
        return URL.createObjectURL(blob);
    },

    /**
     * Libera un preview URL
     * @param {string} url - URL a liberar
     */
    revokePreviewUrl(url) {
        URL.revokeObjectURL(url);
    }
};