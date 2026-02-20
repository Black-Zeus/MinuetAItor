/**
 * UserProfilePersonalData.jsx
 * Sección de formulario: datos personales del usuario
 * Alineado al patrón de formularios del sistema (inputs, labels, grid 12 cols)
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const INPUT_BASE =
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 " +
  "bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white text-sm " +
  "placeholder-gray-400 dark:placeholder-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-transparent " +
  "transition-theme";

const LABEL_BASE = `block text-sm font-medium ${TXT_META} mb-1.5 transition-theme`;

// ─── Field subcomponent ───────────────────────────────────────────────────────
const Field = ({ label, icon, children }) => (
  <div>
    <label className={LABEL_BASE}>
      <Icon name={icon} className="inline w-3.5 h-3.5 mr-1.5" />
      {label}
    </label>
    {children}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const UserProfilePersonalData = ({ profile, onChange, onSave, onReset }) => {
  const handleChange = (field, value) => {
    onChange?.({ ...profile, [field]: value });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
            <Icon name="FaUser" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
            Datos personales
          </h2>
          <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
            Información visible en tu cuenta.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-white/10 bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-300">
          <Icon name="FaLock" className="w-3 h-3" />
          Privado
        </span>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6">
          <Field label="Nombre completo" icon="FaUser">
            <input
              type="text"
              value={profile?.fullName || ""}
              onChange={(e) => handleChange("fullName", e.target.value)}
              placeholder="Nombre completo"
              className={INPUT_BASE}
            />
          </Field>
        </div>

        <div className="col-span-6">
          <Field label="Cargo" icon="FaBriefcase">
            <input
              type="text"
              value={profile?.position || ""}
              onChange={(e) => handleChange("position", e.target.value)}
              placeholder="Ej: SysAdmin / DevOps"
              className={INPUT_BASE}
            />
          </Field>
        </div>

        <div className="col-span-6">
          <Field label="Teléfono" icon="FaPhone">
            <input
              type="tel"
              value={profile?.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+56 9 0000 0000"
              className={INPUT_BASE}
            />
          </Field>
        </div>

        <div className="col-span-6">
          <Field label="Departamento / Área" icon="FaBuilding">
            <input
              type="text"
              value={profile?.area || ""}
              onChange={(e) => handleChange("area", e.target.value)}
              placeholder="Ej: Infraestructura TI"
              className={INPUT_BASE}
            />
          </Field>
        </div>

        <div className="col-span-12">
          <Field label="Notas" icon="FaClipboardList">
            <textarea
              rows={3}
              value={profile?.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Información adicional de tu cuenta..."
              className={INPUT_BASE}
            />
          </Field>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 transition-theme">
        <ActionButton
          label="Restablecer"
          variant="soft"
          size="sm"
          icon={<Icon name="FaEraser" />}
          onClick={onReset}
        />
        <ActionButton
          label="Guardar"
          variant="primary"
          size="sm"
          icon={<Icon name="check" />}
          onClick={onSave}
        />
      </div>
    </div>
  );
};

export default UserProfilePersonalData;