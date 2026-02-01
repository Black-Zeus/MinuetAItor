// @/utils/cn.js

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function para combinar classNames con Tailwind CSS
 * Usa clsx para manejar condicionales y twMerge para resolver conflictos de Tailwind
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Export por defecto también
export default cn;