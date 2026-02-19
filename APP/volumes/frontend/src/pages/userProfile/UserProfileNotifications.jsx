/**
 * UserProfileNotifications.jsx
 * Tab de Notificaciones: preferencias de alertas y avisos del sistema.
 * Usa notificationsEnabled de baseSiteStore para el toggle global.
 */

import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import useBaseSiteStore from "@store/baseSiteStore";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Toggle row subcomponent ──────────────────────────────────────────────────
const ToggleRow = ({ icon, iconColor, label, description, value, onChange, disabled = false }) => (
  <div className={`flex items-center justify-between gap-4 py-4 transition-theme ${disabled ? "opacity-50" : ""}`}>
    <div className="flex items-start gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>{label}</p>
        <p className={`text-xs ${TXT_META} mt-0.5 transition-theme`}>{description}</p>
      </div>
    </div>

    {/* Toggle switch */}
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40",
        value ? "bg-primary-500 dark:bg-primary-600" : "bg-gray-200 dark:bg-gray-700",
        disabled ? "cursor-not-allowed" : "",
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

// ─── Section card ─────────────────────────────────────────────────────────────
const NotifCard = ({ title, titleIcon, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
    <h3 className={`text-base font-bold ${TXT_TITLE} flex items-center gap-2 mb-1 transition-theme`}>
      <Icon name={titleIcon} className="text-primary-500 dark:text-primary-400 w-4 h-4" />
      {title}
    </h3>
    <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
      {children}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const UserProfileNotifications = () => {
  // Toggle global desde baseSiteStore (ya persiste en localStorage)
  const { notificationsEnabled, setNotificationsEnabled } = useBaseSiteStore();

  // Preferencias granulares (TODO: persistir en backend)
  const [prefs, setPrefs] = useState({
    // Actividad de minutas
    minutaCreada:      true,
    minutaAprobada:    true,
    minutaRechazada:   true,
    minutaPendiente:   false,

    // Actividad de proyectos / clientes
    proyectoActualizado: true,
    clienteAsignado:     false,

    // Sistema
    sesionNueva:       true,
    reporteSemanal:    false,
  });

  const toggle = (key) =>
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  const disabled = !notificationsEnabled;

  const handleSave = () => {
    // TODO: llamar servicio real
    ModalManager.success?.({
      title: "Preferencias guardadas",
      message: "Tus preferencias de notificaciones se actualizaron correctamente.",
    });
  };

  const handleReset = () => {
    setPrefs({
      minutaCreada: true, minutaAprobada: true, minutaRechazada: true, minutaPendiente: false,
      proyectoActualizado: true, clienteAsignado: false,
      sesionNueva: true, reporteSemanal: false,
    });
  };

  return (
    <div className="space-y-6">

      {/* Toggle global — conectado a baseSiteStore */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
              <Icon name="FaBell" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
              Notificaciones del sistema
            </h2>
            <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
              {notificationsEnabled
                ? "Las notificaciones están activadas. Puedes configurar cuáles recibir abajo."
                : "Las notificaciones están desactivadas. Actívalas para configurar preferencias."}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={[
              "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
              "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40",
              notificationsEnabled ? "bg-primary-500 dark:bg-primary-600" : "bg-gray-200 dark:bg-gray-700",
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

      {/* Minutas */}
      <NotifCard title="Minutas" titleIcon="FaClipboardCheck">
        <ToggleRow
          icon="FaFileAlt" iconColor="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          label="Minuta creada"
          description="Cuando se registra una nueva minuta en tus proyectos."
          value={prefs.minutaCreada} onChange={() => toggle("minutaCreada")} disabled={disabled}
        />
        <ToggleRow
          icon="checkCircle" iconColor="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          label="Minuta aprobada"
          description="Cuando una minuta es aprobada por un responsable."
          value={prefs.minutaAprobada} onChange={() => toggle("minutaAprobada")} disabled={disabled}
        />
        <ToggleRow
          icon="xCircle" iconColor="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          label="Minuta rechazada"
          description="Cuando una minuta es rechazada o devuelta para revisión."
          value={prefs.minutaRechazada} onChange={() => toggle("minutaRechazada")} disabled={disabled}
        />
        <ToggleRow
          icon="clock" iconColor="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
          label="Minutas pendientes"
          description="Recordatorio diario de minutas que aún requieren acción."
          value={prefs.minutaPendiente} onChange={() => toggle("minutaPendiente")} disabled={disabled}
        />
      </NotifCard>

      {/* Proyectos y clientes */}
      <NotifCard title="Proyectos y clientes" titleIcon="FaFolderOpen">
        <ToggleRow
          icon="FaFolderOpen" iconColor="bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          label="Proyecto actualizado"
          description="Cambios de estado, nuevos miembros o modificaciones en proyectos asignados."
          value={prefs.proyectoActualizado} onChange={() => toggle("proyectoActualizado")} disabled={disabled}
        />
        <ToggleRow
          icon="FaUser" iconColor="bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
          label="Cliente asignado"
          description="Cuando se te asigna un cliente nuevo o confidencial."
          value={prefs.clienteAsignado} onChange={() => toggle("clienteAsignado")} disabled={disabled}
        />
      </NotifCard>

      {/* Sistema */}
      <NotifCard title="Sistema y seguridad" titleIcon="FaGear">
        <ToggleRow
          icon="FaDesktop" iconColor="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          label="Nueva sesión iniciada"
          description="Alerta cuando se detecta un acceso desde un dispositivo nuevo."
          value={prefs.sesionNueva} onChange={() => toggle("sesionNueva")} disabled={disabled}
        />
        <ToggleRow
          icon="FaChartLine" iconColor="bg-teal-100 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"
          label="Reporte semanal"
          description="Resumen de actividad de tus proyectos y minutas cada lunes."
          value={prefs.reporteSemanal} onChange={() => toggle("reporteSemanal")} disabled={disabled}
        />
      </NotifCard>

      {/* Footer de acciones */}
      <div className="flex justify-end gap-3 pt-2">
        <ActionButton
          label="Restablecer"
          variant="soft"
          size="sm"
          icon={<Icon name="FaEraser" />}
          onClick={handleReset}
        />
        <ActionButton
          label="Guardar preferencias"
          variant="primary"
          size="sm"
          icon={<Icon name="check" />}
          onClick={handleSave}
        />
      </div>

    </div>
  );
};

export default UserProfileNotifications;