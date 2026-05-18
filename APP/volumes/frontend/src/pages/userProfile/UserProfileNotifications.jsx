/**
 * UserProfileNotifications.jsx
 * Tab de Notificaciones: preferencias reales vinculadas al centro interno.
 */

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import notificationsService from "@/services/notificationsService";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const EMPTY_PREFERENCES = {
  globalEnabled: true,
  sections: [],
  totalItems: 0,
};

const SECTION_ICON_MAP = {
  minutes: "FaClipboardCheck",
  access: "FaFolderOpen",
  account: "FaUser",
  security: "FaGear",
  system: "FaDesktop",
};

const SECTION_THEME_MAP = {
  minutes: {
    icon: "bg-[#4F7CFF] text-white",
    badge: "border-[#4F7CFF]/20 bg-[#4F7CFF]/10 text-[#4F7CFF] dark:border-[#4F7CFF]/30 dark:bg-[#4F7CFF]/15 dark:text-[#9DB7FF]",
    accent: "bg-[#4F7CFF]",
  },
  access: {
    icon: "bg-[#7C4DFF] text-white",
    badge: "border-[#7C4DFF]/20 bg-[#7C4DFF]/10 text-[#7C4DFF] dark:border-[#7C4DFF]/30 dark:bg-[#7C4DFF]/15 dark:text-[#BEA8FF]",
    accent: "bg-[#7C4DFF]",
  },
  account: {
    icon: "bg-[#F59E0B] text-white",
    badge: "border-[#F59E0B]/20 bg-[#F59E0B]/10 text-[#C27C05] dark:border-[#F59E0B]/30 dark:bg-[#F59E0B]/15 dark:text-[#F8C766]",
    accent: "bg-[#F59E0B]",
  },
  security: {
    icon: "bg-[#64748B] text-white",
    badge: "border-[#64748B]/20 bg-[#64748B]/10 text-[#64748B] dark:border-[#64748B]/30 dark:bg-[#64748B]/15 dark:text-[#AAB4C4]",
    accent: "bg-[#64748B]",
  },
  system: {
    icon: "bg-[#5CC8B2] text-white",
    badge: "border-[#5CC8B2]/20 bg-[#5CC8B2]/10 text-[#2D9B86] dark:border-[#5CC8B2]/30 dark:bg-[#5CC8B2]/15 dark:text-[#98E0D3]",
    accent: "bg-[#5CC8B2]",
  },
  default: {
    icon: "bg-primary-600 text-white dark:bg-primary-500",
    badge: "border-primary-200/20 bg-primary-500/10 text-primary-700 dark:border-primary-400/20 dark:bg-primary-500/15 dark:text-primary-200",
    accent: "bg-primary-500",
  },
};

const ITEM_ICON_MAP = {
  "minute.activity": {
    name: "FaClipboardCheck",
    color: "bg-[#4F7CFF]/12 text-[#4F7CFF] dark:bg-[#4F7CFF]/15 dark:text-[#9DB7FF]",
  },
  "access.management": {
    name: "FaFolderOpen",
    color: "bg-[#7C4DFF]/12 text-[#7C4DFF] dark:bg-[#7C4DFF]/15 dark:text-[#BEA8FF]",
  },
  "account.roles": {
    name: "FaUser",
    color: "bg-[#F59E0B]/12 text-[#C27C05] dark:bg-[#F59E0B]/15 dark:text-[#F8C766]",
  },
  "security.credentials": {
    name: "FaGear",
    color: "bg-[#64748B]/12 text-[#64748B] dark:bg-[#64748B]/15 dark:text-[#AAB4C4]",
  },
  "system.operational": {
    name: "FaDesktop",
    color: "bg-[#5CC8B2]/12 text-[#2D9B86] dark:bg-[#5CC8B2]/15 dark:text-[#98E0D3]",
  },
};

const clonePreferences = (value) => JSON.parse(JSON.stringify(value || EMPTY_PREFERENCES));

const replaceItemInSections = (sections = [], targetKey, nextValue) =>
  sections.map((section) => ({
    ...section,
    items: Array.isArray(section.items)
      ? section.items.map((item) => (
          item.key === targetKey
            ? { ...item, isEnabled: nextValue, receivesNotifications: nextValue }
            : item
        ))
      : [],
  }));

const flattenEditableItems = (sections = []) =>
  sections.flatMap((section) =>
    (Array.isArray(section.items) ? section.items : [])
      .filter((item) => item?.key && item?.isEditable)
      .map((item) => ({
        key: item.key,
        isEnabled: Boolean(item.isEnabled),
      }))
  );

const ToggleRow = ({
  icon,
  iconColor,
  label,
  description,
  value,
  onChange,
  disabled = false,
  statusLabel = null,
  statusTone = "neutral",
}) => (
  <div
    className={[
      "flex items-center justify-between gap-4 py-4 transition-theme",
      disabled
        ? "opacity-65"
        : "",
    ].join(" ")}
  >
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
        <Icon name={icon} className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>{label}</p>
        </div>
        <p className={`mt-0.5 text-xs ${TXT_META} transition-theme`}>{description}</p>
        {statusLabel ? (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={[
                "inline-flex h-2.5 w-2.5 rounded-full",
                statusTone === "success"
                  ? "bg-emerald-500"
                  : statusTone === "warning"
                    ? "bg-amber-500"
                    : statusTone === "danger"
                      ? "bg-rose-500"
                      : "bg-slate-400 dark:bg-slate-500",
              ].join(" ")}
            />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              {statusLabel}
            </span>
          </div>
        ) : null}
      </div>
    </div>

    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40",
        value ? "bg-primary-500 dark:bg-primary-600" : "bg-gray-200 dark:bg-gray-700",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md",
          "transform transition-transform duration-200",
          value ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  </div>
);

const NotifCard = ({
  title,
  titleIcon,
  description,
  children,
  sectionKey = "default",
}) => {
  const theme = SECTION_THEME_MAP[sectionKey] || SECTION_THEME_MAP.default;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className={`h-1.5 w-full ${theme.accent}`} />
      <div className="relative px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className={`mb-1 text-lg font-bold ${TXT_TITLE} transition-theme`}>
              {title}
            </h3>
            {description ? (
              <p className={`max-w-[34ch] text-sm leading-6 ${TXT_BODY} transition-theme`}>{description}</p>
            ) : null}
          </div>
          <div className={`mt-1 mr-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${theme.icon}`}>
            <Icon name={titleIcon} className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="mx-6 h-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex-1 divide-y divide-gray-100 px-6 py-2 dark:divide-gray-700/60">
        {children}
      </div>
    </div>
  );
};

const UserProfileNotifications = () => {
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const [initialPreferences, setInitialPreferences] = useState(EMPTY_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const result = await notificationsService.getPreferences();
        if (!mounted) return;
        setPreferences(result);
        setInitialPreferences(clonePreferences(result));
      } catch (error) {
        if (!mounted) return;
        ModalManager.error?.({
          title: "No se pudieron cargar las notificaciones",
          message: error?.message ?? "Intenta nuevamente en unos minutos.",
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPreferences();
    return () => {
      mounted = false;
    };
  }, []);

  const notificationsEnabled = Boolean(preferences.globalEnabled);
  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);

  const handleGlobalToggle = (nextValue) => {
    setPreferences((prev) => ({ ...prev, globalEnabled: nextValue }));
  };

  const handleItemToggle = (key, nextValue) => {
    setPreferences((prev) => ({
      ...prev,
      sections: replaceItemInSections(prev.sections, key, nextValue),
    }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const result = await notificationsService.updatePreferences({
        globalEnabled: preferences.globalEnabled,
        items: flattenEditableItems(preferences.sections),
      });
      setPreferences(result);
      setInitialPreferences(clonePreferences(result));
      ModalManager.success?.({
        title: "Preferencias guardadas",
        message: "Tus preferencias de notificaciones se actualizaron correctamente.",
      });
    } catch (error) {
      ModalManager.error?.({
        title: "No se pudieron guardar las preferencias",
        message: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPreferences(clonePreferences(initialPreferences));
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <Icon name="spinner" className="h-5 w-5 animate-spin text-primary-500" />
          <div>
            <p className={`text-sm font-semibold ${TXT_TITLE}`}>Cargando preferencias</p>
            <p className={`text-xs ${TXT_META}`}>Estamos consultando tu suscripción real al centro de notificaciones.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className={`flex items-center gap-2 text-lg font-bold ${TXT_TITLE} transition-theme`}>
              <Icon name="FaBell" className="h-4 w-4 text-primary-500 dark:text-primary-400" />
              Notificaciones del sistema
            </h2>
            <p className={`mt-0.5 text-sm ${TXT_BODY} transition-theme`}>
              {notificationsEnabled
                ? "Tus preferencias opcionales están activas. Debajo puedes decidir qué categorías quieres seguir recibiendo."
                : "Tus notificaciones opcionales están pausadas. Las alertas obligatorias para administradores seguirán llegando igualmente."}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            disabled={isSaving}
            onClick={() => handleGlobalToggle(!notificationsEnabled)}
            className={[
              "relative inline-flex h-7 w-14 shrink-0 rounded-full border-2 border-transparent",
              "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40",
              notificationsEnabled ? "bg-primary-500 dark:bg-primary-600" : "bg-gray-200 dark:bg-gray-700",
              isSaving ? "cursor-not-allowed opacity-70" : "cursor-pointer",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md",
                "transform transition-transform duration-200",
                notificationsEnabled ? "translate-x-7" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      {preferences.totalItems > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {preferences.sections.map((section) => (
            <NotifCard
              key={section.key}
              title={section.title}
              titleIcon={SECTION_ICON_MAP[section.key] || "FaBell"}
              sectionKey={section.key}
              description={section.description}
            >
              {section.items.map((item) => {
                const iconConfig = ITEM_ICON_MAP[item.key] || {
                  name: "FaBell",
                  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
                };
                const theme = SECTION_THEME_MAP[section.key] || SECTION_THEME_MAP.default;
                const isDisabled = isSaving || !notificationsEnabled || !item.isEditable;
                const isPausedByGlobalToggle = !notificationsEnabled && item.isEditable && !item.isMandatory;
                const receivesNotifications = item.isMandatory
                  ? true
                  : item.isEditable
                    ? (notificationsEnabled && item.isEnabled)
                    : item.receivesNotifications;
                const statusLabel = item.isMandatory
                  ? "Obligatoria"
                  : item.disabledReason
                    ? "Restringida"
                    : receivesNotifications
                      ? "Activa"
                      : "Pausada";
                const statusTone = item.isMandatory
                  ? "success"
                  : item.disabledReason
                    ? "neutral"
                    : receivesNotifications
                      ? "success"
                      : "warning";

                return (
                  <ToggleRow
                    key={item.key}
                    icon={iconConfig.name}
                    iconColor={iconConfig.color}
                    label={item.title}
                    description={
                      isPausedByGlobalToggle
                        ? "Pausada por la preferencia general. Vuelve a activar las notificaciones para retomarla."
                        : item.disabledReason || item.description
                    }
                    value={item.isEnabled}
                    onChange={(nextValue) => handleItemToggle(item.key, nextValue)}
                    disabled={isDisabled}
                    statusLabel={statusLabel}
                    statusTone={statusTone}
                  />
                );
              })}
            </NotifCard>
          ))}
        </div>
      ) : null}

      {preferences.totalItems === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 transition-theme dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No hay categorías configurables disponibles para tu cuenta.
        </div>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <ActionButton
          label="Restablecer"
          variant="soft"
          size="sm"
          icon={<Icon name="FaEraser" />}
          onClick={handleReset}
          disabled={isSaving}
        />
        <ActionButton
          label={isSaving ? "Guardando..." : "Guardar preferencias"}
          variant="primary"
          size="sm"
          icon={<Icon name={isSaving ? "spinner" : "check"} className={isSaving ? "animate-spin" : ""} />}
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        />
      </div>
    </div>
  );
};

export default UserProfileNotifications;
