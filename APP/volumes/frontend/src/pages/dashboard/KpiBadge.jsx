import React from "react";
import { FaArrowUp } from "react-icons/fa";

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

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-2xl transition-theme ${v.badge} ${className}`}
    >
      <FaArrowUp className={`w-3 h-3 ${v.arrow}`} />
      {isNew ? `${change} nuevos este mes` : `${change}% vs mes anterior`}
    </span>
  );
};

export default KpiBadge;
