import { Toaster } from "react-hot-toast";

/**
 * ToasterManager
 * Monta el <Toaster/> con configuración global, z-index alto
 * y clases por defecto coherentes con tu paleta y dark mode.
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
                    "bg-white dark:bg-gray-800 " +
                    "text-gray-900 dark:text-gray-50 " +
                    "border border-gray-200 dark:border-gray-700 " +
                    "shadow-lg rounded-lg",
                // Variantes built-in (success/error/loading) por si en algún punto las usas
                success: {
                    className:
                        "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
                        "bg-green-50 dark:bg-green-900/20 " +
                        "text-green-700 dark:text-green-200 " +
                        "border border-green-300 dark:border-green-700 " +
                        "shadow-lg rounded-lg",
                },
                error: {
                    className:
                        "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
                        "bg-red-50 dark:bg-red-900/20 " +
                        "text-red-700 dark:text-red-200 " +
                        "border border-red-300 dark:border-red-700 " +
                        "shadow-lg rounded-lg",
                },
                loading: {
                    className:
                        "animate-toast-enter data-[swipe=end]:animate-toast-leave " +
                        "bg-blue-50 dark:bg-blue-900/20 " +
                        "text-blue-700 dark:text-blue-200 " +
                        "border border-blue-300 dark:border-blue-700 " +
                        "shadow-lg rounded-lg",
                },
                // Accesibilidad
                ariaProps: { role: "status", "aria-live": "polite" },
            }}
        />
    );
}