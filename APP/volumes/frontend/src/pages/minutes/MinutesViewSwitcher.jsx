import React from "react";

import ModuleViewSwitcher from "@/components/common/ModuleViewSwitcher";
import { MODULE_VIEW_OPTIONS } from "@/utils/moduleViews";

const MINUTES_VIEW_OPTIONS = [
  ...MODULE_VIEW_OPTIONS,
  { id: "client", label: "Por cliente" },
];

const MinutesViewSwitcher = ({ value = "base", onChange }) => (
  <ModuleViewSwitcher value={value} onChange={onChange} options={MINUTES_VIEW_OPTIONS} />
);

export default MinutesViewSwitcher;
