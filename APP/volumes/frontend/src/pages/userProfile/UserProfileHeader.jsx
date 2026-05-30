/**
 * UserProfileHeader.jsx
 * Header del perfil: avatar, nombre, badges y acciones globales
 * Alineado al patrón de ProjectHeader / ClientHeader
 */

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";

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

const avatarWithSize = (src, size) => {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return src;
  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("size", size);
    return `${url.pathname}${url.search}`;
  } catch {
    return src;
  }
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

const AvatarBlock = ({ profile, onChangeAvatar, onRemoveAvatar, canEditAvatar = false }) => {
  const roleConfig   = getRoleConfig(profile?.role);
  const statusConfig = getStatusConfig(profile?.status);
  const avatarSrc = profile?.avatar || "/images/noImage.png";
  const thumbnailSrc = avatarWithSize(avatarSrc, "thumb");
  const fullSrc = avatarWithSize(avatarSrc, "full");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (!isPreviewOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsPreviewOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen]);

  return (
    <div className="flex items-center gap-5">
      {/* Avatar */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsPreviewOpen(true)}
          className="w-16 h-16 rounded-2xl overflow-hidden ring-4 ring-primary-500/20 bg-gradient-to-br from-primary-600 to-primary-700 block focus:outline-none focus:ring-4 focus:ring-primary-500/40"
          title="Ver avatar"
        >
          <img
            src={thumbnailSrc}
            alt={profile?.fullName || "Avatar"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </button>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <p className={`text-xl font-bold leading-tight ${TXT_TITLE} transition-theme`}>
            {profile?.fullName || "Usuario"}
          </p>

          {canEditAvatar && (
            <>
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
            </>
          )}
        </div>

        <p className={`text-sm ${TXT_BODY} mt-1 transition-theme`}>{profile?.email}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge icon={roleConfig.icon}   label={roleConfig.label}   cls={roleConfig.cls} />
          <Badge icon={statusConfig.icon} label={statusConfig.label} cls={statusConfig.cls} />
        </div>
      </div>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Avatar"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPreviewOpen(false);
          }}
        >
          <div className="relative max-h-[88vh] max-w-[88vw] overflow-hidden rounded-xl bg-white p-2 shadow-2xl dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              aria-label="Cerrar"
            >
              <Icon name="FaXmark" className="h-4 w-4" />
            </button>
            <img
              src={fullSrc}
              alt={profile?.fullName || "Avatar"}
              className="max-h-[84vh] max-w-[84vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const UserProfileHeader = ({
  profile,
  onChangeAvatar,
  onRemoveAvatar,
  canEditAvatar = false,
}) => (
  <div className="space-y-4">
    {/* Page title row */}
    <div>
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaGear" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Mi Perfil
        </h1>
        <p className={`${TXT_BODY} mt-1 transition-theme`}>
          Configura tu información personal, credenciales y preferencias de cuenta.
        </p>
      </div>
    </div>

    {/* Avatar card */}
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      <div className="flex items-center justify-between gap-6">
        <AvatarBlock
          profile={profile}
          onChangeAvatar={onChangeAvatar}
          onRemoveAvatar={onRemoveAvatar}
          canEditAvatar={canEditAvatar}
        />
      </div>
    </div>
  </div>
);

export default UserProfileHeader;
