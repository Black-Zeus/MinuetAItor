import { Toaster } from "react-hot-toast";

/**
 * ToasterManager
 * Monta el <Toaster/> con configuración global, z-index alto
 * y clases por defecto coherentes con tu paleta y dark mode.
 * VERSIÓN CORREGIDA: Fondos más sólidos y mejor contraste
 */
export default function ToasterManager() {
  return (
    <Toaster
      position="top-right"
      gutter={8}
      containerStyle={{ zIndex: 1100 }} // por encima de popovers/tooltips
      toastOptions={{
        duration: 4000,
        // Para toasts "built-in" (no custom)
        className:
          // base neutra + animaciones de tu Tailwind
          "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
          "bg-surface-light dark:bg-surface-dark " +
          "text-secondary-900 dark:text-secondary-50 " +
          "border border-border-light dark:border-border-dark " +
          "shadow-lg rounded-card",
        // Variantes built-in con FONDOS SÓLIDOS
        success: {
          className:
            "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
            "!bg-success-100 dark:!bg-success-800 " + // Más sólido: 100 en lugar de 50, 800 en lugar de 900/20
            "text-success-800 dark:text-success-100 " + // Mejor contraste
            "border border-success-400 dark:border-success-600 " + // Bordes más visibles
            "shadow-lg rounded-card",
        },
        error: {
          className:
            "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
            "!bg-danger-100 dark:!bg-danger-800 " + // Más sólido
            "text-danger-800 dark:text-danger-100 " + // Mejor contraste
            "border border-danger-400 dark:border-danger-600 " + // Bordes más visibles
            "shadow-lg rounded-card",
        },
        loading: {
          className:
            "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
            "!bg-info-100 dark:!bg-info-800 " + // Más sólido
            "text-info-800 dark:text-info-100 " + // Mejor contraste
            "border border-info-400 dark:border-info-600 " + // Bordes más visibles
            "shadow-lg rounded-card",
        },
        // Accesibilidad
        ariaProps: { role: "status", "aria-live": "polite" },
      }}
    />
  );
}
