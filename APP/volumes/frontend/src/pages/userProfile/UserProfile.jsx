/**
 * UserProfile.jsx
 */

import React, { useState, useEffect } from "react";

import UserProfileTabNav from "./UserProfileTabNav";
import UserProfileHeader from "./UserProfileHeader";
import UserProfilePersonalData from "./UserProfilePersonalData";
import UserProfileSecurity from "./UserProfileSecurity";
import UserProfileNotifications from "./UserProfileNotifications";
import UserProfileCustomization from "./UserProfileCustomization";

import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import { ModalManager } from "@/components/ui/modal";
import useSessionStore from "@store/sessionStore";

import { formatDateTimeTechnical } from "@/utils/formats"

import logger from '@/utils/logger';
const usrProfLog = logger.scope("user-profile");

// ─── Mapeo store → shape que espera el form ───────────────────────────────────
// El form usa camelCase y nombres propios del UI.
// El store usa snake_case igual que el backend.
const sessionToForm = (user, profile, connections) => ({
  fullName: user?.full_name ?? "",   // user.full_name   → campo "Nombre completo"
  position: user?.job_title ?? "",   // user.job_title   → campo "Cargo"
  department: profile?.department ?? "",  // profile.department → campo "Departamento"
  notes: user?.description ?? "",   // user.description → campo "Notas"
  phone: user?.phone ?? "",                          // no viene del backend aún — solo local
  area: user?.area ?? "",                          // no viene del backend aún — solo local
  lastConection: formatDateTimeTechnical(connections?.active?.ts ?? "")
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
  lastConection: formData.lastConection,
});

// ─── Componente ───────────────────────────────────────────────────────────────
const UserProfile = () => {
  const [activeTab, setActiveTab] = useState("profile");

  // ── 1. Leer del store con selectores ────────────────────────────────────────
  // Cada selector suscribe el componente SOLO a esa propiedad.
  // Si cambia user, re-renderiza. Si cambia solo profile.color, también.
  const storeUser = useSessionStore((s) => s.user);
  const storeProfile = useSessionStore((s) => s.profile);
  const connections = useSessionStore((s) => s.connections);
  const isLoading = useSessionStore((s) => s.isLoading);

  // ── 2. Form state local ──────────────────────────────────────────────────────
  // Los datos del form son una COPIA local — no escriben directo al store.
  // Se inicializan con lo que ya haya en el store (del login).
  const [formData, setFormData] = useState(() =>
    sessionToForm(storeUser, storeProfile, connections)
  );

  // ── 3. Forzar refresco al entrar al módulo ───────────────────────────────────
  // loadFromApi(true) ignora el cache de 5 min y hace GET /auth/me
  // Se llama con .getState() porque estamos dentro de useEffect, no en render
  useEffect(() => {
    useSessionStore.getState().loadFromApi(true);
  }, []);

  // ── 4. Re-sincronizar form cuando el store se actualiza ──────────────────────
  // Después del fetch, storeUser y storeProfile cambian → este efecto se dispara
  // → el form muestra los datos frescos del servidor
  useEffect(() => {
    if (storeUser) {
      setFormData(sessionToForm(storeUser, storeProfile, connections));
    }
  }, [storeUser, storeProfile, connections]);


  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleProfileChange = (updated) => setFormData(updated);

  // Restablecer = volver al estado actual del store (no del servidor)
  const handleReset = () => setFormData(sessionToForm(storeUser, storeProfile, connections));
  
  const handleSave = async () => {
    const body = formToRequest(formData);
    usrProfLog.log("[UserProfile] PATCH /users/me →", body);
    // TODO: await userService.updateMe(body)
    // TODO: await useSessionStore.getState().loadFromApi(true) para refrescar
    ModalManager.success?.({
      title: "Perfil actualizado",
      message: "Los datos personales se guardaron correctamente.",
    });
  };

  const handleChangeAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData((prev) => ({ ...prev, avatar: URL.createObjectURL(file) }));
  };

  const handleRemoveAvatar = () =>
    setFormData((prev) => ({ ...prev, avatar: null }));

  if (isLoading) return <PageLoadingSpinner message="Cargando perfil..." />;

  return (
    <div className="space-y-6">

      <UserProfileHeader
        profile={formData}
        onSave={handleSave}
        onDiscard={handleReset}
        onChangeAvatar={handleChangeAvatar}
        onRemoveAvatar={handleRemoveAvatar}
      />

      <UserProfileTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "profile" && (
        <UserProfilePersonalData
          profile={formData}
          onChange={handleProfileChange}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}

      {activeTab === "security" && <UserProfileSecurity />}

      {activeTab === "notifications" && <UserProfileNotifications />}

      {activeTab === "customization" && <UserProfileCustomization />}

    </div>
  );
};

export default UserProfile;