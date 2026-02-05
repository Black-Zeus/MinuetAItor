import React from "react";
import KpiBadge from "./KpiBadge";
import { TXT_BODY, TXT_TITLE } from "./Dashboard";

const CARD_FRAME =
  "border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5";

/**
 * ✅ Variantes literales (Tailwind JIT safe)
 */
const KPI_VARIANTS = {
  primary: {
    iconWrap: "bg-primary-50 dark:bg-primary-900/20",
    icon: "text-primary-600 dark:text-primary-300",
  },
  warm: {
    iconWrap: "bg-warm-50 dark:bg-warm-900/20",
    icon: "text-warm-600 dark:text-warm-300",
  },
  info: {
    iconWrap: "bg-info-50 dark:bg-info-900/20",
    icon: "text-info-600 dark:text-info-300",
  },
};

const MetricCard = ({ icon: Icon, title, value, change, isNew, variant = "primary" }) => {
  const v = KPI_VARIANTS[variant] ?? KPI_VARIANTS.primary;

  return (
    <div className={`bg-surface shadow-card p-6 hover:shadow-card-hover transition-theme ${CARD_FRAME} rounded-2xl`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl transition-theme ${v.iconWrap}`}>
          <Icon className={`w-8 h-8 ${v.icon}`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-4xl font-bold ${TXT_TITLE} transition-theme`}>{value}</h3>
          </div>

          <p className={`text-sm ${TXT_BODY} mb-2 transition-theme`}>{title}</p>

          <KpiBadge variant={variant} isNew={isNew} change={change} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
