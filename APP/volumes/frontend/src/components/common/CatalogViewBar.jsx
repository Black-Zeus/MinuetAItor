import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import ModuleViewSwitcher from "@/components/common/ModuleViewSwitcher";

const CatalogViewBar = ({
  count = 0,
  singularLabel = "registro",
  pluralLabel = "registros",
  viewMode = "base",
  onViewModeChange,
  options,
}) => {
  const label = count === 1 ? singularLabel : pluralLabel;

  return (
    <div className="mb-2 flex flex-col gap-3 px-1 py-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon name="listCheck" />
        <span>
          {count} {label}
        </span>
      </div>

      <ModuleViewSwitcher value={viewMode} onChange={onViewModeChange} options={options} />
    </div>
  );
};

export default CatalogViewBar;
