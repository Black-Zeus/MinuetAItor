// src/export/components/forms/ExportFormJSON.jsx
// Formulario de configuración específico para exportación JSON

import { useState, useCallback } from "react";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

/**
 * Formulario de configuración para exportación JSON
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Formulario de configuración JSON
 */
export const ExportFormJSON = ({
  // Props principales
  data,
  initialConfig = {},

  // Props de comportamiento
  showPreview = true,
  showEstimation = true,

  // Callbacks
  onConfigChange,
  onExport,
  onCancel,
  onPreview,

  // Props de UI
  className = "",
  disabled = false,
  loading = false,

  // Props del hook de exportación (pasadas desde el padre)
  exportHook,
}) => {
  // Estado del formulario
  const [config, setConfig] = useState({
    // Configuraciones específicas de JSON
    format: "structured", // 'array', 'structured', 'envelope'
    indent: 2,
    includeMetadata: true,
    preserveTypes: true,

    // Configuraciones generales
    filename: "export",
    timestamp: true,
    autoDownload: true,

    // Merge con configuración inicial
    ...initialConfig,
  });

  // Estados de UI
  const [estimatedSize, setEstimatedSize] = useState(null);
  const [preview, setPreview] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  /**
   * Maneja cambios en la configuración
   */
  const handleConfigChange = useCallback(
    (key, value) => {
      const newConfig = { ...config, [key]: value };
      setConfig(newConfig);

      // Callback externo
      if (onConfigChange) {
        onConfigChange(newConfig);
      }

      // Limpiar errores relacionados
      if (validationErrors[key]) {
        setValidationErrors((prev) => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      }
    },
    [config, onConfigChange, validationErrors]
  );

  /**
   * Estima el tamaño del archivo
   */
  const estimateFileSize = useCallback(async () => {
    if (!data || !exportHook?.estimateFileSize) return;

    try {
      const size = await exportHook.estimateFileSize("json", data, config);
      setEstimatedSize(size);
    } catch (error) {
      console.warn("Error estimando tamaño:", error);
      setEstimatedSize(null);
    }
  }, [data, config, exportHook]);

  /**
   * Genera preview del contenido
   */
  const generatePreview = useCallback(async () => {
    if (!data || !exportHook?.generatePreview) return;

    try {
      const previewContent = await exportHook.generatePreview(
        "json",
        data,
        config
      );
      setPreview(previewContent);

      if (onPreview) {
        onPreview(previewContent);
      }
    } catch (error) {
      console.warn("Error generando preview:", error);
      setPreview("Error generando preview: " + error.message);
    }
  }, [data, config, exportHook, onPreview]);

  /**
   * Valida la configuración
   */
  const validateConfig = useCallback(() => {
    const errors = {};

    // Validar nombre de archivo
    if (!config.filename || config.filename.trim() === "") {
      errors.filename = "El nombre de archivo es requerido";
    } else if (
      config.filename.includes("/") ||
      config.filename.includes("\\")
    ) {
      errors.filename = "El nombre de archivo no puede contener rutas";
    }

    // Validar indentación
    if (config.indent < 0 || config.indent > 10) {
      errors.indent = "La indentación debe estar entre 0 y 10";
    }

    // Validar formato
    if (!["array", "structured", "envelope"].includes(config.format)) {
      errors.format = "Formato JSON no válido";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [config]);

  /**
   * Maneja la exportación
   */
  const handleExport = useCallback(async () => {
    if (!validateConfig() || !data || !onExport) return;

    try {
      await onExport(config);
    } catch (error) {
      console.error("Error en exportación:", error);
    }
  }, [config, data, onExport, validateConfig]);

  /**
   * Formatea el tamaño de archivo
   */
  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";

    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  /**
   * Obtiene descripción del formato
   */
  const getFormatDescription = (format) => {
    switch (format) {
      case "array":
        return "Solo array de datos, sin metadatos adicionales";
      case "structured":
        return "Estructura completa con datos, columnas y metadatos";
      case "envelope":
        return "Formato de respuesta API con success, data y metadata";
      default:
        return "";
    }
  };

  // Efectos para estimación y preview
  useState(() => {
    if (showEstimation) {
      estimateFileSize();
    }
    if (showPreview) {
      generatePreview();
    }
  });

  return (
    <div className={`export-form-json space-y-6 ${className}`}>
      {/* Título */}
      <div className="border-b border-secondary-200 dark:border-secondary-700 pb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
          Configuración de Exportación JSON
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
          Configure las opciones para generar el archivo JSON
        </p>
      </div>

      {/* Configuración básica */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-secondary-800 dark:text-secondary-200">
          Configuración Básica
        </h4>

        {/* Nombre de archivo */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Nombre de archivo
          </label>
          <input
            type="text"
            value={config.filename}
            onChange={(e) => handleConfigChange("filename", e.target.value)}
            placeholder="nombre-archivo"
            disabled={disabled || loading}
            className={`w-full px-3 py-2 border rounded-md text-sm
              ${
                validationErrors.filename
                  ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                  : "border-secondary-300 dark:border-secondary-600 focus:border-primary-500 focus:ring-primary-500"
              }
              bg-white dark:bg-secondary-800 
              text-secondary-900 dark:text-secondary-100
              placeholder-secondary-400 dark:placeholder-secondary-500
              focus:outline-none focus:ring-1
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />
          {validationErrors.filename && (
            <p className="text-xs text-danger-500 mt-1">
              {validationErrors.filename}
            </p>
          )}
        </div>

        {/* Formato de estructura */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Formato de estructura
          </label>
          <select
            value={config.format}
            onChange={(e) => handleConfigChange("format", e.target.value)}
            disabled={disabled || loading}
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
              bg-white dark:bg-secondary-800 
              text-secondary-900 dark:text-secondary-100
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="structured">Estructurado (recomendado)</option>
            <option value="array">Solo array de datos</option>
            <option value="envelope">Formato envelope (API)</option>
          </select>
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
            {getFormatDescription(config.format)}
          </p>
          {validationErrors.format && (
            <p className="text-xs text-danger-500 mt-1">
              {validationErrors.format}
            </p>
          )}
        </div>

        {/* Indentación */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Indentación (espacios)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="8"
              value={config.indent}
              onChange={(e) =>
                handleConfigChange("indent", parseInt(e.target.value))
              }
              disabled={disabled || loading}
              className="flex-1 h-2 bg-secondary-200 dark:bg-secondary-700 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-primary-500
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-sm font-mono text-secondary-600 dark:text-secondary-400 min-w-[2rem] text-right">
              {config.indent}
            </span>
          </div>
          <div className="flex justify-between text-xs text-secondary-500 dark:text-secondary-400 mt-1">
            <span>Compacto (0)</span>
            <span>Legible (8)</span>
          </div>
          {validationErrors.indent && (
            <p className="text-xs text-danger-500 mt-1">
              {validationErrors.indent}
            </p>
          )}
        </div>
      </div>

      {/* Configuración avanzada */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${
              showAdvanced ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Configuración Avanzada
        </button>

        {showAdvanced && (
          <div className="space-y-4 pl-4 border-l-2 border-secondary-200 dark:border-secondary-700">
            {/* Switches de configuración */}
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-secondary-700 dark:text-secondary-300">
                  Incluir metadatos
                </span>
                <input
                  type="checkbox"
                  checked={config.includeMetadata}
                  onChange={(e) =>
                    handleConfigChange("includeMetadata", e.target.checked)
                  }
                  disabled={disabled || loading}
                  className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-secondary-700 dark:text-secondary-300">
                  Preservar tipos de datos
                </span>
                <input
                  type="checkbox"
                  checked={config.preserveTypes}
                  onChange={(e) =>
                    handleConfigChange("preserveTypes", e.target.checked)
                  }
                  disabled={disabled || loading}
                  className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-secondary-700 dark:text-secondary-300">
                  Incluir timestamp en nombre
                </span>
                <input
                  type="checkbox"
                  checked={config.timestamp}
                  onChange={(e) =>
                    handleConfigChange("timestamp", e.target.checked)
                  }
                  disabled={disabled || loading}
                  className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-secondary-700 dark:text-secondary-300">
                  Descarga automática
                </span>
                <input
                  type="checkbox"
                  checked={config.autoDownload}
                  onChange={(e) =>
                    handleConfigChange("autoDownload", e.target.checked)
                  }
                  disabled={disabled || loading}
                  className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Información del archivo */}
      {(showEstimation || showPreview) && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-secondary-800 dark:text-secondary-200">
            Información del archivo
          </h4>

          {/* Estimación de tamaño */}
          {showEstimation && (
            <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  Tamaño estimado
                </span>
                <span className="text-sm font-mono text-secondary-900 dark:text-secondary-100">
                  {formatFileSize(estimatedSize)}
                </span>
              </div>

              {data && (
                <div className="grid grid-cols-2 gap-4 text-xs text-secondary-600 dark:text-secondary-400">
                  <div>
                    <span className="block">Registros:</span>
                    <span className="font-mono">
                      {Array.isArray(data.data) ? data.data.length : 0}
                    </span>
                  </div>
                  <div>
                    <span className="block">Columnas:</span>
                    <span className="font-mono">
                      {data.columns ? data.columns.length : "Auto"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {showPreview && preview && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  Vista previa
                </span>
                <button
                  type="button"
                  onClick={generatePreview}
                  disabled={disabled || loading}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50"
                >
                  Actualizar
                </button>
              </div>
              <pre className="bg-secondary-900 dark:bg-black text-secondary-100 dark:text-secondary-200 p-4 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                {preview}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Progreso si está exportando */}
      {loading && exportHook?.progress && (
        <ExportProgress
          progress={exportHook.progress}
          variant="inline"
          showDuration={true}
        />
      )}

      {/* Botones de acción */}
      <div className="flex gap-3 pt-4 border-t border-secondary-200 dark:border-secondary-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-300 
              bg-secondary-100 dark:bg-secondary-700 
              hover:bg-secondary-200 dark:hover:bg-secondary-600 
              rounded-md transition-colors focus-ring
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={
            loading ||
            disabled ||
            !data ||
            Object.keys(validationErrors).length > 0
          }
          className="flex-1 px-4 py-2 text-sm font-medium text-white 
            bg-primary-600 hover:bg-primary-700 
            rounded-md transition-colors focus-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
              Exportando JSON...
            </>
          ) : (
            "Exportar JSON"
          )}
        </button>
      </div>
    </div>
  );
};

// Propiedades por defecto
ExportFormJSON.defaultProps = {
  initialConfig: {},
  showPreview: true,
  showEstimation: true,
  className: "",
  disabled: false,
  loading: false,
};
