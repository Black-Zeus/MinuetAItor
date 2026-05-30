import { isAdmin } from "@/utils/authz";

export const computeInitials = (value, fallback = "?") => {
  const text = String(value ?? "").trim();
  if (!text) return fallback;

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return text.substring(0, 2).toUpperCase();
};

export const buildSessionDisplayData = (user, profile = {}) => {
  if (!user) return null;

  const fullName = user.full_name || user.username || "Usuario";
  const position = user.job_title ?? null;

  return {
    userId: user.user_id,
    username: user.username,
    fullName,
    email: user.email,
    isActive: user.is_active,
    initials: profile.initials ?? computeInitials(fullName, "U"),
    color: profile.color ?? null,
    department: profile.department ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    job_title: position,
    position,
    description: user.description ?? null,
    phone: user.phone ?? null,
    area: user.area ?? null,
  };
};

export const buildSidebarUser = (userDisplay, authz = {}) => ({
  initials: userDisplay?.initials || "?",
  avatar: userDisplay?.avatarUrl || null,
  name: userDisplay?.fullName || userDisplay?.username || "Usuario",
  email: userDisplay?.email || "",
  role: userDisplay?.position || authz?.roles?.[0] || "Sin rol",
  isAdmin: isAdmin(authz),
});
