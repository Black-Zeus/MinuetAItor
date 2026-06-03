import React from "react";
import Icon from "@/components/ui/icon/iconManager";

export const cn = (...classes) => classes.filter(Boolean).join(" ");

export const EMPTY_VALUE = (
  <span className="italic text-gray-400 dark:text-gray-500">Sin información</span>
);

export const fieldClass = (hasError = false) =>
  cn(
    "w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
    "bg-white dark:bg-slate-800",
    "text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
    "focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800",
    hasError
      ? "border-red-400 dark:border-red-500"
      : "border-gray-300 dark:border-slate-700/80"
  );

export const Section = ({ title, description, children }) => (
  <section className="space-y-4">
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      {description ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
    </div>
    <div>{children}</div>
  </section>
);

export const Field = ({ label, hint, error, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {hint ? <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span> : null}
    </div>
    {children}
    {error ? <p className="text-sm text-red-500">{error}</p> : null}
  </div>
);

export const ReadValue = ({ value, multiline = false }) => {
  const normalized = typeof value === "string" ? value.trim() : value;
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-gray-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-gray-200",
        multiline ? "whitespace-pre-line" : "break-words"
      )}
    >
      {normalized || EMPTY_VALUE}
    </div>
  );
};

export const SummaryItem = ({ label, value, multiline = false, className = "" }) => {
  const normalized = typeof value === "string" ? value.trim() : value;
  return (
    <div
      className={cn(
        "border-b border-slate-200/70 pb-4 dark:border-slate-800/90",
        multiline ? "min-h-[96px]" : "min-h-[72px]",
        className
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-[15px] text-gray-800 dark:text-gray-200",
          multiline ? "whitespace-pre-line break-words" : "break-words"
        )}
      >
        {normalized || EMPTY_VALUE}
      </div>
    </div>
  );
};

export const StepItem = ({ index, currentStep, title, onClick }) => {
  const isActive = index === currentStep;
  const isDone = index < currentStep;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-w-0 items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold leading-none",
          isDone
            ? "border-sky-700 bg-sky-700 text-white dark:border-sky-300 dark:bg-sky-300 dark:text-slate-900"
            : isActive
              ? "border-slate-500 bg-slate-500 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900"
              : "border-gray-300 bg-white/80 text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-gray-400"
        )}
      >
        {isDone ? <Icon name="FaCheckCircle" className="h-3.5 w-3.5" /> : index + 1}
      </div>
      <span
        className={cn(
          "min-w-0 text-sm leading-tight",
          isActive ? "font-semibold text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
        )}
      >
        {title}
      </span>
    </button>
  );
};

export const ToggleCard = ({ title, description, checked, isView, onToggle }) => (
  <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-4 dark:border-slate-700/80 dark:bg-slate-900/50">
    <div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{title}</div>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</div>
    </div>

    {isView ? (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          checked
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
        )}
      >
        {checked ? "Activo" : "Inactivo"}
      </span>
    ) : (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
        )}
      >
        <div
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    )}
  </div>
);

export const EntityLogoBadge = ({
  logoUrl,
  name,
  fallbackIcon,
  logoFailed,
  onLogoError,
  className = "h-14 w-14 rounded-2xl",
  iconClassName = "h-6 w-6",
  altText = "Logo",
}) => (
  <div
    className={cn(
      "flex items-center justify-center overflow-hidden bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300",
      className
    )}
  >
    {logoUrl && !logoFailed ? (
      <img
        src={logoUrl}
        alt={name ? `${altText} de ${name}` : altText}
        className="h-full w-full object-cover"
        onError={onLogoError}
      />
    ) : (
      <Icon name={fallbackIcon} className={iconClassName} />
    )}
  </div>
);

export const SummaryLogoItem = ({
  logoUrl,
  name,
  fallbackIcon,
  logoFailed,
  onLogoError,
  label = "Logo",
  altText = "Logo",
}) => (
  <div className="min-h-[72px] border-b border-slate-200/70 pb-4 dark:border-slate-800/90">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
      {label}
    </div>
    <div className="mt-3">
      <EntityLogoBadge
        logoUrl={logoUrl}
        name={name}
        fallbackIcon={fallbackIcon}
        logoFailed={logoFailed}
        onLogoError={onLogoError}
        className="h-12 w-12 rounded-xl"
        iconClassName="h-5 w-5"
        altText={altText}
      />
    </div>
  </div>
);
