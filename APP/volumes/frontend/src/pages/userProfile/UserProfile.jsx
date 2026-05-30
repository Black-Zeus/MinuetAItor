/**
 * UserProfile.jsx
 */

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import UserProfileTabNav from "./UserProfileTabNav";
import UserProfileHeader from "./UserProfileHeader";
import UserProfilePersonalData from "./UserProfilePersonalData";
import UserProfileSecurity from "./UserProfileSecurity";
import UserProfileSessions from "./UserProfileSessions";
import UserProfileNotifications from "./UserProfileNotifications";
import UserProfileCustomization from "./UserProfileCustomization";

import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import { ModalManager } from "@/components/ui/modal";
import useSessionStore from "@store/sessionStore";
import { deleteMyAvatar, uploadMyAvatar } from "@/services/authService";

import logger from '@/utils/logger';
const usrProfLog = logger.scope("user-profile");
const VALID_TABS = new Set(["profile", "security", "sessions", "notifications", "customization"]);

// ─── Mapeo store → shape que espera el form ───────────────────────────────────
// El form usa camelCase y nombres propios del UI.
// El store usa snake_case igual que el backend.
const sessionToForm = (user, profile) => ({
  fullName: user?.full_name ?? "",   // user.full_name   → campo "Nombre completo"
  position: user?.job_title ?? "",   // user.job_title   → campo "Cargo"
  department: profile?.department ?? "",  // profile.department → campo "Departamento"
  avatar: profile?.avatarUrl ?? null,
  notes: user?.description ?? "",   // user.description → campo "Notas"
  phone: user?.phone ?? "",                          // no viene del backend aún — solo local
  area: user?.area ?? "",                          // no viene del backend aún — solo local
});

// ─── Mapeo inverso form → body del PATCH /users/me ───────────────────────────
// Cuando el usuario guarde, necesitas enviar esto al backend.
// (Por ahora solo loguea — conectar al endpoint cuando esté disponible)
const formToRequest = (formData) => ({
  full_name: formData.fullName,
  job_title: formData.position,
  description: formData.notes,
  department: formData.department,
  phone: formData.phone,
  area: formData.area,
});

const comparableProfile = (formData) => ({
  fullName: String(formData?.fullName ?? ""),
  position: String(formData?.position ?? ""),
  department: String(formData?.department ?? ""),
  notes: String(formData?.notes ?? ""),
  phone: String(formData?.phone ?? ""),
  area: String(formData?.area ?? ""),
});

// ─── Componente ───────────────────────────────────────────────────────────────
const UserProfile = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(VALID_TABS.has(initialTab) ? initialTab : "profile");

  // ── 1. Leer del store con selectores ────────────────────────────────────────
  // Cada selector suscribe el componente SOLO a esa propiedad.
  // Si cambia user, re-renderiza. Si cambia solo profile.color, también.
  const storeUser = useSessionStore((s) => s.user);
  const storeProfile = useSessionStore((s) => s.profile);
  const isLoading = useSessionStore((s) => s.isLoading);

  // ── 2. Form state local ──────────────────────────────────────────────────────
  // Los datos del form son una COPIA local — no escriben directo al store.
  // Se inicializan con lo que ya haya en el store (del login).
  const [formData, setFormData] = useState(() =>
    sessionToForm(storeUser, storeProfile)
  );
  const [pendingAvatar, setPendingAvatar] = useState({
    action: null,
    file: null,
    previewUrl: null,
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const clearPendingAvatar = () => {
    setPendingAvatar((current) => {
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { action: null, file: null, previewUrl: null };
    });
  };

  // ── 3. Forzar refresco al entrar al módulo ───────────────────────────────────
  // loadFromApi(true) ignora el cache de 5 min y hace GET /auth/me
  // Se llama con .getState() porque estamos dentro de useEffect, no en render
  useEffect(() => {
    useSessionStore.getState().loadFromApi(true);
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab && activeTab !== "profile") {
      setActiveTab("profile");
      return;
    }
    if (VALID_TABS.has(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [activeTab, searchParams]);

  const handleTabChange = (tab) => {
    if (!VALID_TABS.has(tab)) return;
    setActiveTab(tab);
    setSearchParams(tab === "profile" ? {} : { tab });
  };

  // ── 4. Re-sincronizar form cuando el store se actualiza ──────────────────────
  // Después del fetch, storeUser y storeProfile cambian → este efecto se dispara
  // → el form muestra los datos frescos del servidor
  useEffect(() => {
    if (storeUser) {
      setFormData(sessionToForm(storeUser, storeProfile));
    }
  }, [storeUser, storeProfile]);

  useEffect(() => () => {
    if (pendingAvatar.previewUrl) URL.revokeObjectURL(pendingAvatar.previewUrl);
  }, [pendingAvatar.previewUrl]);


  // ── Handlers ─────────────────────────────────────────────────────────────────
  const hasProfileChanges = JSON.stringify(comparableProfile(formData)) !== JSON.stringify(
    comparableProfile(sessionToForm(storeUser, storeProfile))
  ) || Boolean(pendingAvatar.action);

  const handleProfileChange = (updated) => setFormData(updated);

  // Restablecer = volver al estado actual del store (no del servidor)
  const handleReset = () => {
    clearPendingAvatar();
    setFormData(sessionToForm(storeUser, storeProfile));
  };
  
  const handleSave = async () => {
    if (!hasProfileChanges || isSavingProfile) return;
    const body = formToRequest(formData);
    usrProfLog.log("[UserProfile] PATCH /users/me →", body);
    // TODO: await userService.updateMe(body)

    try {
      setIsSavingProfile(true);

      if (pendingAvatar.action === "upload" && pendingAvatar.file) {
        await uploadMyAvatar(pendingAvatar.file);
      } else if (pendingAvatar.action === "delete") {
        await deleteMyAvatar();
      }

      clearPendingAvatar();
      await useSessionStore.getState().loadFromApi(true);

      ModalManager.success?.({
        title: "Perfil actualizado",
        message: "Los cambios del perfil se guardaron correctamente.",
      });
    } catch (error) {
      usrProfLog.error("[UserProfile] save error", error);
      ModalManager.error?.({
        title: "No se pudo guardar el perfil",
        message: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangeAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingAvatar((current) => {
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { action: "upload", file, previewUrl };
    });
    setFormData((prev) => ({ ...prev, avatar: previewUrl }));
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    setPendingAvatar((current) => {
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { action: "delete", file: null, previewUrl: null };
    });
    setFormData((prev) => ({ ...prev, avatar: null }));
  };

  if (isLoading) return <PageLoadingSpinner message="Cargando perfil..." />;

  return (
    <div className="space-y-6">

      <UserProfileHeader
        profile={formData}
        onChangeAvatar={handleChangeAvatar}
        onRemoveAvatar={handleRemoveAvatar}
        canEditAvatar={activeTab === "profile"}
      />

      <UserProfileTabNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {activeTab === "profile" && (
        <UserProfilePersonalData
          profile={formData}
          onChange={handleProfileChange}
          onSave={handleSave}
          onReset={handleReset}
          hasChanges={hasProfileChanges}
          isSaving={isSavingProfile}
        />
      )}

      {activeTab === "security" && <UserProfileSecurity />}

      {activeTab === "sessions" && <UserProfileSessions />}

      {activeTab === "notifications" && <UserProfileNotifications />}

      {activeTab === "customization" && <UserProfileCustomization />}

    </div>
  );
};

export default UserProfile;
