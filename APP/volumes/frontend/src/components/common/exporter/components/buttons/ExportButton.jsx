// src/export/components/buttons/ExportButton.jsx
// Botón de exportación para un formato específico

import { useState } from "react";
import { useQuickExport } from "../../useExport.js";
// (Opcional) descomenta si usas PropTypes
// import PropTypes from "prop-types";

/* Helpers de normalización y seguridad */
const normalizeFormat = (fmt) =>
  typeof fmt === "string" ? fmt.trim().toLowerCase() : "";

const toUpperSafe = (fmt) =>
  typeof fmt === "string" ? fmt.toUpperCase() : String(fmt ?? "").toUpperCase();

/**
 * Componente de botón para exportar en un formato específico
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Componente de botón
 */
export const ExportButton = ({
  // Props principales
  format,
  data,
  config = {},

  // Props de UI
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading,

  // Props de funcionalidad
  showProgress = true,
  showTooltip = true,
  confirmBeforeExport = false,
  estimateSize = false,

  // Callbacks
  onExportStart,
  onExportComplete,
  onExportError,

  // Props de estilos
  className = "",
  style = {},

  // Props HTML del botón
  ...buttonProps
}) => {
  // Estados locales
  const [showConfirm, setShowConfirm] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState(null);

  // Normalizar formato y validar soporte básico
  const fmt = normalizeFormat(format);
  const fmtLabel = toUpperSafe(fmt || "formato");
  const formatProvided = Boolean(fmt);

  // Hook de exportación rápida (usar formato normalizado)
  const {
    export: exportData,
    isExporting,
    lastResult,
    progress,
    canExport,
  } = useQuickExport(fmt, {
    onExportStart: (exportInfo) => {
      onExportStart?.(exportInfo);
    },
    onExportComplete: (result) => {
      onExportComplete?.(result);
      if (estimateSize) setEstimatedSize(null);
    },
    onExportError: (error, errorResult) => {
      onExportError?.(error, errorResult);
      if (estimateSize) setEstimatedSize(null);
    },
  });

  // Determinar estado de loading / disabled
  const isLoading = loading !== undefined ? loading : isExporting;
  const isDisabled = disabled || !canExport || isLoading || !formatProvided;

  /**
   * Maneja el click del botón
   */
  const handleClick = async () => {
    if (isDisabled || !data) return;

    try {
      // Estimar tamaño si está habilitado (placeholder)
      if (estimateSize && !estimatedSize) {
        // Implementar si se requiere
      }

      // Mostrar confirmación si está habilitada
      if (confirmBeforeExport) {
        setShowConfirm(true);
        return;
      }

      // Ejecutar exportación
      await executeExport();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error en exportación:", error);
    }
  };

  /**
   * Ejecuta la exportación
   */
  const executeExport = async () => {
    try {
      await exportData(data, config);
      setShowConfirm(false);
    } catch {
      // Error ya manejado por el hook
      setShowConfirm(false);
    }
  };

  /**
   * Cancela la confirmación
   */
  const cancelExport = () => setShowConfirm(false);

  /**
   * Genera el contenido del botón
   */
  const getButtonContent = () => {
    if (children) return children;

    const formatName = fmtLabel;

    if (isLoading) {
      return (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-transparent border-t-current border-r-current rounded-full animate-spin"></div>
          {showProgress && progress?.message
            ? progress.message
            : `Exportando ${formatName}...`}
        </span>
      );
    }

    return `Exportar ${formatName}`;
  };

  /**
   * Genera las clases CSS del botón usando Tailwind
   */
  const getButtonClasses = () => {
    const baseClasses = [
      // Clases base del botón
      "export-button", // para estilos de accesibilidad inyectados abajo
      "btn-base",
      "relative",
      "overflow-hidden",
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

    // Estado hover / cursor
    if (isLoading) {
      baseClasses.push("cursor-wait");
    } else if (!isDisabled) {
      baseClasses.push("hover-lift");
    }

    // Estados de éxito/error de la última exportación
    if (lastResult?.success === true) {
      baseClasses.push("bg-success-500", "hover:bg-success-600", "text-white");
    } else if (lastResult?.success === false) {
      baseClasses.push("bg-danger-500", "hover:bg-danger-600", "text-white");
    } else {
      // Variantes normales
      switch (variant) {
        case "secondary":
          baseClasses.push(
            "bg-secondary-100",
            "dark:bg-secondary-800",
            "text-secondary-900",
            "dark:text-secondary-100",
            "border",
            "border-secondary-200",
            "dark:border-secondary-700",
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
            "hover:text-white",
            "dark:hover:text-white"
          );
          break;
        case "primary":
        default:
          // Colores específicos por formato (usar formato normalizado)
          switch (fmt) {
            case "csv":
              baseClasses.push(
                "bg-success-600",
                "hover:bg-success-700",
                "text-white"
              );
              break;
            case "json":
              baseClasses.push(
                "bg-purple-600",
                "hover:bg-purple-700",
                "text-white"
              );
              break;
            case "excel":
              baseClasses.push(
                "bg-green-600",
                "hover:bg-green-700",
                "text-white"
              );
              break;
            case "pdf":
              baseClasses.push("bg-red-600", "hover:bg-red-700", "text-white");
              break;
            case "txt":
              baseClasses.push(
                "bg-secondary-600",
                "hover:bg-secondary-700",
                "text-white"
              );
              break;
            default:
              baseClasses.push(
                "bg-primary-600",
                "hover:bg-primary-700",
                "text-white"
              );
          }
      }
    }

    // Clases adicionales
    if (className) baseClasses.push(className);

    return baseClasses.join(" ");
  };

  /**
   * Genera el tooltip
   */
  const getTooltipText = () => {
    if (!showTooltip) return undefined;

    if (!formatProvided) {
      return "Debe indicar un formato de exportación (csv, json, excel, pdf, txt).";
    }

    if (isDisabled && !canExport) {
      return "Sistema de exportación no disponible";
    }

    if (isDisabled && !data) {
      return "No hay datos para exportar";
    }

    if (isLoading) {
      return progress?.message || `Exportando en formato ${fmtLabel}...`;
    }

    if (lastResult?.success === false) {
      return `Error en última exportación: ${lastResult.error}`;
    }

    if (lastResult?.success === true) {
      return `Última exportación exitosa (${new Date(
        lastResult.timestamp
      ).toLocaleString()})`;
    }

    return `Exportar datos en formato ${fmtLabel}`;
  };

  // Renderizar modal de confirmación si está habilitado
  const renderConfirmModal = () => {
    if (!showConfirm) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal">
        <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 max-w-sm w-[90%] mx-4 shadow-modal animate-scale-in">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
              Confirmar Exportación
            </h3>
          </div>

          <div className="mb-6">
            <p className="text-secondary-700 dark:text-secondary-300 mb-3">
              ¿Está seguro que desea exportar los datos en formato {fmtLabel}?
            </p>

            {estimatedSize && (
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-2">
                Tamaño estimado: {formatFileSize(estimatedSize)}
              </p>
            )}

            {data && (
              <div className="bg-secondary-50 dark:bg-secondary-700 rounded-md p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-secondary-600 dark:text-secondary-400">
                    Registros:
                  </span>
                  <span className="font-medium text-secondary-900 dark:text-secondary-100">
                    {Array.isArray(data.data) ? data.data.length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600 dark:text-secondary-400">
                    Columnas:
                  </span>
                  <span className="font-medium text-secondary-900 dark:text-secondary-100">
                    {data.columns ? data.columns.length : "Auto-detectadas"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-300 bg-secondary-100 dark:bg-secondary-700 hover:bg-secondary-200 dark:hover:bg-secondary-600 rounded-md transition-colors focus-ring"
              onClick={cancelExport}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus-ring"
              onClick={executeExport}
            >
              Exportar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className={getButtonClasses()}
        onClick={handleClick}
        disabled={isDisabled}
        title={getTooltipText()}
        style={style}
        {...buttonProps}
      >
        {getButtonContent()}
      </button>

      {renderConfirmModal()}
    </>
  );
};

/**
 * Formatea el tamaño de archivo para mostrar
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado
 */
const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k))
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Propiedades por defecto (fallbacks)
ExportButton.defaultProps = {
  variant: "primary",
  size: "medium",
  disabled: false,
  showProgress: true,
  showTooltip: true,
  confirmBeforeExport: false,
  estimateSize: false,
  config: {},
  className: "",
  style: {},
};

// (Opcional) Tipado de props con PropTypes
// ExportButton.propTypes = {
//   format: PropTypes.oneOf(["csv", "json", "excel", "pdf", "txt"]).isRequired,
//   data: PropTypes.object,
//   config: PropTypes.object,
//   children: PropTypes.node,
//   variant: PropTypes.oneOf(["primary", "secondary", "outline"]),
//   size: PropTypes.oneOf(["small", "medium", "large"]),
//   disabled: PropTypes.bool,
//   loading: PropTypes.bool,
//   showProgress: PropTypes.bool,
//   showTooltip: PropTypes.bool,
//   confirmBeforeExport: PropTypes.bool,
//   estimateSize: PropTypes.bool,
//   onExportStart: PropTypes.func,
//   onExportComplete: PropTypes.func,
//   onExportError: PropTypes.func,
//   className: PropTypes.string,
//   style: PropTypes.object,
// };

// Inyectar estilos adicionales si no están en Tailwind (opcional)
if (
  typeof document !== "undefined" &&
  !document.getElementById("export-button-focus-styles")
) {
  const styleSheet = document.createElement("style");
  styleSheet.id = "export-button-focus-styles";
  styleSheet.textContent = `
    /* Estilos adicionales para mejor accesibilidad */
    .export-button:focus-visible {
      outline: 2px solid theme('colors.primary.500');
      outline-offset: 2px;
    }

    /* Animación suave para el hover-lift */
    @media (prefers-reduced-motion: no-preference) {
      .hover-lift {
        transform: translateZ(0);
      }
    }

    /* Mejoras específicas para dark mode */
    @media (prefers-color-scheme: dark) {
      .export-button:focus-visible {
        outline-color: theme('colors.primary.400');
      }
    }
  `;
  document.head.appendChild(styleSheet);
}
