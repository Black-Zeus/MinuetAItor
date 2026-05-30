/**
 * UserProfileSecurity.jsx
 * Tab de Seguridad: Cambiar contraseña.
 */

import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { toastSuccess } from "@/components/common/toast/toastHelpers";
import { ModalManager } from "@/components/ui/modal";
import { changePassword } from "@/services/authService";

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

const getStrength = (pwd) => {
  if (!pwd) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const map = [
    { level: 0, label: "", color: "" },
    { level: 1, label: "Débil", color: "bg-red-500" },
    { level: 2, label: "Regular", color: "bg-yellow-400" },
    { level: 3, label: "Buena", color: "bg-blue-500" },
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

const PasswordField = ({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  showStrength = false,
  showMismatch = false,
}) => (
  <div>
    <label className={LABEL_BASE}>
      <Icon name="FaLock" className="inline w-3.5 h-3.5 mr-1.5" />
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    {showStrength ? <PasswordStrengthBar password={value} /> : null}
    {showMismatch ? (
      <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden.</p>
    ) : null}
  </div>
);

const ChangePasswordSection = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasChanges = Boolean(form.currentPassword || form.newPassword || form.confirmPassword);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const handleReset = () => setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const handleSave = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      ModalManager.error?.({ title: "Campos incompletos", message: "Completa todos los campos." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      ModalManager.error?.({
        title: "Error",
        message: "La nueva contraseña y su confirmación no coinciden.",
      });
      return;
    }
    if (form.newPassword.length < 8) {
      ModalManager.error?.({
        title: "Contraseña débil",
        message: "La contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: "Confirmar cambio de contraseña",
      message:
        "Vas a actualizar la contraseña de tu cuenta. Asegúrate de recordarla antes de continuar.",
      confirmText: "Cambiar contraseña",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    let loadingModalId = null;
    try {
      setIsSubmitting(true);
      loadingModalId = ModalManager.loading({
        title: "Procesando cambio de contraseña",
        message: "Estamos actualizando tu contraseña de forma segura. No cierres esta ventana.",
        indeterminate: true,
        showProgress: false,
        showCancel: false,
      });

      await changePassword({
        current_password: form.currentPassword,
        new_password: form.newPassword,
        confirm_password: form.confirmPassword,
        revoke_sessions: false,
      });

      if (loadingModalId) {
        ModalManager.close?.(loadingModalId);
        loadingModalId = null;
      }

      toastSuccess(
        "Contraseña actualizada",
        "Tu contraseña se cambió correctamente.",
        { autoClose: 4500, toastId: "profile-password-changed" }
      );
      ModalManager.success?.({
        title: "Contraseña actualizada",
        message: "Tu contraseña se cambió correctamente.",
        autoClose: 3500,
      });
      handleReset();
    } catch (error) {
      if (loadingModalId) {
        ModalManager.close?.(loadingModalId);
        loadingModalId = null;
      }
      ModalManager.error?.({
        title: "No se pudo cambiar la contraseña",
        message: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            value={form.currentPassword}
            onChange={(value) => handleChange("currentPassword", value)}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            placeholder="Tu contraseña actual"
          />
        </div>

        <div className="col-span-12 md:col-span-6" />

        <div className="col-span-12 md:col-span-6">
          <PasswordField
            label="Nueva contraseña"
            value={form.newPassword}
            onChange={(value) => handleChange("newPassword", value)}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            placeholder="Mínimo 8 caracteres"
            showStrength
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <PasswordField
            label="Confirmar nueva contraseña"
            value={form.confirmPassword}
            onChange={(value) => handleChange("confirmPassword", value)}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            placeholder="Repite la nueva contraseña"
            showMismatch={Boolean(form.confirmPassword && form.newPassword !== form.confirmPassword)}
          />
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
        <p className={`text-xs font-semibold ${TXT_META} mb-2`}>Requisitos mínimos:</p>
        <ul className={`text-xs ${TXT_META} space-y-0.5`}>
          {[
            ["Al menos 8 caracteres", form.newPassword.length >= 8],
            ["Una letra mayúscula", /[A-Z]/.test(form.newPassword)],
            ["Un número", /[0-9]/.test(form.newPassword)],
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
          disabled={isSubmitting || !hasChanges}
        />
        <ActionButton
          label="Cambiar contraseña"
          variant="primary"
          size="sm"
          icon={<Icon name="FaLock" />}
          onClick={handleSave}
          disabled={isSubmitting || !hasChanges}
        />
      </div>
    </div>
  );
};

const UserProfileSecurity = () => (
  <div className="space-y-6">
    <ChangePasswordSection />
  </div>
);

export default UserProfileSecurity;
