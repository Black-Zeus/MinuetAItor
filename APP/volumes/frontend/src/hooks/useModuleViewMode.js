import { useState } from "react";

import useBaseSiteStore from "@/store/baseSiteStore";
import { MODULE_VIEW_MODES, normalizeModuleView } from "@/utils/moduleViews";

const useModuleViewMode = (availableModes = [MODULE_VIEW_MODES.BASE, MODULE_VIEW_MODES.LIST, MODULE_VIEW_MODES.TABLE]) => {
  const preferredView = useBaseSiteStore((state) => state.ui?.defaultModuleView ?? MODULE_VIEW_MODES.BASE);
  const [viewMode, setViewMode] = useState(() =>
    normalizeModuleView(preferredView, availableModes)
  );

  return [viewMode, setViewMode];
};

export default useModuleViewMode;
