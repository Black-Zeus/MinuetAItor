// src/export/components/buttons/ExportDropdown.jsx
// Componente dropdown para seleccionar y exportar múltiples formatos

import { useState, useRef, useEffect, useCallback } from "react";
import { useExport } from "../../useExport.js";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

/**
 * Componente dropdown para exportación múltiple
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Componente dropdown de exportación
 */
export const ExportDropdown = ({
  // Props principales
  data,
  config = {},

  // Props de configuración
  enabledFormats = "json,csv,excel,pdf,txt", // String separado por comas o array
  showIcons = true,
  showDescriptions = true,
  showEstimatedSize = false,

  // Props de UI
  variant = "primary",
  size = "medium",
  disabled = false,
  placeholder = "Exportar datos",

  // Props de comportamiento
  closeOnExport = true,
  showProgress = true,
  groupByType = false,

  // Callbacks
  onExport,
  onExportComplete,
  onExportError,
  onFormatSelect,

  // Props de estilos
  className = "",
  dropdownClassName = "",
  buttonClassName = "",

  // Props adicionales
  maxHeight = "320px",
  position = "bottom-left",

  ...buttonProps
}) => {
  // Estados del dropdown
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredFormat, setHoveredFormat] = useState(null);
  const [estimatedSizes, setEstimatedSizes] = useState({});

  // Referencias
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Parsear formatos habilitados
  const parsedFormats =
    typeof enabledFormats === "string"
      ? enabledFormats.split(",").map((f) => f.trim())
      : enabledFormats;

  // Hook de exportación
  const {
    exportData,
    availableFormats,
    isExporting,
    exportProgress,
    lastExportResult,
    estimateFileSize,
    canExport,
  } = useExport({
    enabledFormats: parsedFormats,
    showProgress,
    onExportStart: (exportInfo) => {
      if (closeOnExport) {
        setIsOpen(false);
      }
    },
    onExportComplete: (result) => {
      if (onExportComplete) {
        onExportComplete(result);
      }
      if (onExport) {
        onExport(result);
      }
    },
    onExportError: (error, result) => {
      if (onExportError) {
        onExportError(error, result);
      }
    },
  });

  /**
   * Información visual de formatos
   */
  const formatInfo = {
    json: {
      icon: "{}",
      name: "JSON",
      description: "Formato de intercambio de datos JavaScript",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "hover:bg-purple-50 dark:hover:bg-purple-900/20",
    },
    csv: {
      icon: "📊",
      name: "CSV",
      description: "Valores separados por comas para Excel",
      color: "text-green-600 dark:text-green-400",
      bgColor: "hover:bg-green-50 dark:hover:bg-green-900/20",
    },
    excel: {
      icon: "📗",
      name: "Excel",
      description: "Hoja de cálculo Microsoft Excel",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
    },
    pdf: {
      icon: "📄",
      name: "PDF",
      description: "Documento PDF con formato profesional",
      color: "text-red-600 dark:text-red-400",
      bgColor: "hover:bg-red-50 dark:hover:bg-red-900/20",
    },
    txt: {
      icon: "📝",
      name: "TXT",
      description: "Archivo de texto plano",
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "hover:bg-gray-50 dark:hover:bg-gray-900/20",
    },
  };

  /**
   * Grupos de formatos si está habilitado
   */
  const formatGroups = {
    "Datos Estructurados": ["json", "csv", "excel"],
    Documentos: ["pdf", "txt"],
  };

  /**
   * Maneja clics fuera del dropdown
   */
  const handleClickOutside = useCallback((event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target)
    ) {
      setIsOpen(false);
    }
  }, []);

  /**
   * Maneja la tecla Escape
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    },
    [isOpen]
  );

  /**
   * Toggle del dropdown
   */
  const toggleDropdown = useCallback(() => {
    if (disabled || !canExport) return;
    setIsOpen((prev) => !prev);
  }, [disabled, canExport]);

  /**
   * Maneja la selección de formato
   */
  const handleFormatSelect = useCallback(
    async (format) => {
      if (isExporting || !data) return;

      try {
        if (onFormatSelect) {
          onFormatSelect(format);
        }

        await exportData(format, data, config);
      } catch (error) {
        console.error("Error en exportación:", error);
      }
    },
    [isExporting, data, config, exportData, onFormatSelect]
  );

  /**
   * Estima tamaños de archivo si está habilitado
   */
  const estimateAllSizes = useCallback(async () => {
    if (!showEstimatedSize || !data) return;

    const sizes = {};
    const formats = availableFormats.filter((f) =>
      parsedFormats.includes(f.key)
    );

    for (const format of formats) {
      try {
        const size = await estimateFileSize(format.key, data, config);
        sizes[format.key] = size;
      } catch (error) {
        sizes[format.key] = null;
      }
    }

    setEstimatedSizes(sizes);
  }, [
    showEstimatedSize,
    data,
    config,
    availableFormats,
    parsedFormats,
    estimateFileSize,
  ]);

  /**
   * Formatea el tamaño de archivo
   */
  const formatFileSize = useCallback((bytes) => {
    if (!bytes) return null;

    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)}${sizes[i]}`;
  }, []);

  /**
   * Obtiene las clases del botón principal
   */
  const getButtonClasses = () => {
    const baseClasses = [
      "btn-base",
      "relative",
      "flex",
      "items-center",
      "gap-2",
      "disabled:opacity-50",
      "disabled:cursor-not-allowed",
    ];

    // Tamaño
    switch (size) {
      case "small":
        baseClasses.push("btn-sm");
        break;
      case "large":
        baseClasses.push("btn-lg");
        break;
      default:
        baseClasses.push("btn-md");
    }

    // Variante
    switch (variant) {
      case "secondary":
        baseClasses.push(
          "bg-secondary-100",
          "dark:bg-secondary-800",
          "text-secondary-900",
          "dark:text-secondary-100",
          "border",
          "border-secondary-300",
          "dark:border-secondary-600",
          "hover:bg-secondary-200",
          "dark:hover:bg-secondary-700"
        );
        break;
      case "outline":
        baseClasses.push(
          "bg-transparent",
          "text-primary-600",
          "dark:text-primary-400",
          "border-2",
          "border-primary-600",
          "dark:border-primary-400",
          "hover:bg-primary-600",
          "dark:hover:bg-primary-500",
          "hover:text-white"
        );
        break;
      case "primary":
      default:
        baseClasses.push(
          "bg-primary-600",
          "hover:bg-primary-700",
          "text-white"
        );
    }

    // Estado de carga
    if (isExporting) {
      baseClasses.push("cursor-wait");
    }

    // Clases adicionales
    if (buttonClassName) {
      baseClasses.push(buttonClassName);
    }

    return baseClasses.join(" ");
  };

  /**
   * Obtiene las clases del dropdown
   */
  const getDropdownClasses = () => {
    const baseClasses = [
      "absolute",
      "z-dropdown",
      "mt-1",
      "w-80",
      "bg-white",
      "dark:bg-secondary-800",
      "border",
      "border-secondary-200",
      "dark:border-secondary-700",
      "rounded-lg",
      "shadow-dropdown",
      "py-2",
      "animate-scale-in",
    ];

    // Posición
    switch (position) {
      case "bottom-right":
        baseClasses.push("right-0");
        break;
      case "top-left":
        baseClasses.push("bottom-full", "mb-1", "left-0");
        break;
      case "top-right":
        baseClasses.push("bottom-full", "mb-1", "right-0");
        break;
      case "bottom-left":
      default:
        baseClasses.push("left-0");
    }

    if (dropdownClassName) {
      baseClasses.push(dropdownClassName);
    }

    return baseClasses.join(" ");
  };

  /**
   * Renderiza los elementos del dropdown
   */
  const renderDropdownItems = () => {
    const formats = availableFormats.filter(
      (format) => parsedFormats.includes(format.key) && format.available
    );

    if (formats.length === 0) {
      return (
        <div className="px-4 py-3 text-sm text-secondary-500 dark:text-secondary-400 text-center">
          No hay formatos disponibles
        </div>
      );
    }

    if (groupByType) {
      return Object.entries(formatGroups).map(([groupName, groupFormats]) => {
        const groupItems = formats.filter((f) => groupFormats.includes(f.key));
        if (groupItems.length === 0) return null;

        return (
          <div key={groupName}>
            <div className="px-4 py-2 text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wide border-t border-secondary-200 dark:border-secondary-700 first:border-t-0">
              {groupName}
            </div>
            {groupItems.map((format) => renderFormatItem(format))}
          </div>
        );
      });
    } else {
      return formats.map((format) => renderFormatItem(format));
    }
  };

  /**
   * Renderiza un elemento individual del formato
   */
  const renderFormatItem = (format) => {
    const info = formatInfo[format.key] || {};
    const estimatedSize = estimatedSizes[format.key];
    const isHovered = hoveredFormat === format.key;

    return (
      <button
        key={format.key}
        type="button"
        onClick={() => handleFormatSelect(format.key)}
        onMouseEnter={() => setHoveredFormat(format.key)}
        onMouseLeave={() => setHoveredFormat(null)}
        disabled={isExporting}
        className={`w-full px-4 py-3 text-left transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
          ${info.bgColor || "hover:bg-secondary-50 dark:hover:bg-secondary-700"}
          ${isHovered ? "bg-secondary-50 dark:bg-secondary-700" : ""}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Icono */}
          {showIcons && (
            <div className="text-lg flex-shrink-0 mt-0.5">{info.icon}</div>
          )}

          {/* Contenido principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span
                className={`font-medium ${
                  info.color || "text-secondary-900 dark:text-secondary-100"
                }`}
              >
                {info.name || format.key.toUpperCase()}
              </span>

              {/* Tamaño estimado */}
              {showEstimatedSize && estimatedSize && (
                <span className="text-xs text-secondary-500 dark:text-secondary-400 font-mono">
                  {formatFileSize(estimatedSize)}
                </span>
              )}
            </div>

            {/* Descripción */}
            {showDescriptions && info.description && (
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                {info.description}
              </p>
            )}

            {/* Características del formato */}
            <div className="flex items-center gap-2 mt-2">
              {format.features?.supportsMetadata && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                  Metadata
                </span>
              )}
              {format.features?.supportsMultiSheet && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                  Multi-hoja
                </span>
              )}
              {format.features?.supportsFormatting && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                  Formato
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  // Efectos
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      // Estimar tamaños si está habilitado
      if (showEstimatedSize) {
        estimateAllSizes();
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [
    isOpen,
    handleClickOutside,
    handleKeyDown,
    estimateAllSizes,
    showEstimatedSize,
  ]);

  // Limpiar hover al cerrar
  useEffect(() => {
    if (!isOpen) {
      setHoveredFormat(null);
    }
  }, [isOpen]);

  return (
    <div className={`export-dropdown relative inline-block ${className}`}>
      {/* Botón principal */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        disabled={disabled || !canExport}
        className={getButtonClasses()}
        aria-haspopup="true"
        aria-expanded={isOpen}
        {...buttonProps}
      >
        {/* Contenido del botón */}
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
            <span>Exportando...</span>
          </>
        ) : (
          <>
            <span>{placeholder}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={getDropdownClasses()}
          style={{ maxHeight }}
        >
          <div className="overflow-y-auto">
            {/* Header del dropdown */}
            <div className="px-4 py-2 border-b border-secondary-200 dark:border-secondary-700">
              <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                Seleccionar formato
              </p>
              {data && (
                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                  {Array.isArray(data.data) ? data.data.length : 0} registros
                </p>
              )}
            </div>

            {/* Items del dropdown */}
            <div className="py-1">{renderDropdownItems()}</div>

            {/* Footer con progreso si está exportando */}
            {isExporting && showProgress && exportProgress && (
              <div className="border-t border-secondary-200 dark:border-secondary-700 p-3">
                <ExportProgress
                  progress={exportProgress}
                  variant="minimal"
                  size="small"
                  showMessage={true}
                  showIcon={false}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay para cerrar en mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-modal-backdrop bg-black bg-opacity-0 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Propiedades por defecto
ExportDropdown.defaultProps = {
  config: {},
  enabledFormats: "json,csv,excel,pdf,txt",
  showIcons: true,
  showDescriptions: true,
  showEstimatedSize: false,
  variant: "primary",
  size: "medium",
  disabled: false,
  placeholder: "Exportar datos",
  closeOnExport: true,
  showProgress: true,
  groupByType: false,
  className: "",
  dropdownClassName: "",
  buttonClassName: "",
  maxHeight: "320px",
  position: "bottom-left",
};
