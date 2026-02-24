/**
 * TeamsCard.jsx + TeamsCards.jsx
 * Card individual de team member.
 * Patrón: render con summary, fetchDetail on-demand para View/Edit, mutación optimista.
 */

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";

import TeamsModal, { TEAMS_MODAL_MODES } from "@/pages/teams/TeamsModal";
import teamsService from "@/services/teamsService";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";
import useSessionStore from "@/store/sessionStore";
import axiosInstance from "@/services/axiosInterceptor";

import logger from "@/utils/logger";
const teamsLog = logger.scope("teams");

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";
const INPUT_BASE =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors placeholder-gray-400 dark:placeholder-gray-500";
const LABEL_BASE = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

const normalizeRole = (role) => (role ? String(role).toUpperCase() : "read");

const COLOR_MAP = {
  blue: "from-blue-500 to-blue-700",
  green: "from-green-500 to-green-700",
  purple: "from-purple-500 to-purple-700",
  red: "from-red-500 to-red-700",
  orange: "from-orange-500 to-orange-700",
  teal: "from-teal-500 to-teal-700",
};

const getColorClass = (color) =>
  COLOR_MAP[String(color || "blue").toLowerCase()] ?? COLOR_MAP.blue;

const getStatusColor = (status) =>
  status === "active"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";

const getStatusText = (status) =>
  status === "active" ? "Activo" : "Inactivo";

const getRoleBadge = (role) => {
  const r = normalizeRole(role);
  if (r === "ADMIN") return { label: "Administrador", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (r === "EDITOR") return { label: "Editor", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  return { label: "Lector", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" };
};

// ─── Serializa clientProjects → { clients: string[], projects: string[] } ─────
const serializeClientProjects = (clientProjects = {}) => {
  const clients = [];
  const projects = [];

  Object.entries(clientProjects).forEach(([clientId, sel]) => {
    if (!sel?.clientEnabled) return;
    clients.push(clientId);
    const prSet = sel.projects instanceof Set ? sel.projects : new Set(sel.projects ?? []);
    prSet.forEach((pid) => projects.push(pid));
  });

  return { clients, projects };
};

// ─── Mapeo payload Update ─────────────────────────────────────────────────────
const toApiPayload = (formData) => {
  const { clients, projects } = serializeClientProjects(formData.clientProjects);

  const payload = {
    username: formData.username ?? undefined,
    name: formData.name ?? undefined,
    phone: formData.phone || null,
    position: formData.position || null,
    department: formData.department || null,
    initials: formData.initials || null,
    color: formData.color || null,
    notes: formData.notes || null,
    systemRole: formData.systemRole ?? undefined,
    assignmentMode: formData.assignmentMode ?? undefined,
    clients,
    projects,
  };

  const emailChanged = formData.email !== formData.emailOriginal;
  if (emailChanged && formData.email) {
    payload.email = formData.email;
  }

  return payload;
};

// ─── ChangePasswordModal ──────────────────────────────────────────────────────
// Componente interno del modal de cambio de contraseña por admin.

const ChangePasswordModal = ({ userId, userName, onClose }) => {
  const [newPassword, setNewPassword] = useState("");
  const [reason, setReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword.trim()) {
      toastError("Debes ingresar una nueva contraseña.");
      return;
    }
    if (!reason.trim()) {
      toastError("Debes ingresar un motivo u observación.");
      return;
    }
    if (newPassword.length < 6) {
      toastError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post("/v1/auth/change-password-by-admin", {
        user_id: userId,
        new_password: newPassword,
        reason: reason.trim(),
      });
      toastSuccess("Contraseña actualizada exitosamente.");
      onClose();
    } catch (err) {
      teamsLog.error("[ChangePasswordModal] Error:", err);
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        "No se pudo actualizar la contraseña.";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Usuario objetivo */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <Icon name="FaUserShield" className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />
        <div>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">
            Cambio de contraseña para
          </p>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {userName ?? "Usuario"}
          </p>
        </div>
      </div>

      {/* Nueva contraseña */}
      <div>
        <label className={LABEL_BASE}>
          <Icon name="FaLock" className="inline w-3.5 h-3.5 mr-1.5" />
          Nueva contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className={`${INPUT_BASE} pr-11`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <Icon name={showPassword ? "FaEyeSlash" : "FaEye"} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Motivo / Observación */}
      <div>
        <label className={LABEL_BASE}>
          <Icon name="FaCommentAlt" className="inline w-3.5 h-3.5 mr-1.5" />
          Motivo / Observación <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Reset por solicitud del usuario, acceso de emergencia..."
          rows={3}
          className={INPUT_BASE}
        />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          <Icon name="FaKey" className="w-3.5 h-3.5" />
          Actualizar contraseña
        </button>
      </div>
    </div>
  );
};

// ─── TeamsCard ────────────────────────────────────────────────────────────────

const TeamsCard = ({ id, summary = null, onUpdated, onDeleted }) => {
  const [loadingDetail, setLoadingDetail] = useState(false);

  const base = useMemo(() => summary ?? {}, [summary]);
  const role = getRoleBadge(base?.systemRole);

  // Detectar si el usuario conectado es administrador
  const isAdmin = useSessionStore((s) =>
    Array.isArray(s.authz?.roles) && s.authz.roles.includes("ADMIN")
  );

  // ── fetchDetail on-demand ────────────────────────────────────────────────

  const fetchDetail = async () => {
    setLoadingDetail(true);
    try {
      return await teamsService.getById(id);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── View ─────────────────────────────────────────────────────────────────

  const handleView = async () => {
    let detail;
    try {
      detail = await fetchDetail();
    } catch (err) {
      teamsLog.error("[TeamsCard] Error cargando detalle:", err);
      toastError("No se pudo cargar el detalle del usuario.");
      return;
    }

    ModalManager.show({
      type: "custom",
      title: "Detalle de Usuario",
      size: "large",
      showFooter: false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.VIEW}
          data={detail}
          onSubmit={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  // ── Edit ─────────────────────────────────────────────────────────────────

  const handleEdit = async () => {
    let detail;
    try {
      detail = await fetchDetail();
    } catch (err) {
      teamsLog.error("[TeamsCard] Error cargando detalle:", err);
      toastError("No se pudo cargar el detalle del usuario.");
      return;
    }

    ModalManager.show({
      type: "custom",
      title: "Editar Usuario",
      size: "large",
      showFooter: false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.EDIT}
          data={detail}
          onSubmit={async (formData) => {
            const payload = toApiPayload(formData);
            teamsLog.log("[TeamsCard] Actualizando usuario:", payload);
            const updated = await teamsService.update(id, payload);
            onUpdated?.(updated);
            toastSuccess("Usuario actualizado exitosamente.");
            ModalManager.closeAll();
          }}
        />
      ),
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const confirmed = await ModalManager.confirm({
      title: `¿Eliminar a "${base?.name ?? id}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      await teamsService.softDelete(id);
      onDeleted?.(id);
      toastSuccess("Usuario eliminado correctamente.");
    } catch (err) {
      teamsLog.error("[TeamsCard] Error eliminando:", err);
      toastError("No se pudo eliminar el usuario.");
    }
  };

  // ── Change Password (admin only) ──────────────────────────────────────────

  const handleChangePassword = () => {
    ModalManager.show({
      type: "custom",
      title: "Cambiar Contraseña",
      size: "medium",
      showFooter: false,
      content: (
        <ChangePasswordModal
          userId={id}
          userName={base?.name}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all overflow-hidden flex flex-col h-full">

      {/* ── HEADER (altura fija) ───────────────────────────────────────── */}
      <div className="p-5 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-11 h-11 bg-gradient-to-br ${getColorClass(base?.color)} rounded-full flex items-center justify-center text-white font-semibold text-base flex-shrink-0`}
            >
              {base?.initials ?? "—"}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold ${TXT_TITLE} truncate transition-theme leading-tight`}>
                {base?.name ?? "—"}
              </h3>
              {/* Cargo: siempre ocupa 1 línea (vacío si no hay) */}
              <p className={`text-sm ${TXT_META} truncate transition-theme mt-0.5 h-5`}>
                {base?.position ?? ""}
              </p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(base?.status)}`}>
            {getStatusText(base?.status)}
          </span>
        </div>
      </div>

      {/* ── BODY (flexible, siempre misma altura mínima) ──────────────── */}
      <div className="p-5 flex-1 flex flex-col gap-3">

        {/* Email */}
        <div className={`flex items-center gap-2 text-sm ${TXT_BODY} transition-theme`}>
          <Icon name="FaEnvelope" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
          <span className="truncate">{base?.email ?? "—"}</span>
        </div>

        {/* Rol del sistema */}
        <div className="flex items-center h-6">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${role.cls}`}>
            {role.label}
          </span>
        </div>

        {/* Departamento: siempre ocupa 1 línea para no desplazar el footer */}
        <div className={`flex items-center gap-2 text-sm ${TXT_META} transition-theme h-5`}>
          {base?.department ? (
            <>
              <Icon name="FaBuilding" className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{base.department}</span>
            </>
          ) : (
            <span className="opacity-0 select-none">·</span>
          )}
        </div>

        {/* Spacer para empujar la fecha al fondo del body */}
        <div className="flex-1" />

        {/* Fecha de alta */}
        <div className={`flex items-center gap-2 text-sm ${TXT_META} transition-theme`}>
          <Icon name="FaCalendarPlus" className="w-4 h-4 flex-shrink-0" />
          <span>
            Alta:{" "}
            {base?.createdAt
              ? new Date(base.createdAt).toLocaleDateString("es-CL")
              : "—"}
          </span>
        </div>
      </div>

      {/* ── FOOTER (altura fija) ───────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className={`grid gap-2 place-items-center ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            tooltip="Ver detalle del usuario"
            onClick={handleView}
            className="w-full"
            disabled={loadingDetail}
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaEdit" />}
            tooltip="Editar usuario"
            onClick={handleEdit}
            className="w-full"
            disabled={loadingDetail}
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="FaTrash" />}
            tooltip="Eliminar usuario"
            onClick={handleDelete}
            className="w-full"
            disabled={loadingDetail}
          />
          {isAdmin && (
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="FaKey" />}
              tooltip="Cambiar contraseña"
              onClick={handleChangePassword}
              className="w-full text-amber-600 dark:text-amber-400"
              disabled={loadingDetail}
            />
          )}
        </div>
      </div>

    </div>
  );
};

// ─── TeamsCards (grid wrapper) ────────────────────────────────────────────────

const TeamsCards = ({ users = [], onUpdated, onDeleted }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
    {users.map((u) => (
      <TeamsCard
        key={u.id}
        id={u.id}
        summary={u}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    ))}
  </div>
);

export default TeamsCards;
export { TeamsCard };