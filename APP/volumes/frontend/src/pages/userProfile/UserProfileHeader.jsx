/**
 * UserProfileHeader.jsx
 * Header del perfil: avatar, nombre, badges, último acceso + acciones globales
 * Alineado al patrón de ProjectHeader / ClientHeader
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Helpers ────────────────────────────────────────────────────────────────
const getRoleConfig = (role) => {
  const map = {
    admin: {
      label: "Admin",
      icon: "FaUserShield",
      cls: "bg-primary-100 dark:bg-primary-900/25 text-primary-700 dark:text-primary-200",
    },
    write: {
      label: "Editor",
      icon: "FaPen",
      cls: "bg-blue-100 dark:bg-blue-900/25 text-blue-700 dark:text-blue-200",
    },
    read: {
      label: "Lectura",
      icon: "FaEye",
      cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
    },
  };
  return map[role] || map.read;
};

const getStatusConfig = (status) => {
  const map = {
    active: {
      label: "Activo",
      icon: "checkCircle",
      cls: "bg-green-100 dark:bg-green-900/25 text-green-700 dark:text-green-200",
    },
    inactive: {
      label: "Inactivo",
      icon: "ban",
      cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    },
  };
  return map[status] || map.active;
};

// ─── Subcomponents ──────────────────────────────────────────────────────────

const Badge = ({ icon, label, cls }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-white/10 transition-theme ${cls}`}
  >
    <Icon name={icon} className="w-3 h-3" />
    {label}
  </span>
);

const AvatarBlock = ({ profile, onChangeAvatar, onRemoveAvatar }) => {
  const roleConfig   = getRoleConfig(profile?.role);
  const statusConfig = getStatusConfig(profile?.status);

  return (
    <div className="flex items-center gap-5">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-16 h-16 rounded-2xl overflow-hidden ring-4 ring-primary-500/20 bg-gradient-to-br from-primary-600 to-primary-700">
          <img
            src={profile?.avatar || "/images/noImage.png"}
            alt={profile?.fullName || "Avatar"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <p className={`text-xl font-bold leading-tight ${TXT_TITLE} transition-theme`}>
            {profile?.fullName || "Usuario"}
          </p>

          {/* Cambiar avatar */}
          <label
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-white/10
                       bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300
                       hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-theme"
          >
            <Icon name="FaCamera" className="w-3 h-3" />
            Cambiar avatar
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={onChangeAvatar}
            />
          </label>

          <button
            type="button"
            onClick={onRemoveAvatar}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-white/10
                       bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400
                       hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400
                       transition-theme"
          >
            <Icon name="FaTrash" className="w-3 h-3" />
            Eliminar
          </button>
        </div>

        <p className={`text-sm ${TXT_BODY} mt-1 transition-theme`}>{profile?.email}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge icon={roleConfig.icon}   label={roleConfig.label}   cls={roleConfig.cls} />
          <Badge icon={statusConfig.icon} label={statusConfig.label} cls={statusConfig.cls} />
        </div>
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const UserProfileHeader = ({
  profile,
  onSave,
  onDiscard,
  onChangeAvatar,
  onRemoveAvatar,
}) => (
  <div className="space-y-4">
    {/* Page title row */}
    <div className="flex items-center justify-between gap-6">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaGear" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Mi Perfil
        </h1>
        <p className={`${TXT_BODY} mt-1 transition-theme`}>
          Configura tu información personal, credenciales y preferencias de cuenta.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <ActionButton
          label="Descartar"
          variant="soft"
          size="md"
          icon={<Icon name="rotateLeft" />}
          onClick={onDiscard}
        />
        <ActionButton
          label="Guardar"
          variant="primary"
          size="md"
          icon={<Icon name="FaFloppyDisk" />}
          onClick={onSave}
        />
      </div>
    </div>

    {/* Avatar card */}
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      <div className="flex items-center justify-between gap-6">
        <AvatarBlock
          profile={profile}
          onChangeAvatar={onChangeAvatar}
          onRemoveAvatar={onRemoveAvatar}
        />

        {/* Último acceso */}
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 transition-theme shrink-0">
          <p className={`text-xs font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
            <Icon name="clock" className="w-3.5 h-3.5" />
            Último acceso
          </p>
          <p className={`${TXT_TITLE} mt-1 font-medium transition-theme`}>
            {profile?.lastConection}
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default UserProfileHeader;