import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-600 dark:text-gray-300";

const ModuleHeader = ({
  icon,
  title,
  description,
  actions = null,
  iconClassName = "text-primary-600 dark:text-primary-400",
}) => {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
            <Icon name={icon} className={`h-7 w-7 ${iconClassName}`} />
          </div>
          <h1 className={`text-3xl font-bold leading-none ${TXT_TITLE} transition-theme`}>
            {title}
          </h1>
        </div>
        <p className={`${TXT_META} mt-2 transition-theme`}>
          {description}
        </p>
      </div>

      {actions ? (
        <div className="flex flex-shrink-0 items-center gap-2 self-start md:self-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
};

export default ModuleHeader;
