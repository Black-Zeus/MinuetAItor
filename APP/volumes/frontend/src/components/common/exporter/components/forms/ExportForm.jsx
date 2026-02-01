// src/export/components/forms/ExportForm.jsx
// Formulario principal que unifica todos los formularios específicos por formato

import { useState, useCallback, useEffect } from "react";
import { useConfigurableExport } from "../../useExport.js";
import { ExportProgress } from "../../utils/ExportProgress.jsx";

// Importar formularios específicos
import { ExportFormJSON } from "./ExportFormJSON.jsx";
import { ExportFormCSV } from "./ExportFormCSV.jsx";
import { ExportFormExcel } from "./ExportFormExcel.jsx";
import { ExportFormPDF } from "./ExportFormPDF.jsx";
import { ExportFormTXT } from "./ExportFormTXT.jsx";

/**
 * Formulario principal de configuración de exportación
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Formulario principal de exportación
 */
export const ExportForm = ({
  // Props principales
  data,
  initialFormat = "json",
  initialConfig = {},

  // Props de comportamiento
  showFormatSelector = true,
  enabledFormats = ["json", "csv", "excel", "pdf", "txt"],
  showPreview = true,
  showEstimation = true,

  // Callbacks principales
  onExport,
  onCancel,
  onFormatChange,
  onConfigChange,

  // Props de UI
  className = "",
  disabled = false,
  title = "Configurar Exportación",

  // Props adicionales
  allowFormatChange = true,
  showProgress = true,
  autoSubmit = false,
}) => {
  // Hook de exportación configurable
  const exportHook = useConfigurableExport({
    enabledFormats,
    showProgress,
    onExportStart: (info) => {
      console.info("Exportación iniciada:", info);
    },
    onExportComplete: (result) => {
      console.info("Exportación completada:", result);
      if (onExport) {
        onExport(result);
      }
    },
    onExportError: (error, result) => {
      console.error("Error en exportación:", error);
      setExportError(error.message);
    },
  });

  // Estados locales
  const [selectedFormat, setSelectedFormat] = useState(initialFormat);
  const [currentConfig, setCurrentConfig] = useState(initialConfig);
  const [exportError, setExportError] = useState(null);
  const [isFormValid, setIsFormValid] = useState(true);

  /**
   * Mapeo de formatos a componentes
   */
  const formatComponents = {
    json: ExportFormJSON,
    csv: ExportFormCSV,
    excel: ExportFormExcel,
    pdf: ExportFormPDF,
    txt: ExportFormTXT,
  };

  /**
   * Información de formatos con iconos y colores
   */
  const formatInfo = {
    json: {
      name: "JSON",
      icon: "{}",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900",
      description: "Estructura de datos JavaScript",
    },
    csv: {
      name: "CSV",
      icon: "📊",
      color: "text-success-600 dark:text-success-400",
      bgColor: "bg-success-100 dark:bg-success-900",
      description: "Valores separados por comas",
    },
    excel: {
      name: "Excel",
      icon: "📗",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900",
      description: "Hoja de cálculo Microsoft Excel",
    },
    pdf: {
      name: "PDF",
      icon: "📄",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900",
      description: "Documento portátil PDF",
    },
    txt: {
      name: "TXT",
      icon: "📝",
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-100 dark:bg-gray-900",
      description: "Archivo de texto plano",
    },
  };

  /**
   * Maneja el cambio de formato
   */
  const handleFormatChange = useCallback(
    (newFormat) => {
      if (!allowFormatChange || newFormat === selectedFormat) return;

      setSelectedFormat(newFormat);
      setCurrentConfig({}); // Reset config cuando cambia el formato
      setExportError(null);

      if (onFormatChange) {
        onFormatChange(newFormat);
      }
    },
    [selectedFormat, allowFormatChange, onFormatChange]
  );

  /**
   * Maneja cambios en la configuración
   */
  const handleConfigChange = useCallback(
    (newConfig) => {
      setCurrentConfig(newConfig);
      setExportError(null);

      if (onConfigChange) {
        onConfigChange(newConfig, selectedFormat);
      }
    },
    [selectedFormat, onConfigChange]
  );

  /**
   * Maneja la exportación
   */
  const handleExport = useCallback(
    async (config = currentConfig) => {
      if (!data || !isFormValid) return;

      try {
        setExportError(null);
        await exportHook.exportData(selectedFormat, data, config);
      } catch (error) {
        setExportError(error.message);
      }
    },
    [data, selectedFormat, currentConfig, isFormValid, exportHook]
  );

  /**
   * Maneja la cancelación
   */
  const handleCancel = useCallback(() => {
    if (exportHook.isExporting) {
      exportHook.cancelExport();
    }

    if (onCancel) {
      onCancel();
    }
  }, [exportHook, onCancel]);

  /**
   * Renderiza el selector de formato
   */
  const renderFormatSelector = () => {
    if (!showFormatSelector) return null;

    const availableFormats = exportHook.availableFormats.filter((format) =>
      enabledFormats.includes(format.key)
    );

    return (
      <div className="mb-6">
        <h4 className="text-md font-medium text-secondary-800 dark:text-secondary-200 mb-3">
          Seleccionar Formato
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {availableFormats.map((format) => {
            const info = formatInfo[format.key] || {};
            const isSelected = selectedFormat === format.key;

            return (
              <button
                key={format.key}
                type="button"
                onClick={() => handleFormatChange(format.key)}
                disabled={
                  disabled || exportHook.isExporting || !allowFormatChange
                }
                className={`p-3 rounded-lg border-2 text-center transition-all duration-200
                  ${
                    isSelected
                      ? `border-primary-500 ${info.bgColor} ${info.color}`
                      : "border-secondary-200 dark:border-secondary-700 hover:border-secondary-300 dark:hover:border-secondary-600 bg-white dark:bg-secondary-800"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:shadow-sm
                `}
              >
                <div className="text-2xl mb-1">{info.icon}</div>
                <div className="text-sm font-medium">{info.name}</div>
                <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                  {info.description}
                </div>
                {isSelected && (
                  <div className="mt-2">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mx-auto"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * Renderiza el formulario específico del formato
   */
  const renderFormatForm = () => {
    const FormComponent = formatComponents[selectedFormat];

    if (!FormComponent) {
      return (
        <div className="text-center py-8">
          <div className="text-secondary-500 dark:text-secondary-400">
            Formato no soportado: {selectedFormat}
          </div>
        </div>
      );
    }

    return (
      <FormComponent
        data={data}
        initialConfig={currentConfig}
        showPreview={showPreview}
        showEstimation={showEstimation}
        onConfigChange={handleConfigChange}
        onExport={handleExport}
        onCancel={handleCancel}
        disabled={disabled}
        loading={exportHook.isExporting}
        exportHook={exportHook}
      />
    );
  };

  /**
   * Renderiza mensajes de error
   */
  const renderErrorMessage = () => {
    if (!exportError) return null;

    return (
      <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h5 className="text-sm font-medium text-danger-800 dark:text-danger-200">
              Error en la exportación
            </h5>
            <p className="text-sm text-danger-700 dark:text-danger-300 mt-1">
              {exportError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-danger-400 hover:text-danger-600 ml-auto"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renderiza información del estado del sistema
   */
  const renderSystemStatus = () => {
    if (exportHook.systemReady) return null;

    return (
      <div className="mb-4 p-4 bg-warning-50 dark:bg-warning-900 border border-warning-200 dark:border-warning-700 rounded-lg">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-warning-500 flex-shrink-0"
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
          <div>
            <p className="text-sm font-medium text-warning-800 dark:text-warning-200">
              Sistema de exportación inicializándose...
            </p>
            <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
              Cargando formatos disponibles y dependencias
            </p>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renderiza estadísticas rápidas de los datos
   */
  const renderDataStats = () => {
    if (!data || !data.data || !Array.isArray(data.data)) return null;

    return (
      <div className="mb-4 bg-secondary-50 dark:bg-secondary-800 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary-600 dark:text-secondary-400">
            Datos a exportar:
          </span>
          <div className="flex items-center gap-4 text-secondary-900 dark:text-secondary-100">
            <span className="font-mono">{data.data.length} registros</span>
            <span className="font-mono">
              {data.columns
                ? data.columns.length
                : Object.keys(data.data[0] || {}).length}{" "}
              columnas
            </span>
          </div>
        </div>

        {data.metadata?.title && (
          <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
            Dataset: {data.metadata.title}
          </div>
        )}
      </div>
    );
  };

  // Efecto para auto-submit si está habilitado
  useEffect(() => {
    if (autoSubmit && data && isFormValid && !exportHook.isExporting) {
      const timer = setTimeout(() => {
        handleExport();
      }, 1000); // Delay de 1 segundo para permitir configuración

      return () => clearTimeout(timer);
    }
  }, [autoSubmit, data, isFormValid, exportHook.isExporting, handleExport]);

  // Efecto para sincronizar el formato inicial
  useEffect(() => {
    if (initialFormat && initialFormat !== selectedFormat) {
      setSelectedFormat(initialFormat);
    }
  }, [initialFormat]);

  return (
    <div className={`export-form max-w-4xl mx-auto ${className}`}>
      {/* Título principal */}
      {title && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
            {title}
          </h2>
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
            Seleccione el formato y configure las opciones de exportación
          </p>
        </div>
      )}

      {/* Estado del sistema */}
      {renderSystemStatus()}

      {/* Estadísticas de datos */}
      {renderDataStats()}

      {/* Mensajes de error */}
      {renderErrorMessage()}

      {/* Selector de formato */}
      {renderFormatSelector()}

      {/* Progreso global si está exportando */}
      {exportHook.isExporting && showProgress && exportHook.progress && (
        <div className="mb-6">
          <ExportProgress
            progress={exportHook.progress}
            variant="card"
            showDuration={true}
            showPercentage={true}
          />
        </div>
      )}

      {/* Formulario específico del formato */}
      <div className="bg-white dark:bg-secondary-900 rounded-lg border border-secondary-200 dark:border-secondary-700 shadow-sm">
        {renderFormatForm()}
      </div>

      {/* Información adicional */}
      {exportHook.lastExportResult && (
        <div className="mt-4 text-center">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm
            ${
              exportHook.lastExportResult.success
                ? "bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-300"
                : "bg-danger-100 dark:bg-danger-900 text-danger-700 dark:text-danger-300"
            }`}
          >
            {exportHook.lastExportResult.success ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Exportación completada exitosamente
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Error en la exportación
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Propiedades por defecto
ExportForm.defaultProps = {
  initialFormat: "json",
  initialConfig: {},
  showFormatSelector: true,
  enabledFormats: ["json", "csv", "excel", "pdf", "txt"],
  showPreview: true,
  showEstimation: true,
  className: "",
  disabled: false,
  title: "Configurar Exportación",
  allowFormatChange: true,
  showProgress: true,
  autoSubmit: false,
};
