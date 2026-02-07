import React from "react";
import cn from "@/utils/cn";

/**
 * Botón de acción reutilizable
 *
 * Props:
 * - label: string
 * - onClick: function
 * - variant: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'
 * - icon: ReactNode (opcional)
 * - size: 'sm' | 'md' | 'lg'
 * - className: string (opcional)
 * - disabled: boolean
 * - type: 'button' | 'submit' | 'reset'
 */
const VARIANTS = {
    primary:
        "bg-primary-700/80 hover:bg-primary-700 text-white focus-visible:ring-primary-700/35",
    success:
        "bg-success-700/80 hover:bg-success-700 text-white focus-visible:ring-success-700/35",
    danger:
        "bg-error-700/80 hover:bg-error-700 text-white focus-visible:ring-error-700/35",
    warning:
        "bg-warm-700/80 hover:bg-warm-700 text-white focus-visible:ring-warm-700/35",
    info:
        "bg-info-700/80 hover:bg-info-700 text-white focus-visible:ring-info-700/35",
    neutral:
        "bg-secondary-200 hover:bg-secondary-300 text-gray-900 dark:bg-secondary-700/80 dark:hover:bg-secondary-700 dark:text-gray-100 focus-visible:ring-white/15",
    soft:
        "border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800/40 text-gray-800 dark:text-gray-100 focus-visible:ring-white/15",
};



const SIZES = {
    xs: "px-4 py-2 text-sm",
    sm: "px-3 py-2 text-sm",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-3.5 text-base",
};

export default function ActionButton({
    label,
    onClick,
    variant = "primary",
    size = "md",
    icon = null,
    className,
    disabled = false,
    type = "button",
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold",
                "cursor-pointer",
                "shadow-button hover:shadow-button-hover",
                "transition-all duration-150 ease-out",
                "transform hover:scale-[1.03] active:scale-[0.99]",
                "focus-visible:outline-none focus-visible:ring-4",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-button",
                VARIANTS[variant],
                SIZES[size],
                className
            )}
        >
            {icon ? (
                <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                    {icon}
                </span>
            ) : null}
            <span className="whitespace-nowrap">{label}</span>
        </button>
    );
}
