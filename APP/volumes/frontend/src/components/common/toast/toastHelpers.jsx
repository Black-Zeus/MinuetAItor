import React from "react";
import { toast, Bounce } from "react-toastify";
import ToastMessage from "./ToastMessage";

const DEFAULT_AUTOCLOSE_MS = 3000;

export const BASE_TOAST_OPTIONS = Object.freeze({
  position: "bottom-right",
  autoClose: DEFAULT_AUTOCLOSE_MS,
  hideProgressBar: false,
  closeOnClick: false,

  // Evita que el toast quede "congelado" si el cursor queda encima
  pauseOnHover: false,
  pauseOnFocusLoss: false,

  draggable: false,
  progress: undefined,
  theme: "dark",
  transition: Bounce,
});

/**
 * Compat layer:
 * - duration (react-hot-toast) -> autoClose (react-toastify)
 */
const withBase = (opts = {}) => {
  const merged = { ...BASE_TOAST_OPTIONS, ...opts };

  // ✅ compat hot-toast
  if (typeof merged.duration === "number") {
    merged.autoClose = merged.duration;
    delete merged.duration;
  }

  // ✅ por seguridad
  if (merged.autoClose == null) merged.autoClose = DEFAULT_AUTOCLOSE_MS;
  if (merged.autoClose === false) merged.autoClose = DEFAULT_AUTOCLOSE_MS;

  return merged;
};

const renderMsg = (variant, title, message) => (
  <ToastMessage title={title} message={message} variant={variant} />
);

// ✅ API final que vas a usar
export const toastSuccess = (title, message, opts = {}) =>
  toast.success(renderMsg("success", title, message), withBase(opts));

export const toastInfo = (title, message, opts = {}) =>
  toast.info(renderMsg("info", title, message), withBase(opts));

export const toastWarn = (title, message, opts = {}) =>
  toast.warn(renderMsg("warning", title, message), withBase(opts));

export const toastError = (title, message, opts = {}) =>
  toast.error(renderMsg("error", title, message), withBase(opts));

export const toastDefault = (title, message, opts = {}) =>
  toast(renderMsg("default", title, message), withBase(opts));