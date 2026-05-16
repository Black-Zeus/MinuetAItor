import React from "react";
import { FaArrowDown, FaArrowUp } from "react-icons/fa";

const KPI_BADGE_VARIANTS = {
  primary: {
    badge: "bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-200",
    arrow: "text-success-700 dark:text-success-200",
  },
  warm: {
    badge: "bg-warm-50 dark:bg-warm-900/20 text-warm-700 dark:text-warm-200",
    arrow: "text-warm-700 dark:text-warm-200",
  },
  info: {
    badge: "bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-200",
    arrow: "text-info-700 dark:text-info-200",
  },
};

const KpiBadge = ({ variant = "primary", isNew, change, className = "" }) => {
  const v = KPI_BADGE_VARIANTS[variant] ?? KPI_BADGE_VARIANTS.primary;
  const numericChange = Number(change) || 0;
  const ChangeIcon = numericChange === 0 ? null : numericChange < 0 ? FaArrowDown : FaArrowUp;
  const formattedChange = Math.abs(numericChange);

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-2xl transition-theme ${v.badge} ${className}`}
    >
      {ChangeIcon && <ChangeIcon className={`w-3 h-3 ${v.arrow}`} />}
      {isNew
        ? `${formattedChange} nuevos este mes`
        : numericChange === 0
          ? "Sin cambios vs mes anterior"
          : `${formattedChange}% vs mes anterior`}
    </span>
  );
};

export default KpiBadge;
