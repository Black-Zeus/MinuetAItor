export const MODULE_VIEW_MODES = {
  BASE: "base",
  LIST: "list",
  TABLE: "table",
};

export const MODULE_VIEW_OPTIONS = [
  { id: MODULE_VIEW_MODES.BASE, label: "Base" },
  { id: MODULE_VIEW_MODES.LIST, label: "Listado" },
  { id: MODULE_VIEW_MODES.TABLE, label: "Tabla" },
];

export const normalizeModuleView = (value, availableModes = MODULE_VIEW_OPTIONS.map((option) => option.id)) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return availableModes.includes(normalizedValue) ? normalizedValue : availableModes[0] ?? MODULE_VIEW_MODES.BASE;
};
