/**
 * UserProfileCustomization.jsx
 * Tab "Personalización" — controla qué widgets se muestran en el Dashboard.
 *
 * Lee y escribe directamente en dashboardStore (Zustand + localStorage).
 * Los cambios son inmediatos y persisten entre sesiones.
 *
 * Categorías:
 *  "resumen"  → Stats, Última conexión, Tags populares
 *  "minutas"  → Minutas pendientes, Minutas participadas
 *  "accesos"  → Clientes confidenciales, Proyectos confidenciales
 */

import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import useDashboardStore, { DASHBOARD_WIDGETS_DEFAULT } from "@store/dashboardStore";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Categorías de widgets ────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  resumen: {
    label: "Resumen general",
    icon: "FaChartLine",
    iconBg: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    description: "KPIs, última conexión y etiquetas del sistema.",
  },
  minutas: {
    label: "Minutas",
    icon: "FaFileAlt",
    iconBg: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    description: "Widgets relacionados con minutas y tu participación.",
  },
  accesos: {
    label: "Accesos confidenciales",
    icon: "FaUserShield",
    iconBg: "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
    description: "Clientes y proyectos confidenciales con acceso asignado.",
  },
};

// ─── Widget toggle row ────────────────────────────────────────────────────────
const WidgetRow = ({ widgetKey, widget, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-3.5 transition-theme">
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center shrink-0">
        <Icon name={widget.icon} className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${TXT_TITLE} leading-tight transition-theme`}>
          {widget.label}
        </p>
        <p className={`text-xs ${TXT_META} mt-0.5 transition-theme`}>
          {widget.description}
        </p>
      </div>
    </div>

    <button
      type="button"
      role="switch"
      aria-checked={widget.enabled}
      onClick={() => onChange(widgetKey, !widget.enabled)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40",
        widget.enabled
          ? "bg-primary-500 dark:bg-primary-600"
          : "bg-gray-200 dark:bg-gray-700",
      ].join(" ")}
    >
      <span className={[
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md",
        "transform transition-transform duration-200",
        widget.enabled ? "translate-x-5" : "translate-x-0",
      ].join(" ")} />
    </button>
  </div>
);

// ─── Category section ─────────────────────────────────────────────────────────
const CategorySection = ({ categoryKey, widgets, onToggle }) => {
  const config = CATEGORY_CONFIG[categoryKey];
  if (!config) return null;

  const enabledCount = Object.values(widgets).filter((w) => w.enabled).length;
  const totalCount   = Object.values(widgets).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}>
          <Icon name={config.icon} className="w-4 h-4" />
        </div>
        <div>
          <h3 className={`text-base font-bold ${TXT_TITLE} leading-tight transition-theme`}>
            {config.label}
          </h3>
          <p className={`text-xs ${TXT_META} transition-theme`}>{config.description}</p>
        </div>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          enabledCount > 0
            ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        }`}>
          {enabledCount}/{totalCount} activos
        </span>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700/60 mt-3 mb-0.5" />

      <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {Object.entries(widgets)
          .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99))
          .map(([key, widget]) => (
            <WidgetRow key={key} widgetKey={key} widget={widget} onChange={onToggle} />
          ))}
      </div>
    </div>
  );
};

// ─── Preview ──────────────────────────────────────────────────────────────────
const PreviewBadge = ({ widgets }) => {
  const enabled = Object.values(widgets)
    .filter((w) => w.enabled)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 transition-theme">
      <p className={`text-xs font-semibold ${TXT_META} mb-2 transition-theme`}>
        Vista previa del dashboard — secciones activas ({enabled.length}):
      </p>
      <div className="flex flex-wrap gap-2">
        {enabled.length === 0 ? (
          <span className={`text-xs ${TXT_META} italic`}>
            Sin secciones activas. El dashboard estará vacío.
          </span>
        ) : (
          enabled.map((w) => (
            <span
              key={w.label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 transition-theme"
            >
              <Icon name={w.icon} className="w-3 h-3" />
              {w.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const UserProfileCustomization = () => {
  // Lee widgets del store
  const widgets          = useDashboardStore((s) => s.widgets);
  const setWidgetEnabled = useDashboardStore((s) => s.setWidgetEnabled);
  const enableAllWidgets = useDashboardStore((s) => s.enableAllWidgets);
  const disableAllWidgets = useDashboardStore((s) => s.disableAllWidgets);
  const resetWidgets     = useDashboardStore((s) => s.resetWidgets);

  // Snapshot para detectar cambios vs defaults
  const [snapshot] = useState(() => JSON.stringify(DASHBOARD_WIDGETS_DEFAULT));
  const hasChanges = JSON.stringify(widgets) !== snapshot;

  const enabledCount = Object.values(widgets).filter((w) => w.enabled).length;
  const totalCount   = Object.values(widgets).length;

  // Agrupa por categoría
  const byCategory = Object.entries(widgets).reduce((acc, [key, widget]) => {
    const cat = widget.category || "resumen";
    if (!acc[cat]) acc[cat] = {};
    acc[cat][key] = widget;
    return acc;
  }, {});

  const handleToggle = (key, value) => setWidgetEnabled(key, value);

  const handleSave = () => {
    // Los cambios ya están persistidos en localStorage via store.
    // Este botón es confirmación visual — en el futuro sincroniza con backend.
    ModalManager.success?.({
      title: "Personalización guardada",
      message: "La configuración del dashboard se actualizó correctamente.",
    });
  };

  return (
    <div className="space-y-6">

      {/* Header + acciones rápidas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
              <Icon name="FaGear" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
              Personalización del dashboard
            </h2>
            <p className={`text-sm ${TXT_BODY} mt-1 transition-theme`}>
              Elige qué secciones se mostrarán en tu dashboard. Los cambios aplican solo a tu vista.
            </p>
            <p className={`text-xs ${TXT_META} mt-0.5 transition-theme`}>
              {enabledCount} de {totalCount} secciones activas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ActionButton
              label="Activar todas"
              variant="soft"
              size="xs"
              icon={<Icon name="checkCircle" />}
              onClick={enableAllWidgets}
            />
            <ActionButton
              label="Desactivar todas"
              variant="soft"
              size="xs"
              icon={<Icon name="xCircle" />}
              onClick={disableAllWidgets}
            />
            <ActionButton
              label="Restablecer"
              variant="soft"
              size="xs"
              icon={<Icon name="FaEraser" />}
              onClick={resetWidgets}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <PreviewBadge widgets={widgets} />

      {/* Categorías */}
      {Object.entries(byCategory).map(([catKey, catWidgets]) => (
        <CategorySection
          key={catKey}
          categoryKey={catKey}
          widgets={catWidgets}
          onToggle={handleToggle}
        />
      ))}

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-2">
        <ActionButton
          label="Confirmar configuración"
          variant="primary"
          size="sm"
          icon={<Icon name="check" />}
          onClick={handleSave}
        />
      </div>

    </div>
  );
};

export default UserProfileCustomization;