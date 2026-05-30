/**
 * UserProfileCustomization.jsx
 * Tab "Personalización" — preferencias reales de experiencia y dashboard.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import useBaseSiteStore from "@store/baseSiteStore";
import personalizationService from "@/services/personalizationService";
import { BROWSER_TIMEZONE, getBrowserTimeZone } from "@/utils/timeZone";
import timeZonesCatalog from "@/data/timeZones.json";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const WIDGET_META = {
  stats: {
    label: "Resumen estadístico",
    icon: "FaChartBar",
    description: "KPIs principales: minutas, proyectos y clientes activos.",
  },
  ultima_conexion: {
    label: "Última conexión",
    icon: "FaClock",
    description: "Información de tu sesión más reciente y dispositivo.",
  },
  minutas_pendientes: {
    label: "Minutas pendientes",
    icon: "FaClipboardCheck",
    description: "Minutas en estado pendiente que requieren revisión.",
  },
  minutas_participadas: {
    label: "Minutas donde participé",
    icon: "FaUserCheck",
    description: "Últimas minutas registradas con tu participación.",
  },
  clientes_confidenciales: {
    label: "Clientes confidenciales",
    icon: "FaUserShield",
    description: "Clientes confidenciales a los que tienes visibilidad.",
  },
  proyectos_confidenciales: {
    label: "Proyectos confidenciales",
    icon: "FaFolderOpen",
    description: "Proyectos confidenciales donde tienes permisos.",
  },
  tags_populares: {
    label: "Minutas completadas",
    icon: "FaCheckCircle",
    description: "Minutas recientes completadas donde eres el elaborador.",
  },
};

const CATEGORY_CONFIG = {
  resumen: {
    label: "Resumen general",
    icon: "FaChartLine",
    accent: "bg-blue-500",
    iconWrap: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    description: "KPIs, última conexión y actividad reciente.",
  },
  minutas: {
    label: "Minutas",
    icon: "FaFileAlt",
    accent: "bg-violet-500",
    iconWrap: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
    description: "Widgets relacionados con minutas y tu participación.",
  },
  accesos: {
    label: "Accesos confidenciales",
    icon: "FaUserShield",
    accent: "bg-amber-500",
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    description: "Clientes y proyectos confidenciales con acceso asignado.",
  },
};

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: "FaSun" },
  { value: "dark", label: "Oscuro", icon: "FaMoon" },
  { value: "system", label: "Sistema", icon: "FaDesktop" },
];

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Cómoda", icon: "FaLayerGroup" },
  { value: "compact", label: "Compacta", icon: "FaTableCellsLarge" },
];

const MODULE_VIEW_OPTIONS = [
  { value: "base", label: "Base", icon: "FaGrip" },
  { value: "list", label: "Listado", icon: "FaList" },
  { value: "table", label: "Tabla", icon: "FaTable" },
];

const TIMEZONE_REGION_LABELS = {
  America: "America",
  Europe: "Europe",
  Asia: "Asia",
  Africa: "Africa",
  Australia: "Australia",
  Pacific: "Pacific",
  Atlantic: "Atlantic",
  Indian: "Indian",
  Antarctica: "Antarctica",
  Arctic: "Arctic",
  UTC: "UTC",
  Etc: "Etc",
};

const BROWSER_TIMEZONE_OPTION = {
  value: BROWSER_TIMEZONE,
  label: "Automática del navegador",
};

const TIMEZONE_OPTIONS = Object.entries(timeZonesCatalog).flatMap(([region, items]) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    regionLabel: TIMEZONE_REGION_LABELS[region] ?? region,
    searchText: `${item.value} ${item.label} ${item.utc_offset} ${region}`.toLowerCase(),
  }))
);

const enrichWidget = (key, storeWidget) => ({
  ...storeWidget,
  ...(WIDGET_META[key] ?? { label: key, icon: "FaSquare", description: "" }),
});

const ChoiceChip = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-all",
      active
        ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-400/55 dark:bg-primary-500/14 dark:text-primary-50 dark:shadow-[0_0_0_1px_rgba(96,165,250,0.08)]"
        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800/75 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/85",
    ].join(" ")}
  >
    <Icon name={icon} className="h-4 w-4" />
    {label}
  </button>
);

const InlineToggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={[
      "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
      "focus:outline-none focus:ring-2 focus:ring-primary-500/40",
      checked ? "bg-primary-500 dark:bg-primary-600" : "bg-gray-200 dark:bg-gray-700",
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
    ].join(" ")}
  >
    <span
      className={[
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0",
      ].join(" ")}
    />
  </button>
);

const TimeZoneSelect = ({ value, onChange }) => {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const browserTimeZone = getBrowserTimeZone();
  const selectedOption = TIMEZONE_OPTIONS.find((option) => option.value === value);
  const displayValue = value === BROWSER_TIMEZONE || !value
    ? `${BROWSER_TIMEZONE_OPTION.label} (${browserTimeZone})`
    : selectedOption?.label ?? value;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = useMemo(() => {
    if (!normalizedQuery) return TIMEZONE_OPTIONS.slice(0, 80);
    return TIMEZONE_OPTIONS
      .filter((option) => option.searchText.includes(normalizedQuery))
      .slice(0, 80);
  }, [normalizedQuery]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
        <input
          type="text"
          value={isOpen ? query : displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setIsOpen(true);
          }}
          placeholder="Buscar zona horaria"
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-gray-700 shadow-sm outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => handleSelect(BROWSER_TIMEZONE)}
            className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-700/75"
          >
            <span className="min-w-0">
              <span className={`block truncate font-semibold ${TXT_TITLE}`}>
                {BROWSER_TIMEZONE_OPTION.label}
              </span>
              <span className={`block truncate text-xs ${TXT_META}`}>
                {browserTimeZone}
              </span>
            </span>
            {(value === BROWSER_TIMEZONE || !value) && <Icon name="check" className="h-4 w-4 text-primary-500" />}
          </button>

          <div className="max-h-60 overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className={`px-3 py-3 text-sm ${TXT_META}`}>Sin resultados.</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700/75"
                >
                  <span className="min-w-0">
                    <span className={`block truncate font-medium ${TXT_TITLE}`}>{option.value}</span>
                    <span className={`block truncate text-xs ${TXT_META}`}>
                      {option.regionLabel} · {option.utc_offset}
                    </span>
                  </span>
                  {value === option.value && <Icon name="check" className="h-4 w-4 text-primary-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};

const PreferenceTile = ({ icon, title, description, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 dark:bg-gray-700/70 dark:text-gray-200">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h3 className={`text-base font-bold ${TXT_TITLE}`}>{title}</h3>
        <p className={`mt-1 text-sm ${TXT_BODY}`}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const WidgetRow = ({ widgetKey, widget, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-700/70 dark:text-gray-300">
        <Icon name={widget.icon} className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${TXT_TITLE}`}>{widget.label}</p>
        <p className={`mt-0.5 text-xs ${TXT_META}`}>{widget.description}</p>
      </div>
    </div>
    <InlineToggle checked={widget.enabled} onChange={(next) => onChange(widgetKey, next)} />
  </div>
);

const WidgetCategoryCard = ({ categoryKey, widgets, onToggle }) => {
  const config = CATEGORY_CONFIG[categoryKey];
  if (!config) return null;

  const entries = Object.entries(widgets).sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800">
      <div className={`h-1.5 w-full ${config.accent}`} />
      <div className="px-6 py-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className={`text-lg font-bold ${TXT_TITLE}`}>{config.label}</h3>
            <p className={`mt-1 max-w-[34ch] text-sm leading-6 ${TXT_BODY}`}>{config.description}</p>
          </div>
          <div className={`mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.iconWrap}`}>
            <Icon name={config.icon} className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="mx-6 h-px bg-gray-200 dark:bg-gray-700" />

      <div className="divide-y divide-gray-100 px-6 py-2 dark:divide-gray-700/60">
        {entries.map(([key, widget]) => (
          <WidgetRow key={key} widgetKey={key} widget={widget} onChange={onToggle} />
        ))}
      </div>
    </div>
  );
};

const PreviewBadge = ({ enrichedWidgets }) => {
  const enabled = Object.entries(enrichedWidgets)
    .filter(([, widget]) => widget.enabled)
    .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <div className="pt-4 transition-theme">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="FaTableCellsLarge" className="h-4 w-4 text-primary-600 dark:text-primary-200" />
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-200">
          Vista previa del dashboard
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {enabled.length === 0 ? (
          <span className="text-xs italic text-slate-500 dark:text-slate-300">No habrá widgets visibles en tu dashboard.</span>
        ) : (
          enabled.map(([key, widget]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200/80 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 shadow-sm dark:border-primary-400/25 dark:bg-primary-500/10 dark:text-primary-100"
            >
              <Icon name={widget.icon} className="h-3.5 w-3.5" />
              {widget.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

const UserProfileCustomization = () => {
  const widgets = useBaseSiteStore((s) => s.dashboard?.widgets ?? {});
  const theme = useBaseSiteStore((s) => s.theme);
  const density = useBaseSiteStore((s) => s.ui?.density ?? "comfortable");
  const animations = useBaseSiteStore((s) => s.ui?.animations ?? true);
  const sidebarCollapsed = useBaseSiteStore((s) => s.sidebar?.collapsed ?? false);
  const defaultModuleView = useBaseSiteStore((s) => s.ui?.defaultModuleView ?? "base");
  const timeZone = useBaseSiteStore((s) => s.ui?.timeZone ?? BROWSER_TIMEZONE);

  const setTheme = useBaseSiteStore((s) => s.setTheme);
  const setDensity = useBaseSiteStore((s) => s.setDensity);
  const setAnimations = useBaseSiteStore((s) => s.setAnimations);
  const setSidebarCollapsed = useBaseSiteStore((s) => s.setSidebarCollapsed);
  const setDefaultModuleView = useBaseSiteStore((s) => s.setDefaultModuleView);
  const setTimeZone = useBaseSiteStore((s) => s.setTimeZone);
  const setWidgetEnabled = useBaseSiteStore((s) => s.setWidgetEnabled);
  const enableAllWidgets = useBaseSiteStore((s) => s.enableAllWidgets);
  const disableAllWidgets = useBaseSiteStore((s) => s.disableAllWidgets);
  const resetWidgets = useBaseSiteStore((s) => s.resetWidgets);
  const hydratePersonalization = useBaseSiteStore((s) => s.hydratePersonalization);
  const getPersonalizationSnapshot = useBaseSiteStore((s) => s.getPersonalizationSnapshot);

  const [syncState, setSyncState] = useState("saved");
  const [syncMessage, setSyncMessage] = useState("Los cambios se guardan manualmente.");
  const isMountedRef = useRef(true);

  const enrichedWidgets = Object.fromEntries(
    Object.entries(widgets).map(([key, widget]) => [key, enrichWidget(key, widget)])
  );

  const enabledCount = Object.values(enrichedWidgets).filter((widget) => widget.enabled).length;
  const totalCount = Object.values(enrichedWidgets).length;

  const byCategory = Object.entries(enrichedWidgets).reduce((acc, [key, widget]) => {
    const category = widget.category || "resumen";
    if (!acc[category]) acc[category] = {};
    acc[category][key] = widget;
    return acc;
  }, {});

  const persistPersonalization = async () => {
    if (syncState === "saving") return;
    setSyncState("saving");
    setSyncMessage("Guardando cambios en tu cuenta...");
    try {
      const payload = getPersonalizationSnapshot();
      const persisted = await personalizationService.updateMyPersonalization(payload);
      hydratePersonalization(persisted);
      if (isMountedRef.current) {
        setSyncState("saved");
        setSyncMessage("Preferencias guardadas.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSyncState("error");
        setSyncMessage(error?.message || "No fue posible sincronizar tu personalización.");
      }
    }
  };

  const discardPersonalization = async () => {
    if (syncState === "saving") return;
    setSyncState("saving");
    setSyncMessage("Restaurando preferencias guardadas...");
    try {
      const persisted = await personalizationService.getMyPersonalization();
      hydratePersonalization(persisted);
      if (isMountedRef.current) {
        setSyncState("saved");
        setSyncMessage("Preferencias restauradas.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSyncState("error");
        setSyncMessage(error?.message || "No fue posible restaurar tus preferencias.");
      }
    }
  };

  const markDirty = () => {
    setSyncState("dirty");
    setSyncMessage("Tienes cambios sin guardar.");
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleThemeChange = (value) => {
    setTheme(value);
    markDirty();
  };

  const handleDensityChange = (value) => {
    setDensity(value);
    markDirty();
  };

  const handleAnimationsChange = (value) => {
    setAnimations(value);
    markDirty();
  };

  const handleSidebarCollapsedChange = (value) => {
    setSidebarCollapsed(value);
    markDirty();
  };

  const handleDefaultModuleViewChange = (value) => {
    setDefaultModuleView(value);
    markDirty();
  };

  const handleTimeZoneChange = (value) => {
    setTimeZone(value);
    markDirty();
  };

  const handleToggle = (key, value) => {
    setWidgetEnabled(key, value);
    markDirty();
  };

  const handleEnableAllWidgets = () => {
    enableAllWidgets();
    markDirty();
  };

  const handleDisableAllWidgets = () => {
    disableAllWidgets();
    markDirty();
  };

  const handleResetWidgets = () => {
    resetWidgets();
    markDirty();
  };

  const syncBadgeClassName = {
    saved:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/25 dark:text-emerald-200",
    dirty:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/25 dark:text-amber-200",
    saving:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/40 dark:bg-sky-900/25 dark:text-sky-200",
    error:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/25 dark:text-rose-200",
  }[syncState];

  const syncDotClassName = {
    saved: "bg-emerald-500",
    dirty: "bg-amber-500",
    saving: "bg-sky-500",
    error: "bg-rose-500",
  }[syncState];

  const syncLabel = {
    saved: "Sincronizado",
    dirty: "Cambios sin guardar",
    saving: "Procesando",
    error: "Error de sincronización",
  }[syncState];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-theme dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className={`flex items-center gap-2 text-lg font-bold ${TXT_TITLE}`}>
              <Icon name="FaSliders" className="h-4 w-4 text-primary-500 dark:text-primary-300" />
              Personalización del espacio de trabajo
            </h2>
            <p className={`mt-1 text-sm ${TXT_BODY}`}>
              Ajusta la experiencia visual y define qué bloques quieres ver en tu dashboard. Guarda los cambios cuando termines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${syncBadgeClassName}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${syncDotClassName}`} />
              {syncLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {enabledCount}/{totalCount} widgets activos
            </span>
          </div>
        </div>
        <p className={`mt-3 text-xs ${syncState === "error" ? "text-rose-600 dark:text-rose-300" : TXT_META}`}>
          {syncMessage}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PreferenceTile
          icon="FaSliders"
          title="Apariencia"
          description="Define cómo quieres ver la aplicación en tu sesión diaria."
        >
          <div className="space-y-5">
            <div>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.08em] ${TXT_META}`}>Tema</p>
              <div className="flex flex-wrap gap-2">
                {THEME_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    active={theme === option.value}
                    icon={option.icon}
                    label={option.label}
                    onClick={() => handleThemeChange(option.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.08em] ${TXT_META}`}>Densidad</p>
              <div className="flex flex-wrap gap-2">
                {DENSITY_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    active={density === option.value}
                    icon={option.icon}
                    label={option.label}
                    onClick={() => handleDensityChange(option.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.08em] ${TXT_META}`}>Vista predeterminada de catálogos</p>
              <div className="flex flex-wrap gap-2">
                {MODULE_VIEW_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    active={defaultModuleView === option.value}
                    icon={option.icon}
                    label={option.label}
                    onClick={() => handleDefaultModuleViewChange(option.value)}
                  />
                ))}
              </div>
              <p className={`mt-2 text-xs ${TXT_META}`}>
                Se aplicará al entrar a clientes, proyectos, equipos, participantes, etiquetas, perfiles AI y minutas. Si cambias la vista dentro del módulo, ese cambio solo durará mientras estés ahí.
              </p>
            </div>
          </div>
        </PreferenceTile>

        <div className="space-y-5">
          <PreferenceTile
            icon="FaGears"
            title="Comportamiento"
            description="Pequeños ajustes de interacción para adaptar la navegación a tu ritmo."
          >
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className={`text-sm font-semibold ${TXT_TITLE}`}>Animaciones de interfaz</p>
                  <p className={`mt-0.5 text-xs ${TXT_META}`}>Mantiene transiciones y microinteracciones visuales.</p>
                </div>
                <InlineToggle checked={animations} onChange={handleAnimationsChange} />
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className={`text-sm font-semibold ${TXT_TITLE}`}>Sidebar colapsado al abrir</p>
                  <p className={`mt-0.5 text-xs ${TXT_META}`}>Útil si prefieres más espacio de trabajo desde el inicio.</p>
                </div>
                <InlineToggle checked={sidebarCollapsed} onChange={handleSidebarCollapsedChange} />
              </div>
            </div>
          </PreferenceTile>

          <PreferenceTile
            icon="FaGlobeAmericas"
            title="Zona horaria"
            description="Define cómo quieres ver fechas y horas en la interfaz."
          >
            <TimeZoneSelect value={timeZone} onChange={handleTimeZoneChange} />
          </PreferenceTile>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm transition-theme dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className={`text-lg font-bold ${TXT_TITLE}`}>Dashboard personal</h3>
            <p className={`mt-1 text-sm ${TXT_BODY}`}>
              Activa solo los bloques que te aportan contexto y deja fuera lo que no necesitas ver todos los días.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              label="Activar todas"
              variant="soft"
              size="xs"
              icon={<Icon name="checkCircle" />}
              onClick={handleEnableAllWidgets}
              className="border-slate-200/90 bg-white/85 text-slate-700 hover:bg-white dark:border-slate-500/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            />
            <ActionButton
              label="Desactivar todas"
              variant="soft"
              size="xs"
              icon={<Icon name="xCircle" />}
              onClick={handleDisableAllWidgets}
              className="border-slate-200/90 bg-white/85 text-slate-700 hover:bg-white dark:border-slate-500/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            />
            <ActionButton
              label="Restablecer"
              variant="soft"
              size="xs"
              icon={<Icon name="FaEraser" />}
              onClick={handleResetWidgets}
              className="border-slate-200/90 bg-white/85 text-slate-700 hover:bg-white dark:border-slate-500/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
          <PreviewBadge enrichedWidgets={enrichedWidgets} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {Object.entries(byCategory).map(([categoryKey, categoryWidgets]) => (
          <WidgetCategoryCard
            key={categoryKey}
            categoryKey={categoryKey}
            widgets={categoryWidgets}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 transition-theme dark:border-gray-700">
        <ActionButton
          label="Descartar"
          variant="soft"
          size="sm"
          icon={<Icon name="rotateLeft" />}
          onClick={discardPersonalization}
          disabled={syncState === "saving" || syncState === "saved"}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        />
        <ActionButton
          label={syncState === "saving" ? "Guardando..." : "Guardar"}
          variant="primary"
          size="sm"
          icon={<Icon name="check" />}
          onClick={persistPersonalization}
          disabled={syncState === "saving" || syncState === "saved"}
        />
      </div>
    </div>
  );
};

export default UserProfileCustomization;
