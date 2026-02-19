/**
 * UserProfileSecurity.jsx
 * Tab de Seguridad: Cambiar contraseña + Sesiones activas.
 * Ambas secciones en scroll continuo dentro del tab.
 */

import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";

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

// ─── Fake sessions data ───────────────────────────────────────────────────────
const FAKE_SESSIONS = [
  {
    id: "ses-001",
    device: "Chrome en Windows 11",
    icon: "FaDesktop",
    location: "Santiago, Chile",
    ip: "200.111.45.32",
    lastActive: "Ahora mismo",
    isCurrent: true,
  },
  {
    id: "ses-002",
    device: "Safari en iPhone 15",
    icon: "FaMobile",
    location: "Santiago, Chile",
    ip: "200.111.45.33",
    lastActive: "Hace 2 horas",
    isCurrent: false,
  },
  {
    id: "ses-003",
    device: "Firefox en macOS",
    icon: "FaDesktop",
    location: "Valparaíso, Chile",
    ip: "190.82.16.10",
    lastActive: "Hace 3 días",
    isCurrent: false,
  },
];

// ─── PasswordStrength ─────────────────────────────────────────────────────────
const getStrength = (pwd) => {
  if (!pwd) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8)              score++;
  if (/[A-Z]/.test(pwd))           score++;
  if (/[0-9]/.test(pwd))           score++;
  if (/[^A-Za-z0-9]/.test(pwd))   score++;

  const map = [
    { level: 0, label: "",          color: "" },
    { level: 1, label: "Débil",     color: "bg-red-500" },
    { level: 2, label: "Regular",   color: "bg-yellow-400" },
    { level: 3, label: "Buena",     color: "bg-blue-500" },
    { level: 4, label: "Excelente", color: "bg-green-500" },
  ];
  return map[score];
};

const PasswordStrengthBar = ({ password }) => {
  const strength = getStrength(password);
  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={[
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= strength.level ? strength.color : "bg-gray-200 dark:bg-gray-700",
            ].join(" ")}
          />
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs ${TXT_META}`}>
          Seguridad: <span className="font-semibold">{strength.label}</span>
        </p>
      )}
    </div>
  );
};

// ─── ChangePasswordSection ────────────────────────────────────────────────────
const ChangePasswordSection = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleReset = () =>
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const handleSave = () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      ModalManager.error?.({ title: "Campos incompletos", message: "Completa todos los campos." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      ModalManager.error?.({ title: "Error", message: "La nueva contraseña y su confirmación no coinciden." });
      return;
    }
    if (form.newPassword.length < 8) {
      ModalManager.error?.({ title: "Contraseña débil", message: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    // TODO: llamar servicio real
    ModalManager.success?.({ title: "Contraseña actualizada", message: "Tu contraseña se cambió correctamente." });
    handleReset();
  };

  const PasswordField = ({ label, fieldKey, show, onToggle, placeholder }) => (
    <div>
      <label className={LABEL_BASE}>
        <Icon name="FaLock" className="inline w-3.5 h-3.5 mr-1.5" />
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={form[fieldKey]}
          onChange={(e) => handleChange(fieldKey, e.target.value)}
          placeholder={placeholder}
          className={`${INPUT_BASE} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-theme"
        >
          <Icon name={show ? "FaEyeSlash" : "eye"} className="w-4 h-4" />
        </button>
      </div>
      {fieldKey === "newPassword" && <PasswordStrengthBar password={form.newPassword} />}
      {fieldKey === "confirmPassword" && form.confirmPassword && form.newPassword !== form.confirmPassword && (
        <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden.</p>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
            <Icon name="FaLock" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
            Cambiar contraseña
          </h2>
          <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
            Usa una contraseña segura de al menos 8 caracteres.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <PasswordField
            label="Contraseña actual"
            fieldKey="currentPassword"
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            placeholder="Tu contraseña actual"
          />
        </div>

        <div className="col-span-12 md:col-span-6" /> {/* spacer */}

        <div className="col-span-12 md:col-span-6">
          <PasswordField
            label="Nueva contraseña"
            fieldKey="newPassword"
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <PasswordField
            label="Confirmar nueva contraseña"
            fieldKey="confirmPassword"
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            placeholder="Repite la nueva contraseña"
          />
        </div>
      </div>

      {/* Hint de requisitos */}
      <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
        <p className={`text-xs font-semibold ${TXT_META} mb-2`}>Requisitos mínimos:</p>
        <ul className={`text-xs ${TXT_META} space-y-0.5`}>
          {[
            ["Al menos 8 caracteres",         form.newPassword.length >= 8],
            ["Una letra mayúscula",            /[A-Z]/.test(form.newPassword)],
            ["Un número",                      /[0-9]/.test(form.newPassword)],
            ["Un carácter especial (!@#$...)", /[^A-Za-z0-9]/.test(form.newPassword)],
          ].map(([text, met]) => (
            <li key={text} className="flex items-center gap-2">
              <Icon
                name={met ? "checkCircle" : "xCircle"}
                className={`w-3 h-3 shrink-0 ${met ? "text-green-500" : "text-gray-300 dark:text-gray-600"}`}
              />
              <span className={met ? "text-green-600 dark:text-green-400" : ""}>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <ActionButton
          label="Limpiar"
          variant="soft"
          size="sm"
          icon={<Icon name="FaEraser" />}
          onClick={handleReset}
        />
        <ActionButton
          label="Cambiar contraseña"
          variant="primary"
          size="sm"
          icon={<Icon name="FaLock" />}
          onClick={handleSave}
        />
      </div>
    </div>
  );
};

// ─── SessionCard ──────────────────────────────────────────────────────────────
const SessionCard = ({ session, onRevoke }) => (
  <div className={[
    "flex items-center justify-between gap-4 p-4 rounded-xl border transition-theme",
    session.isCurrent
      ? "border-primary-200 dark:border-primary-800/60 bg-primary-50 dark:bg-primary-900/10"
      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30",
  ].join(" ")}>
    <div className="flex items-center gap-4 min-w-0">
      {/* Device icon */}
      <div className={[
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        session.isCurrent
          ? "bg-primary-100 dark:bg-primary-900/30"
          : "bg-gray-200 dark:bg-gray-700",
      ].join(" ")}>
        <Icon
          name={session.icon}
          className={`w-5 h-5 ${session.isCurrent ? "text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400"}`}
        />
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>
            {session.device}
          </p>
          {session.isCurrent && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              Sesión actual
            </span>
          )}
        </div>
        <p className={`text-xs ${TXT_META} mt-0.5 transition-theme`}>
          {session.location} · {session.ip}
        </p>
        <p className={`text-xs ${TXT_META} transition-theme`}>
          <Icon name="clock" className="inline w-3 h-3 mr-1" />
          {session.lastActive}
        </p>
      </div>
    </div>

    {!session.isCurrent && (
      <ActionButton
        label="Revocar"
        variant="soft"
        size="xs"
        icon={<Icon name="FaTrash" />}
        onClick={() => onRevoke(session.id)}
        className="shrink-0"
      />
    )}
  </div>
);

// ─── ActiveSessionsSection ────────────────────────────────────────────────────
const ActiveSessionsSection = () => {
  const [sessions, setSessions] = useState(FAKE_SESSIONS);

  const handleRevoke = async (sessionId) => {
    try {
      const confirmed = await ModalManager.confirm?.({
        title: "Revocar sesión",
        message: "Se cerrará sesión en ese dispositivo. ¿Confirmas?",
        confirmText: "Revocar",
        cancelText: "Cancelar",
        variant: "danger",
      });
      if (confirmed) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        ModalManager.success?.({ title: "Sesión revocada", message: "El dispositivo fue desconectado." });
      }
    } catch {
      // cancelado
    }
  };

  const handleRevokeAll = async () => {
    try {
      const confirmed = await ModalManager.confirm?.({
        title: "Cerrar todas las sesiones",
        message: "Se cerrarán todas las sesiones excepto la actual. ¿Confirmas?",
        confirmText: "Cerrar todas",
        cancelText: "Cancelar",
        variant: "danger",
      });
      if (confirmed) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        ModalManager.success?.({ title: "Sesiones cerradas", message: "Todos los demás dispositivos fueron desconectados." });
      }
    } catch {
      // cancelado
    }
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
            <Icon name="FaDesktop" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
            Sesiones activas
          </h2>
          <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
            {sessions.length} {sessions.length === 1 ? "dispositivo conectado" : "dispositivos conectados"}.
          </p>
        </div>

        {otherSessions.length > 0 && (
          <ActionButton
            label="Cerrar todas"
            variant="soft"
            size="sm"
            icon={<Icon name="FaTrash" />}
            onClick={handleRevokeAll}
          />
        )}
      </div>

      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} onRevoke={handleRevoke} />
        ))}
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────
const UserProfileSecurity = () => (
  <div className="space-y-6">
    <ChangePasswordSection />
    <ActiveSessionsSection />
  </div>
);

export default UserProfileSecurity;