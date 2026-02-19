import React, { useState, useEffect } from "react";

import profileData from "@/data/dataUserProfile.json";

import UserProfileTabNav        from "./UserProfileTabNav";
import UserProfileHeader        from "./UserProfileHeader";
import UserProfilePersonalData  from "./UserProfilePersonalData";
import UserProfileSecurity      from "./UserProfileSecurity";
import UserProfileNotifications from "./UserProfileNotifications";
import UserProfileCustomization from "./UserProfileCustomization";

import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import { ModalManager }   from "@/components/ui/modal";

const UserProfile = () => {
  const [isLoading, setIsLoading]         = useState(true);
  const [activeTab, setActiveTab]         = useState("profile");
  const [profile, setProfile]             = useState(null);
  const [editedProfile, setEditedProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        await new Promise((r) => setTimeout(r, 450));
        const p = profileData.userProfile;
        setProfile(p);
        setEditedProfile({ ...p });
      } catch (err) {
        console.error("[UserProfile] Error loading data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ── Datos personales ───────────────────────────────────────────────────────
  const handleProfileChange     = (updated) => setEditedProfile(updated);
  const handleResetPersonalData = ()         => setEditedProfile({ ...profile });

  const handleSavePersonalData = () => {
    setProfile({ ...editedProfile });
    ModalManager.success?.({
      title: "Perfil actualizado",
      message: "Los datos personales se guardaron correctamente.",
    });
  };

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const handleChangeAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditedProfile((prev) => ({ ...prev, avatar: URL.createObjectURL(file) }));
  };

  const handleRemoveAvatar = () =>
    setEditedProfile((prev) => ({ ...prev, avatar: null }));

  // ── Header global ──────────────────────────────────────────────────────────
  const handleGlobalSave = () => {
    setProfile({ ...editedProfile });
    ModalManager.success?.({ title: "Cambios guardados", message: "Tu perfil se actualizó." });
  };

  const handleGlobalDiscard = () => setEditedProfile({ ...profile });

  if (isLoading) return <PageLoadingSpinner message="Cargando perfil..." />;

  return (
    <div className="space-y-6">

      <UserProfileHeader
        profile={editedProfile}
        onSave={handleGlobalSave}
        onDiscard={handleGlobalDiscard}
        onChangeAvatar={handleChangeAvatar}
        onRemoveAvatar={handleRemoveAvatar}
      />

      <UserProfileTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "profile" && (
        <UserProfilePersonalData
          profile={editedProfile}
          onChange={handleProfileChange}
          onSave={handleSavePersonalData}
          onReset={handleResetPersonalData}
        />
      )}

      {activeTab === "security" && (
        <UserProfileSecurity />
      )}

      {activeTab === "notifications" && (
        <UserProfileNotifications />
      )}

      {activeTab === "customization" && (
        <UserProfileCustomization
          initialWidgets={profile?.dashboardPreferences?.widgets ?? {}}
        />
      )}

    </div>
  );
};

export default UserProfile;