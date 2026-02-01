// src/export/components/forms/ExportFormExcel.jsx
// Formulario de configuración específico para exportación Excel

import { useState, useCallback } from "react";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

/**
 * Formulario de configuración para exportación Excel
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Formulario de configuración Excel
 */
export const ExportFormExcel = ({
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
    // Configuraciones específicas de Excel
    useExcelJS: true,
    autoFitColumns: true,
    freezeHeader: true,
    autoFilter: true,
    showBorders: true,
    includeMetadata: true,
    sheetName: "Datos",
    zoom: 100,

    // Estilos
    headerStyle: {
      bold: true,
      backgroundColor: "F2F2F2",
      textColor: "333333",
      fontSize: 11,
      height: 20,
    },
    cellStyle: {
      fontSize: 10,
      textColor: "000000",
      backgroundColor: "FFFFFF",
    },

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
  const [showStyling, setShowStyling] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [sheetsPreview, setSheetsPreview] = useState([]);

  /**
   * Colores predefinidos para estilos
   */
  const predefinedColors = [
    { value: "FFFFFF", label: "Blanco", color: "#FFFFFF" },
    { value: "F2F2F2", label: "Gris claro", color: "#F2F2F2" },
    { value: "E5E7EB", label: "Gris", color: "#E5E7EB" },
    { value: "3B82F6", label: "Azul", color: "#3B82F6" },
    { value: "10B981", label: "Verde", color: "#10B981" },
    { value: "F59E0B", label: "Amarillo", color: "#F59E0B" },
    { value: "EF4444", label: "Rojo", color: "#EF4444" },
    { value: "8B5CF6", label: "Púrpura", color: "#8B5CF6" },
    { value: "333333", label: "Gris oscuro", color: "#333333" },
    { value: "000000", label: "Negro", color: "#000000" },
  ];

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
   * Maneja cambios en estilos anidados
   */
  const handleStyleChange = useCallback(
    (styleType, key, value) => {
      const newConfig = {
        ...config,
        [styleType]: {
          ...config[styleType],
          [key]: value,
        },
      };
      setConfig(newConfig);

      if (onConfigChange) {
        onConfigChange(newConfig);
      }
    },
    [config, onConfigChange]
  );

  /**
   * Estima el tamaño del archivo
   */
  const estimateFileSize = useCallback(async () => {
    if (!data || !exportHook?.estimateFileSize) return;

    try {
      const size = await exportHook.estimateFileSize("excel", data, config);
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
        "excel",
        data,
        config
      );
      setPreview(previewContent);

      // Analizar hojas si es multi-hoja
      if (data.sheets && Array.isArray(data.sheets)) {
        setSheetsPreview(
          data.sheets.map((sheet) => ({
            name: sheet.name,
            rowCount: sheet.data ? sheet.data.length : 0,
            columnCount: sheet.columns ? sheet.columns.length : 0,
          }))
        );
      } else {
        setSheetsPreview([
          {
            name: config.sheetName || "Datos",
            rowCount: data.data ? data.data.length : 0,
            columnCount: data.columns ? data.columns.length : 0,
          },
        ]);
      }

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

    // Validar nombre de hoja
    if (!config.sheetName || config.sheetName.trim() === "") {
      errors.sheetName = "El nombre de hoja es requerido";
    } else if (config.sheetName.length > 31) {
      errors.sheetName =
        "El nombre de hoja no puede tener más de 31 caracteres";
    }

    // Validar zoom
    if (config.zoom < 50 || config.zoom > 200) {
      errors.zoom = "El zoom debe estar entre 50% y 200%";
    }

    // Validar colores
    const colorRegex = /^[0-9A-F]{6}$/i;
    if (
      config.headerStyle?.backgroundColor &&
      !colorRegex.test(config.headerStyle.backgroundColor)
    ) {
      errors.headerBackgroundColor =
        "Color de fondo debe ser hexadecimal (sin #)";
    }
    if (
      config.headerStyle?.textColor &&
      !colorRegex.test(config.headerStyle.textColor)
    ) {
      errors.headerTextColor = "Color de texto debe ser hexadecimal (sin #)";
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
   * Renderiza selector de color
   */
  const renderColorSelector = (value, onChange, error) => {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace("#", "").toUpperCase())
          }
          placeholder="FFFFFF"
          maxLength="6"
          className={`flex-1 px-3 py-2 border rounded-md text-sm font-mono
            ${
              error
                ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                : "border-secondary-300 dark:border-secondary-600 focus:border-primary-500 focus:ring-primary-500"
            }
            bg-white dark:bg-secondary-800 
            text-secondary-900 dark:text-secondary-100
            focus:outline-none focus:ring-1
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          disabled={disabled || loading}
        />
        <div
          className="w-8 h-8 rounded border border-secondary-300 dark:border-secondary-600 flex-shrink-0"
          style={{ backgroundColor: `#${value}` }}
        />
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
  });

  return (
    <div className={`export-form-excel space-y-6 ${className}`}>
      {/* Título */}
      <div className="border-b border-secondary-200 dark:border-secondary-700 pb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
          Configuración de Exportación Excel
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
          Configure las opciones para generar el archivo Excel con formato
          profesional
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

        {/* Nombre de hoja */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Nombre de la hoja
          </label>
          <input
            type="text"
            value={config.sheetName}
            onChange={(e) => handleConfigChange("sheetName", e.target.value)}
            placeholder="Datos"
            maxLength="31"
            disabled={disabled || loading}
            className={`w-full px-3 py-2 border rounded-md text-sm
              ${
                validationErrors.sheetName
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
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
            Máximo 31 caracteres ({config.sheetName.length}/31)
          </p>
          {validationErrors.sheetName && (
            <p className="text-xs text-danger-500 mt-1">
              {validationErrors.sheetName}
            </p>
          )}
        </div>

        {/* Motor de exportación */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Motor de exportación
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value={true}
                checked={config.useExcelJS === true}
                onChange={() => handleConfigChange("useExcelJS", true)}
                disabled={disabled || loading}
                className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
              />
              <span className="ml-2 text-sm text-secondary-700 dark:text-secondary-300">
                ExcelJS (recomendado) - Más funcionalidades y estilos
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value={false}
                checked={config.useExcelJS === false}
                onChange={() => handleConfigChange("useExcelJS", false)}
                disabled={disabled || loading}
                className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
              />
              <span className="ml-2 text-sm text-secondary-700 dark:text-secondary-300">
                XLSX - Más rápido y liviano
              </span>
            </label>
          </div>
        </div>

        {/* Configuraciones básicas con switches */}
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                Ajustar ancho de columnas automáticamente
              </span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                Calcula el ancho óptimo según el contenido
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.autoFitColumns}
              onChange={(e) =>
                handleConfigChange("autoFitColumns", e.target.checked)
              }
              disabled={disabled || loading}
              className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                Congelar fila de encabezados
              </span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                Los encabezados permanecen visibles al hacer scroll
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.freezeHeader}
              onChange={(e) =>
                handleConfigChange("freezeHeader", e.target.checked)
              }
              disabled={disabled || loading}
              className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                Habilitar filtros automáticos
              </span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                Agrega filtros desplegables en los encabezados
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.autoFilter}
              onChange={(e) =>
                handleConfigChange("autoFilter", e.target.checked)
              }
              disabled={disabled || loading}
              className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-secondary-700 dark:text-secondary-300">
              Incluir metadatos del documento
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
            {/* Zoom */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Nivel de zoom inicial ({config.zoom}%)
              </label>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={config.zoom}
                onChange={(e) =>
                  handleConfigChange("zoom", parseInt(e.target.value))
                }
                disabled={disabled || loading}
                className="w-full h-2 bg-secondary-200 dark:bg-secondary-700 rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary-500
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                <span>50%</span>
                <span>200%</span>
              </div>
              {validationErrors.zoom && (
                <p className="text-xs text-danger-500 mt-1">
                  {validationErrors.zoom}
                </p>
              )}
            </div>

            {/* Mostrar bordes */}
            <label className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-secondary-700 dark:text-secondary-300">
                  Mostrar bordes de celdas
                </span>
                <span className="text-xs text-secondary-500 dark:text-secondary-400">
                  Agrega bordes sutiles a todas las celdas
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.showBorders}
                onChange={(e) =>
                  handleConfigChange("showBorders", e.target.checked)
                }
                disabled={disabled || loading}
                className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
              />
            </label>
          </div>
        )}
      </div>

      {/* Configuración de estilos */}
      {config.useExcelJS && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowStyling(!showStyling)}
            className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
          >
            <svg
              className={`w-4 h-4 transform transition-transform ${
                showStyling ? "rotate-90" : ""
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
            Estilos y Formato
          </button>

          {showStyling && (
            <div className="space-y-4 pl-4 border-l-2 border-green-200 dark:border-green-700">
              {/* Estilos de encabezado */}
              <div>
                <h5 className="text-sm font-medium text-secondary-800 dark:text-secondary-200 mb-3">
                  Estilo de encabezados
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Color de fondo
                    </label>
                    {renderColorSelector(
                      config.headerStyle.backgroundColor,
                      (value) =>
                        handleStyleChange(
                          "headerStyle",
                          "backgroundColor",
                          value
                        ),
                      validationErrors.headerBackgroundColor
                    )}
                    {validationErrors.headerBackgroundColor && (
                      <p className="text-xs text-danger-500 mt-1">
                        {validationErrors.headerBackgroundColor}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Color del texto
                    </label>
                    {renderColorSelector(
                      config.headerStyle.textColor,
                      (value) =>
                        handleStyleChange("headerStyle", "textColor", value),
                      validationErrors.headerTextColor
                    )}
                    {validationErrors.headerTextColor && (
                      <p className="text-xs text-danger-500 mt-1">
                        {validationErrors.headerTextColor}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Tamaño de fuente
                    </label>
                    <input
                      type="number"
                      min="8"
                      max="20"
                      value={config.headerStyle.fontSize}
                      onChange={(e) =>
                        handleStyleChange(
                          "headerStyle",
                          "fontSize",
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
                    <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Altura de fila
                    </label>
                    <input
                      type="number"
                      min="15"
                      max="50"
                      value={config.headerStyle.height}
                      onChange={(e) =>
                        handleStyleChange(
                          "headerStyle",
                          "height",
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

                <label className="flex items-center mt-3">
                  <input
                    type="checkbox"
                    checked={config.headerStyle.bold}
                    onChange={(e) =>
                      handleStyleChange("headerStyle", "bold", e.target.checked)
                    }
                    disabled={disabled || loading}
                    className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                  />
                  <span className="ml-2 text-xs text-secondary-700 dark:text-secondary-300">
                    Texto en negrita
                  </span>
                </label>
              </div>

              {/* Colores rápidos */}
              <div>
                <h6 className="text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Colores predefinidos
                </h6>
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() =>
                        handleStyleChange(
                          "headerStyle",
                          "backgroundColor",
                          color.value
                        )
                      }
                      disabled={disabled || loading}
                      className="w-6 h-6 rounded border-2 border-secondary-300 dark:border-secondary-600 hover:border-primary-500 transition-colors disabled:opacity-50"
                      style={{ backgroundColor: color.color }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
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

              {/* Información de hojas */}
              {sheetsPreview.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-secondary-600 dark:text-secondary-400">
                    Hojas del archivo:
                  </p>
                  {sheetsPreview.map((sheet, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs bg-white dark:bg-secondary-700 rounded p-2"
                    >
                      <span className="font-medium text-secondary-700 dark:text-secondary-300">
                        {sheet.name}
                      </span>
                      <span className="text-secondary-500 dark:text-secondary-400">
                        {sheet.rowCount} filas × {sheet.columnCount} columnas
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Características habilitadas */}
              <div className="mt-3 flex flex-wrap gap-2">
                {config.autoFilter && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                    ✓ Filtros
                  </span>
                )}
                {config.freezeHeader && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    ✓ Headers congelados
                  </span>
                )}
                {config.autoFitColumns && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                    ✓ Auto-ajuste
                  </span>
                )}
                {config.showBorders && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded">
                    ✓ Bordes
                  </span>
                )}
                {config.useExcelJS && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                    ✓ ExcelJS
                  </span>
                )}
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
            bg-green-600 hover:bg-green-700 
            rounded-md transition-colors focus-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
              Exportando Excel...
            </>
          ) : (
            "Exportar Excel"
          )}
        </button>
      </div>
    </div>
  );
};

// Propiedades por defecto
ExportFormExcel.defaultProps = {
  initialConfig: {},
  showPreview: true,
  showEstimation: true,
  className: "",
  disabled: false,
  loading: false,
};
