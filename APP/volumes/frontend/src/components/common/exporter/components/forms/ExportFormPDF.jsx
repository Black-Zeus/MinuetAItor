// src/export/components/forms/ExportFormPDF.jsx
// Formulario de configuración específico para exportación PDF

import { useState, useCallback } from "react";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

/**
 * Formulario de configuración para exportación PDF
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Formulario de configuración PDF
 */
export const ExportFormPDF = ({
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
    // Configuraciones de página
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 40, 40, 40], // [left, top, right, bottom]

    // Configuración de portada
    cover: {
      enabled: false,
      title: "",
      subtitle: "",
      logo: null,
      backgroundColor: "#FFFFFF",
    },

    // Configuración de encabezado
    header: {
      enabled: false,
      text: "",
      logo: null,
      height: 30,
    },

    // Configuración de pie de página
    footer: {
      enabled: true,
      text: "",
      pageNumbers: true,
      height: 30,
    },

    // Configuración de branding
    branding: {
      orgName: "",
      primaryColor: "#333333",
      secondaryColor: "#666666",
      logo: null,
    },

    // Estilos de contenido
    styles: {
      fontSize: 10,
      headerSize: 14,
      titleSize: 20,
      lineHeight: 1.4,
    },

    // Configuración de tabla
    table: {
      headerRows: 1,
      widths: "auto",
      layout: "lightHorizontalLines",
      fontSize: 9,
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
  const [estimatedPages, setEstimatedPages] = useState(0);
  const [preview, setPreview] = useState("");
  const [showLayout, setShowLayout] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  /**
   * Tamaños de página disponibles
   */
  const pageSizes = [
    { value: "A4", label: "A4 (210 × 297 mm)", width: 210, height: 297 },
    { value: "A3", label: "A3 (297 × 420 mm)", width: 297, height: 420 },
    { value: "A5", label: "A5 (148 × 210 mm)", width: 148, height: 210 },
    { value: "LETTER", label: "Carta (216 × 279 mm)", width: 216, height: 279 },
    { value: "LEGAL", label: "Legal (216 × 356 mm)", width: 216, height: 356 },
  ];

  /**
   * Layouts de tabla disponibles
   */
  const tableLayouts = [
    { value: "noBorders", label: "Sin bordes" },
    { value: "headerLineOnly", label: "Solo línea de encabezado" },
    { value: "lightHorizontalLines", label: "Líneas horizontales suaves" },
    { value: "lightVerticalLines", label: "Líneas verticales suaves" },
    { value: "tableLayout", label: "Bordes completos" },
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
   * Maneja cambios en configuraciones anidadas
   */
  const handleNestedChange = useCallback(
    (section, key, value) => {
      const newConfig = {
        ...config,
        [section]: {
          ...config[section],
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
   * Maneja cambios en márgenes
   */
  const handleMarginChange = useCallback(
    (index, value) => {
      const newMargins = [...config.pageMargins];
      newMargins[index] = parseInt(value) || 0;
      handleConfigChange("pageMargins", newMargins);
    },
    [config.pageMargins, handleConfigChange]
  );

  /**
   * Estima el tamaño del archivo y número de páginas
   */
  const estimateFileSize = useCallback(async () => {
    if (!data || !exportHook?.estimateFileSize) return;

    try {
      const size = await exportHook.estimateFileSize("pdf", data, config);
      setEstimatedSize(size);

      // Estimación aproximada de páginas basada en los datos
      if (data.data && Array.isArray(data.data)) {
        const rowsPerPage = 30; // Estimación aproximada
        const pages =
          Math.ceil(data.data.length / rowsPerPage) +
          (config.cover.enabled ? 1 : 0);
        setEstimatedPages(pages);
      }
    } catch (error) {
      console.warn("Error estimando tamaño:", error);
      setEstimatedSize(null);
      setEstimatedPages(0);
    }
  }, [data, config, exportHook]);

  /**
   * Genera preview del contenido
   */
  const generatePreview = useCallback(async () => {
    if (!data || !exportHook?.generatePreview) return;

    try {
      const previewContent = await exportHook.generatePreview(
        "pdf",
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

    // Validar márgenes
    if (config.pageMargins.some((margin) => margin < 0 || margin > 100)) {
      errors.pageMargins = "Los márgenes deben estar entre 0 y 100";
    }

    // Validar colores
    const colorRegex = /^#[0-9A-F]{6}$/i;
    if (
      config.branding.primaryColor &&
      !colorRegex.test(config.branding.primaryColor)
    ) {
      errors.primaryColor =
        "Color primario debe ser hexadecimal válido (#RRGGBB)";
    }
    if (
      config.branding.secondaryColor &&
      !colorRegex.test(config.branding.secondaryColor)
    ) {
      errors.secondaryColor =
        "Color secundario debe ser hexadecimal válido (#RRGGBB)";
    }

    // Validar tamaños de fuente
    if (config.styles.fontSize < 6 || config.styles.fontSize > 20) {
      errors.fontSize = "El tamaño de fuente debe estar entre 6 y 20";
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
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className="w-8 h-8 border border-secondary-300 dark:border-secondary-600 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#333333"
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
    <div className={`export-form-pdf space-y-6 ${className}`}>
      {/* Título */}
      <div className="border-b border-secondary-200 dark:border-secondary-700 pb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
          Configuración de Exportación PDF
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
          Configure las opciones para generar un documento PDF profesional
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

        {/* Tamaño y orientación de página */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Tamaño de página
            </label>
            <select
              value={config.pageSize}
              onChange={(e) => handleConfigChange("pageSize", e.target.value)}
              disabled={disabled || loading}
              className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                bg-white dark:bg-secondary-800 
                text-secondary-900 dark:text-secondary-100
                focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pageSizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Orientación
            </label>
            <select
              value={config.pageOrientation}
              onChange={(e) =>
                handleConfigChange("pageOrientation", e.target.value)
              }
              disabled={disabled || loading}
              className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                bg-white dark:bg-secondary-800 
                text-secondary-900 dark:text-secondary-100
                focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="portrait">Vertical (Portrait)</option>
              <option value="landscape">Horizontal (Landscape)</option>
            </select>
          </div>
        </div>

        {/* Configuraciones básicas con switches */}
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                Habilitar portada
              </span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                Agrega una página de portada al documento
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.cover.enabled}
              onChange={(e) =>
                handleNestedChange("cover", "enabled", e.target.checked)
              }
              disabled={disabled || loading}
              className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                Habilitar encabezado
              </span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                Muestra información en la parte superior de cada página
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.header.enabled}
              onChange={(e) =>
                handleNestedChange("header", "enabled", e.target.checked)
              }
              disabled={disabled || loading}
              className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                Habilitar pie de página
              </span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                Muestra información en la parte inferior de cada página
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.footer.enabled}
              onChange={(e) =>
                handleNestedChange("footer", "enabled", e.target.checked)
              }
              disabled={disabled || loading}
              className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-800 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
            />
          </label>

          {config.footer.enabled && (
            <label className="flex items-center justify-between ml-6">
              <span className="text-sm text-secondary-600 dark:text-secondary-400">
                Incluir numeración de páginas
              </span>
              <input
                type="checkbox"
                checked={config.footer.pageNumbers}
                onChange={(e) =>
                  handleNestedChange("footer", "pageNumbers", e.target.checked)
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

      {/* Configuración de layout */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowLayout(!showLayout)}
          className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${
              showLayout ? "rotate-90" : ""
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
          Configuración de Layout
        </button>

        {showLayout && (
          <div className="space-y-4 pl-4 border-l-2 border-red-200 dark:border-red-700">
            {/* Márgenes */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
                Márgenes de página (puntos)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                    Izquierda
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.pageMargins[0]}
                    onChange={(e) => handleMarginChange(0, e.target.value)}
                    disabled={disabled || loading}
                    className="w-full px-2 py-1 border border-secondary-300 dark:border-secondary-600 rounded text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                    Superior
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.pageMargins[1]}
                    onChange={(e) => handleMarginChange(1, e.target.value)}
                    disabled={disabled || loading}
                    className="w-full px-2 py-1 border border-secondary-300 dark:border-secondary-600 rounded text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                    Derecha
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.pageMargins[2]}
                    onChange={(e) => handleMarginChange(2, e.target.value)}
                    disabled={disabled || loading}
                    className="w-full px-2 py-1 border border-secondary-300 dark:border-secondary-600 rounded text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                    Inferior
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.pageMargins[3]}
                    onChange={(e) => handleMarginChange(3, e.target.value)}
                    disabled={disabled || loading}
                    className="w-full px-2 py-1 border border-secondary-300 dark:border-secondary-600 rounded text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              {validationErrors.pageMargins && (
                <p className="text-xs text-danger-500 mt-1">
                  {validationErrors.pageMargins}
                </p>
              )}
            </div>

            {/* Layout de tabla */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Estilo de tabla
              </label>
              <select
                value={config.table.layout}
                onChange={(e) =>
                  handleNestedChange("table", "layout", e.target.value)
                }
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                  bg-white dark:bg-secondary-800 
                  text-secondary-900 dark:text-secondary-100
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tableLayouts.map((layout) => (
                  <option key={layout.value} value={layout.value}>
                    {layout.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Configuración de branding */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowBranding(!showBranding)}
          className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${
              showBranding ? "rotate-90" : ""
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
          Configuración de Branding
        </button>

        {showBranding && (
          <div className="space-y-4 pl-4 border-l-2 border-purple-200 dark:border-purple-700">
            {/* Nombre de organización */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Nombre de la organización
              </label>
              <input
                type="text"
                value={config.branding.orgName}
                onChange={(e) =>
                  handleNestedChange("branding", "orgName", e.target.value)
                }
                placeholder="Mi Empresa S.A."
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                  bg-white dark:bg-secondary-800 
                  text-secondary-900 dark:text-secondary-100
                  placeholder-secondary-400 dark:placeholder-secondary-500
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Colores de marca */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Color primario
                </label>
                {renderColorSelector(
                  config.branding.primaryColor,
                  (value) =>
                    handleNestedChange("branding", "primaryColor", value),
                  validationErrors.primaryColor
                )}
                {validationErrors.primaryColor && (
                  <p className="text-xs text-danger-500 mt-1">
                    {validationErrors.primaryColor}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Color secundario
                </label>
                {renderColorSelector(
                  config.branding.secondaryColor,
                  (value) =>
                    handleNestedChange("branding", "secondaryColor", value),
                  validationErrors.secondaryColor
                )}
                {validationErrors.secondaryColor && (
                  <p className="text-xs text-danger-500 mt-1">
                    {validationErrors.secondaryColor}
                  </p>
                )}
              </div>
            </div>

            {/* Textos personalizados */}
            {config.cover.enabled && (
              <div className="space-y-3">
                <h6 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  Contenido de portada
                </h6>
                <div>
                  <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    value={config.cover.title}
                    onChange={(e) =>
                      handleNestedChange("cover", "title", e.target.value)
                    }
                    placeholder="Título del documento"
                    disabled={disabled || loading}
                    className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      placeholder-secondary-400 dark:placeholder-secondary-500
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                    Subtítulo
                  </label>
                  <input
                    type="text"
                    value={config.cover.subtitle}
                    onChange={(e) =>
                      handleNestedChange("cover", "subtitle", e.target.value)
                    }
                    placeholder="Subtítulo o descripción"
                    disabled={disabled || loading}
                    className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                      bg-white dark:bg-secondary-800 
                      text-secondary-900 dark:text-secondary-100
                      placeholder-secondary-400 dark:placeholder-secondary-500
                      focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            {config.header.enabled && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Texto del encabezado
                </label>
                <input
                  type="text"
                  value={config.header.text}
                  onChange={(e) =>
                    handleNestedChange("header", "text", e.target.value)
                  }
                  placeholder="Texto del encabezado"
                  disabled={disabled || loading}
                  className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                    bg-white dark:bg-secondary-800 
                    text-secondary-900 dark:text-secondary-100
                    placeholder-secondary-400 dark:placeholder-secondary-500
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {config.footer.enabled && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Texto del pie de página
                </label>
                <input
                  type="text"
                  value={config.footer.text}
                  onChange={(e) =>
                    handleNestedChange("footer", "text", e.target.value)
                  }
                  placeholder="Texto del pie de página"
                  disabled={disabled || loading}
                  className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md text-sm
                    bg-white dark:bg-secondary-800 
                    text-secondary-900 dark:text-secondary-100
                    placeholder-secondary-400 dark:placeholder-secondary-500
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuración de estilos */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowStyles(!showStyles)}
          className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${
              showStyles ? "rotate-90" : ""
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
          Configuración de Estilos
        </button>

        {showStyles && (
          <div className="space-y-4 pl-4 border-l-2 border-orange-200 dark:border-orange-700">
            {/* Tamaños de fuente */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                  Texto normal
                </label>
                <input
                  type="number"
                  min="6"
                  max="20"
                  value={config.styles.fontSize}
                  onChange={(e) =>
                    handleNestedChange(
                      "styles",
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
                <span className="text-xs text-secondary-500 dark:text-secondary-400">
                  pt
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                  Encabezados
                </label>
                <input
                  type="number"
                  min="8"
                  max="24"
                  value={config.styles.headerSize}
                  onChange={(e) =>
                    handleNestedChange(
                      "styles",
                      "headerSize",
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
                <span className="text-xs text-secondary-500 dark:text-secondary-400">
                  pt
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                  Título
                </label>
                <input
                  type="number"
                  min="12"
                  max="32"
                  value={config.styles.titleSize}
                  onChange={(e) =>
                    handleNestedChange(
                      "styles",
                      "titleSize",
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
                <span className="text-xs text-secondary-500 dark:text-secondary-400">
                  pt
                </span>
              </div>
            </div>

            {/* Espaciado de líneas */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Espaciado de líneas ({config.styles.lineHeight})
              </label>
              <input
                type="range"
                min="1"
                max="2"
                step="0.1"
                value={config.styles.lineHeight}
                onChange={(e) =>
                  handleNestedChange(
                    "styles",
                    "lineHeight",
                    parseFloat(e.target.value)
                  )
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
                <span>Compacto (1.0)</span>
                <span>Espacioso (2.0)</span>
              </div>
            </div>

            {/* Tamaño de fuente de tabla */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Tamaño de fuente en tablas
              </label>
              <input
                type="number"
                min="6"
                max="16"
                value={config.table.fontSize}
                onChange={(e) =>
                  handleNestedChange(
                    "table",
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
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                Fuente más pequeña para optimizar espacio en tablas
              </p>
            </div>

            {validationErrors.fontSize && (
              <p className="text-xs text-danger-500">
                {validationErrors.fontSize}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Información del archivo */}
      {(showEstimation || showPreview) && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-secondary-800 dark:text-secondary-200">
            Información del documento
          </h4>

          {/* Estimación de tamaño y páginas */}
          {showEstimation && (
            <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                    Tamaño estimado
                  </span>
                  <span className="text-sm font-mono text-secondary-900 dark:text-secondary-100">
                    {formatFileSize(estimatedSize)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                    Páginas estimadas
                  </span>
                  <span className="text-sm font-mono text-secondary-900 dark:text-secondary-100">
                    {estimatedPages}
                  </span>
                </div>
              </div>

              {/* Información de configuración */}
              <div className="border-t border-secondary-200 dark:border-secondary-600 pt-3">
                <div className="grid grid-cols-2 gap-4 text-xs text-secondary-600 dark:text-secondary-400">
                  <div>
                    <span className="block">Formato:</span>
                    <span className="font-mono">
                      {config.pageSize} {config.pageOrientation}
                    </span>
                  </div>
                  <div>
                    <span className="block">Márgenes:</span>
                    <span className="font-mono">
                      {config.pageMargins.join("/")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Características habilitadas */}
              <div className="mt-3 flex flex-wrap gap-2">
                {config.cover.enabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    ✓ Portada
                  </span>
                )}
                {config.header.enabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                    ✓ Encabezado
                  </span>
                )}
                {config.footer.enabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                    ✓ Pie de página
                  </span>
                )}
                {config.footer.pageNumbers && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                    ✓ Numeración
                  </span>
                )}
                {config.branding.orgName && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 rounded">
                    ✓ Branding
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
                  Vista previa del documento
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
            bg-red-600 hover:bg-red-700 
            rounded-md transition-colors focus-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
              Generando PDF...
            </>
          ) : (
            "Exportar PDF"
          )}
        </button>
      </div>
    </div>
  );
};

// Propiedades por defecto
ExportFormPDF.defaultProps = {
  initialConfig: {},
  showPreview: true,
  showEstimation: true,
  className: "",
  disabled: false,
  loading: false,
};
