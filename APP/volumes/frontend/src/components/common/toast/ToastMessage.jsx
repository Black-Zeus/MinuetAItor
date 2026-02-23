import React from "react";
import { Icon } from "@/components/ui/icon/iconManager";

const VARIANT_STYLES = {
  success: {
    icon: "checkCircle",
    iconClass: "text-success-300",
    titleClass: "text-white",
  },
  info: {
    icon: "circleInfo",
    iconClass: "text-info-300",
    titleClass: "text-white",
  },
  warning: {
    icon: "triangleExclamation",
    iconClass: "text-warning-300",
    titleClass: "text-white",
  },
  error: {
    icon: "xCircle",
    iconClass: "text-danger-300",
    titleClass: "text-white",
  },
  default: {
    icon: "bell",
    iconClass: "text-secondary-200",
    titleClass: "text-white",
  },
};

export default function ToastMessage({ title, message, variant = "default" }) {
  const cfg = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;

  return (
    <div className="flex gap-3 items-start">
      <div className="shrink-0 pt-0.5" aria-hidden="true">
        <Icon name={cfg.icon} className={"w-4 h-4 " + cfg.iconClass} />
      </div>

      <div className="min-w-0">
        {title ? (
          <div className={"font-semibold text-sm " + cfg.titleClass}>{title}</div>
        ) : null}

        {message ? (
          <div className="text-sm text-white/85 break-words">{message}</div>
        ) : null}
      </div>
    </div>
  );
}