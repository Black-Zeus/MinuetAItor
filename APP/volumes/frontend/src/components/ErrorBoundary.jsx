/**
 * components/ErrorBoundary.jsx
 * Error Boundary para capturar errores de React
 * UI de fallback con diseño en columnas - Adaptado a Tailwind personalizado
 */

import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showStackTrace: false,
      showComponentStack: false,
    };
  }

  static getDerivedStateFromError(error) {
    const errorId = `error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log detallado para desarrollo
    const errorDetails = {
      id: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.group(`🔴 ERROR BOUNDARY [${this.state.errorId}]`);
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Full Details:", errorDetails);
    console.groupEnd();

    // Aquí podrías enviar a un servicio de logging
    // this.logErrorToService(errorDetails);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showStackTrace: false,
      showComponentStack: false,
    });
  };

  copyErrorDetails = () => {
    const errorDetails = {
      id: this.state.errorId,
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    navigator.clipboard
      .writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => alert("Detalles del error copiados al portapapeles"))
      .catch(() => console.error("Error al copiar al portapapeles"));
  };

  getErrorSeverity = () => {
    const errorMessage = this.state.error?.message?.toLowerCase() || "";

    if (errorMessage.includes("chunk") || errorMessage.includes("loading")) {
      return {
        level: "warning",
        colorClass: "bg-amber-500 dark:bg-amber-600",
        gradientClass: "from-amber-400 to-amber-600",
        icon: "⚠️",
      };
    }
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return {
        level: "network",
        colorClass: "bg-blue-600 dark:bg-blue-700",
        gradientClass: "from-blue-500 to-blue-700",
        icon: "🌐",
      };
    }
    // ROJO FUERTE Y CLARO PARA ERRORES CRÍTICOS
    return {
      level: "critical",
      colorClass: "bg-red-700 dark:bg-red-800",
      gradientClass: "from-red-600 to-red-800",
      icon: "🔴",
    };
  };

  getQuickFix = () => {
    const errorMessage = this.state.error?.message?.toLowerCase() || "";

    if (errorMessage.includes("chunk") || errorMessage.includes("loading")) {
      return "Posible problema de caché. Intenta recargar la página.";
    }
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "Problema de conexión. Verifica tu internet y vuelve a intentar.";
    }
    if (errorMessage.includes("undefined") && errorMessage.includes("map")) {
      return "Datos no cargados correctamente. Verifica la respuesta de la API.";
    }
    if (errorMessage.includes("not a function")) {
      return "Función no definida. Verifica las props o imports del componente.";
    }
    return "Error general. Revisa el stack trace para más detalles.";
  };

  render() {
    if (this.state.hasError) {
      const severity = this.getErrorSeverity();
      const quickFix = this.getQuickFix();

      return (
        <div className="h-screen bg-gradient-to-br from-background-light to-background via-background-warm-light dark:from-background-dark dark:to-secondary-800 dark:via-secondary-900 flex items-center justify-center p-container-padding">
          <div className="bg-background-card-light dark:bg-background-card-dark shadow-modal rounded-3xl max-w-7xl w-full h-[96vh] my-[2vh] overflow-hidden border border-border dark:border-border-dark transition-smooth flex flex-col">
            {/* Header con severidad */}
            <div
              className={`${severity.colorClass} px-6 py-4 text-white relative overflow-hidden`}
            >
              {/* Gradiente de fondo dinámico */}
              <div className="absolute inset-0 opacity-40">
                <div
                  className={`w-full h-full bg-gradient-to-r ${severity.gradientClass}`}
                ></div>
              </div>

              {/* Patrón adicional para más impacto visual */}
              <div className="absolute inset-0 opacity-10">
                <div className="w-full h-full bg-gradient-to-br from-transparent via-white/20 to-transparent"></div>
              </div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl animate-gentle-pulse">
                    {severity.icon}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-shadow">
                      Error Detectado
                    </h1>
                    <p className="text-sm opacity-90 font-mono">
                      ID: {this.state.errorId}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90 font-medium">
                    Severidad: {severity.level.toUpperCase()}
                  </p>
                  <p className="text-xs opacity-75 font-mono">
                    {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido principal en columnas */}
            <div className="flex flex-col lg:flex-row flex-1">
              {/* COLUMNA IZQUIERDA - Información Base */}
              <div className="lg:w-2/5 flex flex-col bg-background-warm-light dark:bg-secondary-800/50 border-r border-border dark:border-border-dark">
                {/* Contenido principal con altura fija */}
                <div
                  className="flex-1 p-6"
                  style={{ height: "400px", overflowY: "auto" }}
                >
                  {/* Diagnóstico rápido */}
                  <div className="state-info border-l-4 border-info-500 p-4 mb-6 rounded-r-lg transition-smooth hover-lift">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <span className="text-info-500 text-lg animate-breathe">
                          💡
                        </span>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-info-800 dark:text-info-300">
                          Diagnóstico Rápido
                        </h3>
                        <p className="mt-1 text-sm text-info-700 dark:text-info-400 text-pretty">
                          {quickFix}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Error principal */}
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-text dark:text-text-dark mb-3 flex items-center">
                      <span className="mr-2 text-danger-500">🚨</span>
                      Error Principal
                    </h2>
                    <div className="state-danger rounded-lg p-4 transition-smooth">
                      <pre className="text-sm text-danger-800 dark:text-danger-300 whitespace-pre-wrap font-mono text-balance">
                        {this.state.error?.toString()}
                      </pre>
                    </div>
                  </div>

                  {/* Información del sistema */}
                  <div className="space-y-3">
                    <h3 className="text-md font-semibold text-text dark:text-text-dark flex items-center">
                      <span className="mr-2">⚙️</span>
                      Información del Sistema
                    </h3>

                    <div className="space-y-3 text-sm bg-background dark:bg-secondary-700 rounded-lg p-4 transition-smooth">
                      <div className="flex-between">
                        <span className="text-text-muted-light dark:text-text-muted-dark">
                          Timestamp:
                        </span>
                        <span className="text-text dark:text-text-dark font-mono text-xs">
                          {new Date().toISOString()}
                        </span>
                      </div>

                      <div className="flex-between">
                        <span className="text-text-muted-light dark:text-text-muted-dark">
                          URL:
                        </span>
                        <span className="text-text dark:text-text-dark font-mono text-xs truncate max-w-48">
                          {window.location.pathname}
                        </span>
                      </div>

                      <div className="flex-between">
                        <span className="text-text-muted-light dark:text-text-muted-dark">
                          User Agent:
                        </span>
                        <span className="text-text dark:text-text-dark font-mono text-xs truncate max-w-48">
                          {navigator.userAgent.split(" ")[0]}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fila de botones fija horizontal - Sin título */}
                <div className="px-6 py-4 border-t border-border dark:border-border-dark bg-background-light dark:bg-secondary-800">
                  <div className="flex space-x-3">
                    <button
                      onClick={this.handleReset}
                      className="flex-1 bg-success-600 hover:bg-success-700 text-white font-medium py-3 px-4 rounded-lg transition-natural hover-lift focus-ring flex items-center justify-center space-x-2 shadow-button hover:shadow-button-hover"
                    >
                      <span className="animate-spin-slow">🔄</span>
                      <span>Reintentar</span>
                    </button>

                    <button
                      onClick={this.handleReload}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-natural hover-lift focus-ring flex items-center justify-center space-x-2 shadow-button hover:shadow-button-hover"
                    >
                      <span>↻</span>
                      <span>Recargar página</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA - Detalles Técnicos */}
              <div className="lg:w-3/5 flex flex-col bg-background dark:bg-secondary-900">
                {/* Título de sección */}
                <div className="p-6 pb-4">
                  <h3 className="text-lg font-semibold text-text dark:text-text-dark flex items-center">
                    <span className="mr-2">🔍</span>
                    Detalles Técnicos
                  </h3>
                  <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">
                    Información detallada para debugging
                  </p>
                </div>

                {/* Área de contenido expandible con altura fija */}
                <div
                  className="flex-1 px-6 overflow-y-auto"
                  style={{ height: "400px" }}
                >
                  <div className="h-full flex flex-col">
                    {/* SECCIÓN 1 - Stack Trace */}
                    <div
                      className={
                        this.state.showStackTrace
                          ? "flex-1 flex flex-col"
                          : "flex-shrink-0"
                      }
                    >
                      <button
                        onClick={() => {
                          this.setState({
                            showStackTrace: !this.state.showStackTrace,
                            showComponentStack: this.state.showStackTrace
                              ? this.state.showComponentStack
                              : false,
                          });
                        }}
                        className="flex items-center justify-between w-full text-text-secondary-light dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark transition-natural group focus-ring rounded-md px-2 py-2 mb-3"
                      >
                        <div className="flex items-center space-x-2">
                          <svg
                            className={`w-4 h-4 transition-transform duration-300 ${
                              this.state.showStackTrace ? "rotate-90" : ""
                            } group-hover:scale-110`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-medium flex items-center">
                            <span className="mr-2">🔍</span>
                            Stack Trace
                          </span>
                        </div>
                        <span className="text-xs bg-secondary-200 dark:bg-secondary-700 px-2 py-1 rounded-full">
                          {this.state.showStackTrace ? "Ocultar" : "Mostrar"}
                        </span>
                      </button>

                      {this.state.showStackTrace && (
                        <div className="animate-fade-in flex-1">
                          <div className="bg-secondary-900 dark:bg-secondary-800 rounded-lg p-4 h-full overflow-auto border border-border-strong-light dark:border-border-strong-dark scrollbar-custom shadow-soft">
                            <pre className="text-xs text-success-400 dark:text-success-300 font-mono whitespace-pre-wrap">
                              {this.state.error?.stack ||
                                "No stack trace available"}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Espaciado entre secciones */}
                    {!this.state.showStackTrace &&
                      !this.state.showComponentStack && (
                        <div className="h-6"></div>
                      )}

                    {/* SECCIÓN 2 - Component Stack */}
                    <div
                      className={
                        this.state.showComponentStack
                          ? "flex-1 flex flex-col"
                          : "flex-shrink-0"
                      }
                    >
                      <button
                        onClick={() => {
                          this.setState({
                            showComponentStack: !this.state.showComponentStack,
                            showStackTrace: this.state.showComponentStack
                              ? this.state.showStackTrace
                              : false,
                          });
                        }}
                        className="flex items-center justify-between w-full text-text-secondary-light dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark transition-natural group focus-ring rounded-md px-2 py-2 mb-3"
                      >
                        <div className="flex items-center space-x-2">
                          <svg
                            className={`w-4 h-4 transition-transform duration-300 ${
                              this.state.showComponentStack ? "rotate-90" : ""
                            } group-hover:scale-110`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-medium flex items-center">
                            <span className="mr-2">🏗️</span>
                            Component Stack
                          </span>
                        </div>
                        <span className="text-xs bg-secondary-200 dark:bg-secondary-700 px-2 py-1 rounded-full">
                          {this.state.showComponentStack
                            ? "Ocultar"
                            : "Mostrar"}
                        </span>
                      </button>

                      {this.state.showComponentStack && (
                        <div className="animate-fade-in flex-1">
                          <div className="bg-secondary-900 dark:bg-secondary-800 rounded-lg p-4 h-full overflow-auto border border-border-strong-light dark:border-border-strong-dark scrollbar-custom shadow-soft">
                            <pre className="text-xs text-warning-400 dark:text-warning-300 font-mono whitespace-pre-wrap">
                              {this.state.errorInfo?.componentStack ||
                                "No component stack available"}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fila de botones fija horizontal antes del footer */}
                <div className="px-6 py-4 border-t border-border dark:border-border-dark bg-background-light dark:bg-secondary-800">
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={this.copyErrorDetails}
                      className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-natural hover-lift focus-ring flex items-center space-x-2 shadow-button hover:shadow-button-hover"
                    >
                      <span>📋</span>
                      <span>Copiar detalles</span>
                    </button>

                    <button
                      onClick={() =>
                        window.open(
                          `mailto:dev@tuapp.com?subject=Error Report [${
                            this.state.errorId
                          }]&body=Error ID: ${
                            this.state.errorId
                          }%0A%0AError: ${encodeURIComponent(
                            this.state.error?.toString() || ""
                          )}`
                        )
                      }
                      className="invisible bg-warm-600 hover:bg-warm-700 text-white font-medium py-2 px-4 rounded-lg transition-natural hover-lift hover-warm focus-ring-warm flex items-center space-x-2 shadow-button hover:shadow-button-hover"
                    >
                      <span className="animate-gentle-pulse">📧</span>
                      <span>Reportar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con información adicional */}
            <div className="px-6 py-3 bg-background-secondary-light dark:bg-secondary-800/30 border-t border-border dark:border-border-dark">
              <div className="flex-between text-xs text-text-muted-light dark:text-text-muted-dark">
                <span className="flex items-center space-x-1">
                  <span>🛡️</span>
                  <span>ErrorBoundary</span>
                  {import.meta.env.VITE_FRONTEND_NAME && (
                    <>
                      <span className="text-text-muted-light dark:text-text-muted-dark">
                        •
                      </span>
                      <span className="font-medium">
                        <span className="uppercase">Sistema: </span>
                        <span className=" text-warm-600 dark:text-warm-400">
                          {import.meta.env.VITE_FRONTEND_NAME}
                        </span>
                      </span>
                    </>
                  )}
                  {import.meta.env.VITE_FRONTEND_VERSION && (
                    <>
                      <span className="text-text-muted-light dark:text-text-muted-dark">
                        •
                      </span>
                      <span className="font-medium">
                        <span className="uppercase">Version: </span>
                        <span className=" text-primary-600 dark:text-primary-400">
                          {import.meta.env.VITE_FRONTEND_VERSION}
                        </span>
                      </span>
                    </>
                  )}
                  {import.meta.env.VITE_FRONTEND_ENV && (
                    <>
                      <span className="text-text-muted-light dark:text-text-muted-dark">
                        •
                      </span>
                      <span className="font-medium">
                        <span className="uppercase">Entorno: </span>
                        <span className=" text-info-600 dark:text-info-400">
                          {import.meta.env.VITE_FRONTEND_ENV}
                        </span>
                      </span>
                    </>
                  )}
                </span>
                <span className="font-mono">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
