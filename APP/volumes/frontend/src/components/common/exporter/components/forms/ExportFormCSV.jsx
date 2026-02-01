// src/export/components/forms/ExportFormCSV.jsx
// Formulario de configuración específico para exportación CSV

import { useState, useCallback } from "react";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

/**
 * Formulario de configuración para exportación CSV
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Formulario de configuración CSV
 */
export const ExportFormCSV = ({
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
    // Configuraciones específicas de CSV
    delimiter: ",",
    includeHeader: true,
    quoteStrings: true,
    escapeQuotes: true,
    lineBreak: "\n",
    encoding: "utf-8",

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
  const [delimiterConflicts, setDelimiterConflicts] = useState(0);

  /**
   * Delimitadores predefinidos
   */
  const predefinedDelimiters = [
    { value: ",", label: "Coma (,)", description: "Estándar internacional" },
    { value: ";", label: "Punto y coma (;)", description: "Estándar europeo" },
    { value: "\t", label: "Tabulación", description: "Para importar a Excel" },
    {
      value: "|",
      label: "Barra vertical (|)",
      description: "Evita conflictos",
    },
    {
      value: "custom",
      label: "Personalizado",
      description: "Definir manualmente",
    },
  ];

  /**
   * Opciones de codificación
   */
  const encodingOptions = [
    {
      value: "utf-8",
      label: "UTF-8",
      description: "Recomendado (soporta caracteres especiales)",
    },
    {
      value: "latin1",
      label: "Latin-1",
      description: "Compatibilidad con sistemas antiguos",
    },
    { value: "ascii", label: "ASCII", description: "Solo caracteres básicos" },
  ];

  /**
   * Maneja cambios en la configuración
   */
  const handleConfigChange = useCallback(
    (key, value) => {
      const newConfig = { ...config, [key]: value };
      setConfig(newConfig);

      // Análisis de conflictos de delimitador
      if (key === "delimiter") {
        analyzeDelimiterConflicts(value);
      }

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
   * Analiza conflictos potenciales con el delimitador
   */
  const analyzeDelimiterConflicts = useCallback(
    (delimiter) => {
      if (!data?.data || !Array.isArray(data.data) || delimiter === "custom") {
        setDelimiterConflicts(0);
        return;
      }

      let conflicts = 0;
      const sampleSize = Math.min(100, data.data.length);

      for (let i = 0; i < sampleSize; i++) {
        const row = data.data[i];
        Object.values(row).forEach((value) => {
          if (String(value).includes(delimiter)) {
            conflicts++;
          }
        });
      }

      setDelimiterConflicts(conflicts);
    },
    [data]
  );

  /**
   * Estima el tamaño del archivo
   */
  const estimateFileSize = useCallback(async () => {
    if (!data || !exportHook?.estimateFileSize) return;

    try {
      const size = await exportHook.estimateFileSize("csv", data, config);
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
        "csv",
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

    // Validar delimitador personalizado
    if (config.delimiter === "custom" && !config.customDelimiter) {
      errors.delimiter = "Debe especificar un delimitador personalizado";
    } else if (
      config.delimiter === "custom" &&
      config.customDelimiter.length > 1
    ) {
      errors.delimiter = "Se recomienda usar delimitadores de un solo carácter";
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
      // Preparar configuración final
      const finalConfig = { ...config };
      if (config.delimiter === "custom") {
        finalConfig.delimiter = config.customDelimiter || ",";
      }

      await onExport(finalConfig);
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
   * Obtiene el icono de advertencia para conflictos
   */
  const getConflictWarning = () => {
    if (delimiterConflicts === 0) return null;

    return (
      <div className="flex items-center gap-2 text-xs text-warning-600 dark:text-warning-400 mt-1">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>
          {delimiterConflicts} campos contienen este delimitador (se envolverán
          en comillas)
        </span>
      </div>
    );
  };

  // Efectos para estimación y preview
  useState(() => {
    if (showEstimation) {
      estimateFileSize();
    }
    if (showPreview) {
      generatePreview();
    }
    if (data) {
      analyzeDelimiterConflicts(config.delimiter);
    }
  });

  return (
    <div className={`export-form-csv space-y-6 ${className}`}>
      {/* Título */}
      <div className="border-b border-secondary-200 dark:border-secondary-700 pb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
          Configuración de Exportación CSV
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
          Configure las opciones para generar el archivo CSV
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

        {/* Delimitador */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Delimitador de campos
          </label>
          <select
            value={config.delimiter}
            onChange={(e) => handleConfigChange("delimiter", e.target.value)}
            disabled={disabled || loading}
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
              bg-white dark:bg-secondary-800 
              text-secondary-900 dark:text-secondary-100
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {predefinedDelimiters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Delimitador personalizado */}
          {config.delimiter === "custom" && (
            <div className="mt-2">
              <input
                type="text"
                value={config.customDelimiter || ""}
                onChange={(e) =>
                  handleConfigChange("customDelimiter", e.target.value)
                }
                placeholder="Ingrese delimitador personalizado"
                maxLength="3"
                disabled={disabled || loading}
                className={`w-full px-3 py-2 border rounded-md text-sm
                  ${
                    validationErrors.delimiter
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
            </div>
          )}

          {/* Descripción del delimitador */}
          {config.delimiter !== "custom" && (
            <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
              {
                predefinedDelimiters.find((d) => d.value === config.delimiter)
                  ?.description
              }
            </p>
          )}

          {/* Advertencia de conflictos */}
          {getConflictWarning()}

          {validationErrors.delimiter && (
            <p className="text-xs text-danger-500 mt-1">
              {validationErrors.delimiter}
            </p>
          )}
        </div>

        {/* Switches básicos */}
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-secondary-700 dark:text-secondary-300">
              Incluir fila de encabezados
            </span>
            <input
              type="checkbox"
              checked={config.includeHeader}
              onChange={(e) =>
                handleConfigChange("includeHeader", e.target.checked)
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
            {/* Codificación */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Codificación del archivo
              </label>
              <select
                value={config.encoding}
                onChange={(e) => handleConfigChange("encoding", e.target.value)}
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                  bg-white dark:bg-secondary-800 
                  text-secondary-900 dark:text-secondary-100
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {encodingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                {
                  encodingOptions.find((e) => e.value === config.encoding)
                    ?.description
                }
              </p>
            </div>

            {/* Salto de línea */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Salto de línea
              </label>
              <select
                value={config.lineBreak}
                onChange={(e) =>
                  handleConfigChange("lineBreak", e.target.value)
                }
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                  bg-white dark:bg-secondary-800 
                  text-secondary-900 dark:text-secondary-100
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="\n">Unix/Linux (LF)</option>
                <option value="\r\n">Windows (CRLF)</option>
                <option value="\r">Mac clásico (CR)</option>
              </select>
            </div>

            {/* Opciones de formato */}
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm text-secondary-700 dark:text-secondary-300">
                    Envolver strings en comillas
                  </span>
                  <span className="text-xs text-secondary-500 dark:text-secondary-400">
                    Previene problemas con delimitadores en el contenido
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={config.quoteStrings}
                  onChange={(e) =>
                    handleConfigChange("quoteStrings", e.target.checked)
                  }
                  disabled={disabled || loading}
                  className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm text-secondary-700 dark:text-secondary-300">
                    Escapar comillas internas
                  </span>
                  <span className="text-xs text-secondary-500 dark:text-secondary-400">
                    Convierte " en "" dentro del contenido
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={config.escapeQuotes}
                  onChange={(e) =>
                    handleConfigChange("escapeQuotes", e.target.checked)
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

              {/* Advertencias */}
              {delimiterConflicts > 0 && (
                <div className="mt-3 p-2 bg-warning-50 dark:bg-warning-900 rounded border border-warning-200 dark:border-warning-700">
                  <p className="text-xs text-warning-700 dark:text-warning-300">
                    ⚠️ Se detectaron {delimiterConflicts} conflictos con el
                    delimitador. Los campos afectados se envolverán
                    automáticamente en comillas.
                  </p>
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
            bg-success-600 hover:bg-success-700 
            rounded-md transition-colors focus-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
              Exportando CSV...
            </>
          ) : (
            "Exportar CSV"
          )}
        </button>
      </div>
    </div>
  );
};

// Propiedades por defecto
ExportFormCSV.defaultProps = {
  initialConfig: {},
  showPreview: true,
  showEstimation: true,
  className: "",
  disabled: false,
  loading: false,
};
