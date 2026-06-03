import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import { formatNullableDateTime as formatDateTime } from "@/utils/formats";

const LABEL = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
const ERR = "mt-1 text-xs text-red-500";

const VALIDATION_LABELS = {
  unvalidated: "Sin validar",
  valid: "Validación correcta",
  error: "Validación con error",
  auth_error: "Error de autenticación",
  connection_error: "Error de conexión",
  timeout: "Timeout",
  endpoint_unavailable: "Endpoint no disponible",
};

const VALIDATION_TONES = {
  unvalidated:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
  valid:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
  error:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
  auth_error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
  connection_error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
  timeout:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
  endpoint_unavailable:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
};

const VALIDATION_ICONS = {
  unvalidated: "FaClock",
  valid: "FaCheckCircle",
  error: "triangleExclamation",
  auth_error: "FaLock",
  connection_error: "triangleExclamation",
  timeout: "FaClock",
  endpoint_unavailable: "triangleExclamation",
};

export const Field = ({ label, required = false, error, hint, className = "", children }) => (
  <div className={className}>
    <label className={LABEL}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    {error ? <p className={ERR}>{error}</p> : null}
  </div>
);

export const CheckboxField = ({ label, checked, onChange, disabled = false, hint = null }) => (
  <div>
    <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer dark:border-gray-700 dark:bg-slate-900/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
    </label>
    {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
  </div>
);

export const ValidationStatusCard = ({ status, message, lastValidatedAt }) => {
  const tone = VALIDATION_TONES[status] ?? VALIDATION_TONES.unvalidated;
  const icon = VALIDATION_ICONS[status] ?? VALIDATION_ICONS.unvalidated;
  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{VALIDATION_LABELS[status] ?? VALIDATION_LABELS.unvalidated}</p>
          <p className="mt-1 text-sm">{message}</p>
          <p className="mt-2 text-xs opacity-80">Última validación: {formatDateTime(lastValidatedAt)}</p>
        </div>
      </div>
    </div>
  );
};

export const ValidationSummaryGrid = ({ items }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    {items.map(([label, value]) => (
      <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-slate-900/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{value}</p>
      </div>
    ))}
  </div>
);

export const MetadataCard = ({ createdAt, lastValidatedAt }) => (
  <div className="rounded-2xl border border-gray-200 bg-white/70 px-5 py-4 dark:border-gray-700 dark:bg-slate-900/60">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fecha registro</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{formatDateTime(createdAt)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Última validación</p>
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{formatDateTime(lastValidatedAt)}</p>
      </div>
    </div>
  </div>
);
