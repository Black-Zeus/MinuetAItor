// src/components/toast/toastHelpers.js
// Versión básica que usa toasts built-in de react-hot-toast
import toast from "react-hot-toast";

// Usar toasts básicos en lugar de componente personalizado
export const showErrorToast = (message, title = "Error", opts = {}) => {
    return toast.error(message, { duration: 4000, ...opts });
};

export const showSuccessToast = (message, title = "Éxito", opts = {}) => {
    return toast.success(message, { duration: 4000, ...opts });
};

export const showInfoToast = (message, title = "Información", opts = {}) => {
    return toast(message, { 
        duration: 4000, 
        icon: 'ℹ️',
        ...opts 
    });
};

export const showWarningToast = (message, title = "Advertencia", opts = {}) => {
    return toast(message, { 
        duration: 4000, 
        icon: '⚠️',
        ...opts 
    });
};