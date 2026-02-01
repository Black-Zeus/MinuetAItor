// src/export/components/utils/ExportProgress.jsx
// Componente para mostrar progreso de exportación

import { useState, useEffect } from "react";

/**
 * Componente de progreso de exportación
 * @param {object} props - Propiedades del componente
 * @returns {JSX.Element} Componente de progreso
 */
export const ExportProgress = ({
  // Props principales
  progress,
  isVisible = true,

  // Props de UI
  variant = "default",
  size = "medium",
  showMessage = true,
  showPercentage = false,
  showIcon = true,
  showDuration = false,

  // Props de comportamiento
  autoHide = true,
  autoHideDelay = 3000,
  animateProgress = true,

  // Props de estilos
  className = "",
  style = {},

  // Callbacks
  onComplete,
  onError,
  onCancel,

  // Props de formato personalizado
  formatMessage,
  formatDuration,
}) => {
  // Estados locales
  const [isAnimating, setIsAnimating] = useState(false);
  const [duration, setDuration] = useState(0);
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Efecto para controlar visibilidad y auto-hide
  useEffect(() => {
    if (isVisible && progress) {
      setShouldRender(true);
      setIsAnimating(true);

      // Calcular duración si el progreso tiene timestamp de inicio
      if (progress.startTime) {
        const timer = setInterval(() => {
          setDuration(Date.now() - progress.startTime);
        }, 100);

        return () => clearInterval(timer);
      }
    } else if (!isVisible && autoHide) {
      // Auto-hide después del delay
      const hideTimer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimating(false);
      }, autoHideDelay);

      return () => clearTimeout(hideTimer);
    }
  }, [isVisible, progress, autoHide, autoHideDelay]);

  // Efecto para animación de progreso
  useEffect(() => {
    if (progress?.percentage !== undefined && animateProgress) {
      let animationFrame;
      const targetProgress = progress.percentage;

      const animate = () => {
        setAnimationProgress((current) => {
          const diff = targetProgress - current;
          if (Math.abs(diff) < 0.5) {
            return targetProgress;
          }
          return current + diff * 0.1;
        });

        if (Math.abs(animationProgress - targetProgress) > 0.5) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animate();

      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
      };
    }
  }, [progress?.percentage, animateProgress, animationProgress]);

  // Efecto para callbacks
  useEffect(() => {
    if (progress?.status === "completed" && onComplete) {
      onComplete(progress);
    } else if (progress?.status === "error" && onError) {
      onError(progress);
    } else if (progress?.status === "cancelled" && onCancel) {
      onCancel(progress);
    }
  }, [progress?.status, onComplete, onError, onCancel]);

  // No renderizar si no debe mostrarse
  if (!shouldRender || !progress) {
    return null;
  }

  /**
   * Obtiene el icono según el estado
   */
  const getStatusIcon = () => {
    if (!showIcon) return null;

    const iconClasses = `w-5 h-5 flex-shrink-0`;

    switch (progress.status) {
      case "starting":
      case "preparing":
      case "validating":
      case "exporting":
        return (
          <div className={`${iconClasses} text-primary-500`}>
            <div className="w-full h-full border-2 border-transparent border-t-current border-r-current rounded-full animate-spin"></div>
          </div>
        );

      case "completed":
        return (
          <svg
            className={`${iconClasses} text-success-500`}
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
        );

      case "error":
        return (
          <svg
            className={`${iconClasses} text-danger-500`}
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
        );

      case "cancelled":
        return (
          <svg
            className={`${iconClasses} text-warning-500`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );

      default:
        return (
          <svg
            className={`${iconClasses} text-info-500`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  /**
   * Obtiene el mensaje formateado
   */
  const getFormattedMessage = () => {
    if (formatMessage && typeof formatMessage === "function") {
      return formatMessage(progress);
    }

    return progress.message || getDefaultMessage();
  };

  /**
   * Obtiene el mensaje por defecto según el estado
   */
  const getDefaultMessage = () => {
    switch (progress.status) {
      case "starting":
        return "Iniciando exportación...";
      case "preparing":
        return "Preparando datos...";
      case "validating":
        return "Validando información...";
      case "exporting":
        return "Generando archivo...";
      case "completed":
        return "¡Exportación completada!";
      case "error":
        return "Error en la exportación";
      case "cancelled":
        return "Exportación cancelada";
      default:
        return "Procesando...";
    }
  };

  /**
   * Obtiene la duración formateada
   */
  const getFormattedDuration = () => {
    if (formatDuration && typeof formatDuration === "function") {
      return formatDuration(duration);
    }

    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
    } else {
      return `${seconds}s`;
    }
  };

  /**
   * Obtiene las clases del contenedor principal
   */
  const getContainerClasses = () => {
    const baseClasses = [
      "export-progress",
      "transition-all",
      "duration-300",
      "ease-gentle",
    ];

    // Tamaño
    switch (size) {
      case "small":
        baseClasses.push("p-3", "text-sm");
        break;
      case "large":
        baseClasses.push("p-6", "text-base");
        break;
      default:
        baseClasses.push("p-4", "text-sm");
    }

    // Variante
    switch (variant) {
      case "minimal":
        baseClasses.push("bg-transparent", "border-0");
        break;
      case "card":
        baseClasses.push("card-base", "shadow-card");
        break;
      case "toast":
        baseClasses.push(
          "bg-white",
          "dark:bg-secondary-800",
          "border",
          "border-secondary-200",
          "dark:border-secondary-700",
          "rounded-lg",
          "shadow-dropdown",
          "animate-toast-enter"
        );
        break;
      case "inline":
        baseClasses.push(
          "bg-secondary-50",
          "dark:bg-secondary-800",
          "border",
          "border-secondary-200",
          "dark:border-secondary-700",
          "rounded-md"
        );
        break;
      default:
        baseClasses.push(
          "bg-white",
          "dark:bg-secondary-800",
          "border",
          "border-secondary-200",
          "dark:border-secondary-700",
          "rounded-lg",
          "shadow-card"
        );
    }

    // Estado de animación
    if (isAnimating) {
      baseClasses.push("animate-fade-in");
    }

    // Clases adicionales
    if (className) {
      baseClasses.push(className);
    }

    return baseClasses.join(" ");
  };

  /**
   * Obtiene las clases de la barra de progreso
   */
  const getProgressBarClasses = () => {
    const baseClasses = [
      "h-2",
      "rounded-full",
      "overflow-hidden",
      "transition-all",
      "duration-300",
    ];

    // Color según estado
    switch (progress.status) {
      case "completed":
        baseClasses.push("bg-success-100", "dark:bg-success-900");
        break;
      case "error":
        baseClasses.push("bg-danger-100", "dark:bg-danger-900");
        break;
      case "cancelled":
        baseClasses.push("bg-warning-100", "dark:bg-warning-900");
        break;
      default:
        baseClasses.push("bg-primary-100", "dark:bg-primary-900");
    }

    return baseClasses.join(" ");
  };

  /**
   * Obtiene las clases del relleno de la barra de progreso
   */
  const getProgressFillClasses = () => {
    const baseClasses = [
      "h-full",
      "rounded-full",
      "transition-all",
      "duration-500",
      "ease-out",
    ];

    // Color según estado
    switch (progress.status) {
      case "completed":
        baseClasses.push("bg-success-500");
        break;
      case "error":
        baseClasses.push("bg-danger-500");
        break;
      case "cancelled":
        baseClasses.push("bg-warning-500");
        break;
      default:
        baseClasses.push("bg-primary-500");
    }

    // Animación si está en progreso
    if (
      ["starting", "preparing", "validating", "exporting"].includes(
        progress.status
      )
    ) {
      baseClasses.push("animate-pulse");
    }

    return baseClasses.join(" ");
  };

  // Calcular porcentaje para la barra de progreso
  const getProgressPercentage = () => {
    if (progress.percentage !== undefined) {
      return animateProgress ? animationProgress : progress.percentage;
    }

    // Porcentajes por defecto según el estado
    switch (progress.status) {
      case "starting":
        return 10;
      case "preparing":
        return 25;
      case "validating":
        return 50;
      case "exporting":
        return 75;
      case "completed":
        return 100;
      case "error":
      case "cancelled":
        return 0;
      default:
        return 0;
    }
  };

  return (
    <div className={getContainerClasses()} style={style}>
      {/* Contenido principal */}
      <div className="flex items-center gap-3">
        {getStatusIcon()}

        <div className="flex-1 min-w-0">
          {/* Mensaje principal */}
          {showMessage && (
            <div className="flex items-center justify-between mb-1">
              <p className="text-secondary-900 dark:text-secondary-100 font-medium truncate">
                {getFormattedMessage()}
              </p>

              {/* Porcentaje y duración */}
              <div className="flex items-center gap-2 text-xs text-secondary-500 dark:text-secondary-400 ml-2">
                {showPercentage && progress.percentage !== undefined && (
                  <span className="font-mono">
                    {Math.round(
                      animateProgress ? animationProgress : progress.percentage
                    )}
                    %
                  </span>
                )}

                {showDuration && duration > 0 && (
                  <span className="font-mono">{getFormattedDuration()}</span>
                )}
              </div>
            </div>
          )}

          {/* Barra de progreso */}
          <div className={getProgressBarClasses()}>
            <div
              className={getProgressFillClasses()}
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, getProgressPercentage())
                )}%`,
              }}
            />
          </div>

          {/* Mensaje detallado */}
          {progress.details && (
            <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 truncate">
              {progress.details}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Propiedades por defecto
ExportProgress.defaultProps = {
  isVisible: true,
  variant: "default",
  size: "medium",
  showMessage: true,
  showPercentage: false,
  showIcon: true,
  showDuration: false,
  autoHide: true,
  autoHideDelay: 3000,
  animateProgress: true,
  className: "",
  style: {},
};

/**
 * Componente simplificado para progreso inline
 */
export const ExportProgressInline = (props) => {
  return (
    <ExportProgress
      {...props}
      variant="inline"
      size="small"
      showDuration={false}
      autoHide={false}
    />
  );
};

/**
 * Componente para progreso como toast/notificación
 */
export const ExportProgressToast = (props) => {
  return (
    <ExportProgress
      {...props}
      variant="toast"
      showDuration={true}
      autoHide={true}
      autoHideDelay={5000}
    />
  );
};

/**
 * Componente para progreso minimal (solo barra)
 */
export const ExportProgressBar = (props) => {
  return (
    <ExportProgress
      {...props}
      variant="minimal"
      showMessage={false}
      showIcon={false}
      showPercentage={true}
    />
  );
};
