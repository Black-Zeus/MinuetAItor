import React from "react";

import Icon from "@/components/ui/icon/iconManager";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-500 dark:text-gray-400";

const CollapsibleSection = ({
  title,
  subtitle,
  icon,
  count,
  isOpen,
  onToggle,
  children,
  className = "",
}) => {
  const ChevronIcon = isOpen ? "FaChevronUp" : "FaChevronDown";

  return (
    <section
      className={[
        "rounded-xl border border-gray-200 bg-white transition-theme dark:border-gray-700 dark:bg-gray-800",
        className,
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between gap-4
          px-5 py-4
          hover:bg-gray-50 dark:hover:bg-gray-700/40
          rounded-xl
          transition-theme
        "
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <Icon name={icon} className={`${TXT_META} h-5 w-5`} />
          </div>

          <div className="min-w-0 text-left">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className={`truncate text-base font-semibold ${TXT_TITLE} transition-theme`}>
                {title}
              </h3>

              {Number.isFinite(count) ? (
                <span
                  className="
                    px-2 py-0.5 rounded-full text-xs font-medium
                    bg-gray-100 dark:bg-gray-700
                    text-gray-700 dark:text-gray-200
                    flex-shrink-0
                  "
                  title="Cantidad"
                >
                  {count}
                </span>
              ) : null}
            </div>

            {subtitle ? <p className={`${TXT_META} truncate text-sm`}>{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`${TXT_META} text-xs`}>{isOpen ? "Ocultar" : "Mostrar"}</span>
          <Icon name={ChevronIcon} className={`${TXT_META} h-4 w-4`} />
        </div>
      </button>

      {isOpen ? <div className="px-5 pb-5 pt-1">{children}</div> : null}
    </section>
  );
};

export default CollapsibleSection;
