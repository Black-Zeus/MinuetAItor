// src/export/components/forms/ExportFormTXT.jsx
// Formulario de configuración específico para exportación TXT

import { useState, useCallback } from "react";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

/**
 * Formulario de configuración para exportación TXT
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Formulario de configuración TXT
 */
export const ExportFormTXT = ({
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
    // Configuraciones específicas de TXT
    layout: "delimited", // 'delimited', 'fixed', 'aligned', 'report'
    delimiter: "\t",
    includeHeader: true,
    columnSeparator: " | ",
    lineBreak: "\n",
    encoding: "utf-8",

    // Configuraciones para layout fijo
    minColumnWidth: 5,
    maxColumnWidth: 50,
    fillChar: " ",

    // Configuraciones para reporte
    reportWidth: 80,
    includeSummary: true,
    includeFooter: true,

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
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [columnStats, setColumnStats] = useState([]);

  /**
   * Layouts disponibles
   */
  const layoutOptions = [
    {
      value: "delimited",
      label: "Delimitado (Tabulaciones)",
      description:
        "Campos separados por tabulaciones, similar a CSV pero con tabs",
    },
    {
      value: "fixed",
      label: "Ancho Fijo",
      description:
        "Columnas con ancho fijo, ideal para importar a sistemas legacy",
    },
    {
      value: "aligned",
      label: "Alineado Visualmente",
      description: "Columnas alineadas visualmente con separadores",
    },
    {
      value: "report",
      label: "Formato Reporte",
      description:
        "Documento completo con encabezado, resumen y datos formateados",
    },
  ];

  /**
   * Delimitadores para layout delimitado
   */
  const delimiterOptions = [
    { value: "\t", label: "Tabulación (recomendado)", char: "→" },
    { value: "|", label: "Barra vertical", char: "|" },
    { value: ";", label: "Punto y coma", char: ";" },
    { value: ",", label: "Coma", char: "," },
    { value: "custom", label: "Personalizado", char: "?" },
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

      // Si cambia el layout, aplicar configuraciones específicas
      if (key === "layout") {
        applyLayoutDefaults(value, newConfig);
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
   * Aplica configuraciones por defecto según el layout
   */
  const applyLayoutDefaults = useCallback((layout, currentConfig) => {
    const updates = { ...currentConfig };

    switch (layout) {
      case "delimited":
        updates.delimiter = "\t";
        updates.includeHeader = true;
        break;
      case "fixed":
        updates.fillChar = " ";
        updates.minColumnWidth = 8;
        updates.maxColumnWidth = 40;
        break;
      case "aligned":
        updates.columnSeparator = " | ";
        updates.includeHeader = true;
        break;
      case "report":
        updates.reportWidth = 80;
        updates.includeSummary = true;
        updates.includeFooter = true;
        break;
    }

    setConfig(updates);
  }, []);

  /**
   * Analiza las columnas de los datos
   */
  const analyzeColumns = useCallback(() => {
    if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
      setColumnStats([]);
      return;
    }

    const columns = data.columns || Object.keys(data.data[0]);
    const stats = columns.map((column) => {
      const key = typeof column === "string" ? column : column.key;
      const header = typeof column === "string" ? column : column.header || key;

      const values = data.data
        .map((row) => String(row[key] || ""))
        .filter((v) => v);
      const maxLength = Math.max(header.length, ...values.map((v) => v.length));

      return {
        key,
        header,
        maxLength,
        avgLength:
          values.reduce((sum, v) => sum + v.length, 0) / values.length || 0,
        hasLongValues: values.some((v) => v.length > 30),
        isEmpty: values.length === 0,
      };
    });

    setColumnStats(stats);
  }, [data]);

  /**
   * Estima el tamaño del archivo
   */
  const estimateFileSize = useCallback(async () => {
    if (!data || !exportHook?.estimateFileSize) return;

    try {
      const size = await exportHook.estimateFileSize("txt", data, config);
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
        "txt",
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
    }

    // Validar anchos de columna para layout fijo
    if (config.layout === "fixed") {
      if (
        config.minColumnWidth < 3 ||
        config.minColumnWidth > config.maxColumnWidth
      ) {
        errors.columnWidth =
          "El ancho mínimo debe ser mayor a 3 y menor al máximo";
      }
      if (config.maxColumnWidth > 100) {
        errors.columnWidth = "El ancho máximo no puede ser mayor a 100";
      }
    }

    // Validar ancho de reporte
    if (
      config.layout === "report" &&
      (config.reportWidth < 40 || config.reportWidth > 120)
    ) {
      errors.reportWidth = "El ancho del reporte debe estar entre 40 y 120";
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
        finalConfig.delimiter = config.customDelimiter || "\t";
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
   * Obtiene la descripción del layout actual
   */
  const getCurrentLayoutDescription = () => {
    const current = layoutOptions.find(
      (layout) => layout.value === config.layout
    );
    return current?.description || "";
  };

  // Efectos para estimación, preview y análisis
  useState(() => {
    if (showEstimation) {
      estimateFileSize();
    }
    if (showPreview) {
      generatePreview();
    }
    if (data) {
      analyzeColumns();
    }
  });

  return (
    <div className={`export-form-txt space-y-6 ${className}`}>
      {/* Título */}
      <div className="border-b border-secondary-200 dark:border-secondary-700 pb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
          Configuración de Exportación TXT
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
          Configure las opciones para generar un archivo de texto con formato
          específico
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

        {/* Tipo de layout */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Tipo de formato
          </label>
          <select
            value={config.layout}
            onChange={(e) => handleConfigChange("layout", e.target.value)}
            disabled={disabled || loading}
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
              bg-white dark:bg-secondary-800 
              text-secondary-900 dark:text-secondary-100
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {layoutOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
            {getCurrentLayoutDescription()}
          </p>
        </div>

        {/* Configuraciones básicas con switches */}
        <div className="space-y-3">
          {(config.layout === "delimited" || config.layout === "aligned") && (
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
          )}

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

      {/* Configuración específica del layout */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowLayoutOptions(!showLayoutOptions)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${
              showLayoutOptions ? "rotate-90" : ""
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
          Opciones de{" "}
          {layoutOptions.find((l) => l.value === config.layout)?.label}
        </button>

        {showLayoutOptions && (
          <div className="space-y-4 pl-4 border-l-2 border-secondary-200 dark:border-secondary-700">
            {/* Configuración para layout delimitado */}
            {config.layout === "delimited" && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Delimitador de campos
                </label>
                <select
                  value={config.delimiter}
                  onChange={(e) =>
                    handleConfigChange("delimiter", e.target.value)
                  }
                  disabled={disabled || loading}
                  className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                    bg-white dark:bg-secondary-800 
                    text-secondary-900 dark:text-secondary-100
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {delimiterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {config.delimiter === "custom" && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={config.customDelimiter || ""}
                      onChange={(e) =>
                        handleConfigChange("customDelimiter", e.target.value)
                      }
                      placeholder="Ingrese delimitador"
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
                        focus:outline-none focus:ring-1
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Configuración para layout alineado */}
            {config.layout === "aligned" && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Separador de columnas
                </label>
                <input
                  type="text"
                  value={config.columnSeparator}
                  onChange={(e) =>
                    handleConfigChange("columnSeparator", e.target.value)
                  }
                  placeholder=" | "
                  disabled={disabled || loading}
                  className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                    bg-white dark:bg-secondary-800 
                    text-secondary-900 dark:text-secondary-100
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                  Texto que aparece entre cada columna
                </p>
              </div>
            )}

            {/* Configuración para layout fijo */}
            {config.layout === "fixed" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Ancho mínimo
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="50"
                      value={config.minColumnWidth}
                      onChange={(e) =>
                        handleConfigChange(
                          "minColumnWidth",
                          parseInt(e.target.value)
                        )
                      }
                      disabled={disabled || loading}
                      className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                        bg-white dark:bg-secondary-800 
                        text-secondary-900 dark:text-secondary-100
                        focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Ancho máximo
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={config.maxColumnWidth}
                      onChange={(e) =>
                        handleConfigChange(
                          "maxColumnWidth",
                          parseInt(e.target.value)
                        )
                      }
                      disabled={disabled || loading}
                      className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                        bg-white dark:bg-secondary-800 
                        text-secondary-900 dark:text-secondary-100
                        focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Carácter de relleno
                  </label>
                  <select
                    value={config.fillChar}
                    onChange={(e) =>
                      handleConfigChange("fillChar", e.target.value)
                    }
                    disabled={disabled || loading}
                    className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=" ">Espacio</option>
                    <option value="0">Cero (0)</option>
                    <option value=".">Punto (.)</option>
                    <option value="_">Guión bajo (_)</option>
                  </select>
                </div>

                {validationErrors.columnWidth && (
                  <p className="text-xs text-danger-500">
                    {validationErrors.columnWidth}
                  </p>
                )}
              </div>
            )}

            {/* Configuración para layout reporte */}
            {config.layout === "report" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Ancho del reporte (caracteres)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="120"
                    value={config.reportWidth}
                    onChange={(e) =>
                      handleConfigChange(
                        "reportWidth",
                        parseInt(e.target.value)
                      )
                    }
                    disabled={disabled || loading}
                    className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                    Ancho total del documento (recomendado: 80)
                  </p>
                  {validationErrors.reportWidth && (
                    <p className="text-xs text-danger-500 mt-1">
                      {validationErrors.reportWidth}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.includeSummary}
                      onChange={(e) =>
                        handleConfigChange("includeSummary", e.target.checked)
                      }
                      disabled={disabled || loading}
                      className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                    />
                    <span className="ml-2 text-sm text-secondary-700 dark:text-secondary-300">
                      Incluir resumen de datos
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.includeFooter}
                      onChange={(e) =>
                        handleConfigChange("includeFooter", e.target.checked)
                      }
                      disabled={disabled || loading}
                      className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                    />
                    <span className="ml-2 text-sm text-secondary-700 dark:text-secondary-300">
                      Incluir pie del reporte
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
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
          </div>
        )}
      </div>

      {/* Análisis de columnas */}
      {columnStats.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-secondary-800 dark:text-secondary-200">
            Análisis de Columnas
          </h4>

          <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-4">
            <div className="grid gap-3">
              {columnStats.map((stat, index) => (
                <div
                  key={stat.key}
                  className="flex items-center justify-between py-2 border-b border-secondary-200 dark:border-secondary-600 last:border-b-0"
                >
                  <div className="flex-1">
                    <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                      {stat.header}
                    </span>
                    {stat.hasLongValues && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 text-xs bg-warning-100 dark:bg-warning-900 text-warning-700 dark:text-warning-300 rounded">
                        Valores largos
                      </span>
                    )}
                    {stat.isEmpty && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded">
                        Vacía
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-secondary-500 dark:text-secondary-400 text-right">
                    <div>Máx: {stat.maxLength} chars</div>
                    <div>Prom: {Math.round(stat.avgLength)} chars</div>
                  </div>
                </div>
              ))}
            </div>

            {config.layout === "fixed" && (
              <div className="mt-3 p-3 bg-info-50 dark:bg-info-900 rounded border border-info-200 dark:border-info-700">
                <p className="text-xs text-info-700 dark:text-info-300">
                  💡 Para layout de ancho fijo, considere ajustar los anchos
                  mínimo y máximo basándose en las longitudes de las columnas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
                <div className="grid grid-cols-2 gap-4 text-xs text-secondary-600 dark:text-secondary-400 mb-3">
                  <div>
                    <span className="block">Registros:</span>
                    <span className="font-mono">
                      {Array.isArray(data.data) ? data.data.length : 0}
                    </span>
                  </div>
                  <div>
                    <span className="block">Columnas:</span>
                    <span className="font-mono">
                      {columnStats.length || "Auto"}
                    </span>
                  </div>
                </div>
              )}

              {/* Características del formato */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded">
                  {layoutOptions.find((l) => l.value === config.layout)?.label}
                </span>

                {config.layout === "delimited" && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    Delimitador:{" "}
                    {delimiterOptions.find((d) => d.value === config.delimiter)
                      ?.char || config.customDelimiter}
                  </span>
                )}

                {config.layout === "fixed" && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                    Ancho: {config.minColumnWidth}-{config.maxColumnWidth}
                  </span>
                )}

                {config.layout === "aligned" && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                    Separador: "{config.columnSeparator}"
                  </span>
                )}

                {config.layout === "report" && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                    Ancho: {config.reportWidth} chars
                  </span>
                )}

                {config.includeHeader && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-info-100 dark:bg-info-900 text-info-700 dark:text-info-300 rounded">
                    ✓ Headers
                  </span>
                )}

                <span className="inline-flex items-center px-2 py-1 text-xs bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded">
                  {config.encoding.toUpperCase()}
                </span>
              </div>
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
              <pre className="bg-secondary-900 dark:bg-black text-secondary-100 dark:text-secondary-200 p-4 rounded-lg text-xs overflow-auto max-h-64 font-mono whitespace-pre">
                {preview}
              </pre>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">
                {config.layout === "fixed" &&
                  "💡 Las líneas están alineadas con ancho fijo"}
                {config.layout === "aligned" &&
                  "💡 Las columnas están alineadas visualmente"}
                {config.layout === "delimited" &&
                  "💡 Los campos están separados por delimitadores"}
                {config.layout === "report" &&
                  "💡 Formato de reporte completo con encabezado y resumen"}
              </p>
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
            bg-secondary-600 hover:bg-secondary-700 
            rounded-md transition-colors focus-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
              Exportando TXT...
            </>
          ) : (
            "Exportar TXT"
          )}
        </button>
      </div>
    </div>
  );
};

// Propiedades por defecto
ExportFormTXT.defaultProps = {
  initialConfig: {},
  showPreview: true,
  showEstimation: true,
  className: "",
  disabled: false,
  loading: false,
};
