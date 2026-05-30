import React, { useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import useSessionStore from "@/store/sessionStore";
import { isAdmin as isAdminAuthz } from "@/utils/authz";
import TeamsModal, { TEAMS_MODAL_MODES } from "./TeamsModal";
import teamsService from "@/services/teamsService";
import axiosInstance from "@/services/axiosInterceptor";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";

const teamsLog = logger.scope("teams");

const serializeClientProjects = (clientProjects = {}) => {
  const clients = [];
  const projects = [];

  Object.entries(clientProjects).forEach(([clientId, selection]) => {
    if (!selection?.clientEnabled) return;
    clients.push(clientId);
    const projectSet = selection.projects instanceof Set ? selection.projects : new Set(selection.projects ?? []);
    projectSet.forEach((projectId) => projects.push(projectId));
  });

  return { clients, projects };
};

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
    } catch (error) {
      teamsLog.error("[ChangePasswordModal] Error:", error);
      toastError(
        error?.response?.data?.error?.message ??
        error?.message ??
        "No se pudo actualizar la contraseña."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Cambio de contraseña para
        </p>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {userName ?? "Usuario"}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nueva contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-11 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
          >
            <Icon name={showPassword ? "FaEyeSlash" : "FaEye"} className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo / Observación</label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Ej: Reset por solicitud del usuario"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400"
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-2 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          Actualizar contraseña
        </button>
      </div>
    </div>
  );
};

const TeamsViewActions = ({ id, summary = null, onUpdated, onDeleted, buttonClassName = "w-full" }) => {
  const [loadingDetail, setLoadingDetail] = useState(false);
  const isAdmin = useSessionStore((state) => isAdminAuthz(state.authz));

  const fetchDetail = async () => {
    setLoadingDetail(true);
    try {
      return await teamsService.getById(id);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleView = async () => {
    let detail;
    try {
      detail = await fetchDetail();
    } catch (error) {
      teamsLog.error("[TeamsViewActions] Error cargando detalle:", error);
      toastError("No se pudo cargar el detalle del usuario.");
      return;
    }

    ModalManager.show({
      type: "custom",
      title: "Detalle de Usuario",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.VIEW}
          data={detail}
          onClose={() => ModalManager.closeAll?.()}
        />
      ),
    });
  };

  const handleEdit = async () => {
    let detail;
    try {
      detail = await fetchDetail();
    } catch (error) {
      teamsLog.error("[TeamsViewActions] Error cargando detalle:", error);
      toastError("No se pudo cargar el detalle del usuario.");
      return;
    }

    ModalManager.show({
      type: "custom",
      title: "Editar Usuario",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.EDIT}
          data={detail}
          onSubmit={async (formData) => teamsService.update(id, toApiPayload(formData))}
          onSaved={async (updated) => {
            onUpdated?.(updated);
          }}
          onClose={() => ModalManager.closeAll?.()}
        />
      ),
    });
  };

  const handleDelete = async () => {
    const confirmed = await ModalManager.confirm({
      title: `¿Eliminar a "${summary?.name ?? id}"?`,
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
    } catch (error) {
      teamsLog.error("[TeamsViewActions] Error eliminando:", error);
      toastError("No se pudo eliminar el usuario.");
    }
  };

  const handleChangePassword = () => {
    ModalManager.show({
      type: "custom",
      title: "Cambiar Contraseña",
      size: "medium",
      showFooter: false,
      content: (
        <ChangePasswordModal
          userId={id}
          userName={summary?.name}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  return (
    <div className={`grid gap-2 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="eye" />}
        tooltip="Ver detalle del usuario"
        onClick={handleView}
        className={buttonClassName}
        disabled={loadingDetail}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaEdit" />}
        tooltip="Editar usuario"
        onClick={handleEdit}
        className={buttonClassName}
        disabled={loadingDetail}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="FaTrash" />}
        tooltip="Eliminar usuario"
        onClick={handleDelete}
        className={buttonClassName}
        disabled={loadingDetail}
      />
      {isAdmin ? (
        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="FaKey" />}
          tooltip="Cambiar contraseña"
          onClick={handleChangePassword}
          className={`${buttonClassName} text-amber-600 dark:text-amber-400`}
          disabled={loadingDetail}
        />
      ) : null}
    </div>
  );
};

export default TeamsViewActions;
