/**
 * TeamsCards.jsx
 * Tarjeta individual de usuario + grid de tarjetas
 * Alineado visualmente con ProjectCard.jsx (dark mode, transiciones, tipografías)
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";
import TeamsModal, { TEAMS_MODAL_MODES } from "@/pages/teams/TeamsModal";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const TeamsCard = ({ user }) => {
  const getColorClass = (color) => {
    const colors = {
      purple: "from-purple-500 to-purple-600",
      blue: "from-blue-500 to-blue-600",
      green: "from-green-500 to-green-600",
      orange: "from-orange-500 to-orange-600",
      pink: "from-pink-500 to-pink-600",
    };
    return colors[color] || colors.blue;
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
      inactive: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400",
    };
    return colors[status] || colors.active;
  };

  const getStatusText = (status) => {
    const texts = { active: "Activo", inactive: "Inactivo" };
    return texts[status] || status;
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      admin: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
      write: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
      read: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    };
    return classes[role] || classes.read;
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: "FaUserShield",
      write: "FaPen",
      read: "FaEye",
    };
    return icons[role] || icons.read;
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: "Administrador",
      write: "Escritura",
      read: "Lectura",
    };
    return labels[role] || "Lectura";
  };

  const getRoleDescription = (role) => {
    const descriptions = {
      admin: "Acceso total al sistema",
      write: "Crear y editar contenido",
      read: "Solo visualización",
    };
    return descriptions[role] || "Solo visualización";
  };

  const getRoleCheckColor = (role) => {
    const map = {
      admin: "text-purple-600 dark:text-purple-400",
      write: "text-blue-600 dark:text-blue-400",
      read: "text-green-600 dark:text-green-400",
    };
    return map[role] || map.read;
  };


  // ✅ NUEVO: Ver (VIEW)
  const handleViewUser = () => {
    ModalManager.show({
      type: "custom",
      title: "Detalles del Usuario",
      size: "large",
      showFooter: false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.VIEW}
          data={user}
          onClose={() => { }}
          onSubmit={() => { }}
        />
      ),
    });
  };

  // ✅ NUEVO: Editar (EDIT)
  const handleEditUser = () => {
    ModalManager.show({
      type: "custom",
      title: "Editar Usuario",
      size: "large",
      showFooter: false,
      content: (
        <TeamsModal
          mode={TEAMS_MODAL_MODES.EDIT}
          data={user}
          onClose={() => { }}
          onSubmit={(payload) => {
            onEdit?.(payload);

            ModalManager.success({
              title: "Usuario actualizado",
              message: "Los cambios han sido guardados exitosamente.",
            });
          }}
        />
      ),
    });
  };

  const handleDeleteUSer = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar el Equipo "${user.name}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        variant: "danger",
      });

      if (confirmed) console.log("[TeamsCard] Eliminación Equipo" + user.id);
    } catch (error) {
      console.error(error);
      console.log("[TeamsCard] Eliminación cancelada");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`w-12 h-12 bg-gradient-to-br ${getColorClass(
                user.color
              )} rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0`}
              aria-label="Avatar"
            >
              {user.initials}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold ${TXT_TITLE} truncate transition-theme`}>
                {user.name}
              </h3>

              <p className={`text-sm ${TXT_META} truncate transition-theme`}>
                {user.position}
              </p>
            </div>
          </div>

          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
              user.status
            )} flex-shrink-0`}
          >
            {getStatusText(user.status)}
          </span>
        </div>

        {/* Email */}
        <div className={`flex items-center gap-2 text-sm ${TXT_BODY} transition-theme mb-4`}>
          <Icon name="FaEnvelope" className={`${TXT_META} w-4 h-4`} />
          <span className="truncate">{user.email}</span>
        </div>

        {/* Rol del sistema */}
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${TXT_META} transition-theme`}>
              Rol del Sistema
            </span>

            <span
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 ${getRoleBadgeClass(
                user.systemRole
              )}`}
            >
              <Icon name={getRoleIcon(user.systemRole)} className="w-3.5 h-3.5" />
              {getRoleLabel(user.systemRole)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-sm ${TXT_BODY} transition-theme`}>
              {getRoleDescription(user.systemRole)}
            </span>
            <Icon name="FaCheckCircle" className={`w-4 h-4 ${getRoleCheckColor(user.systemRole)}`} />
          </div>
        </div>

        {/* Asignaciones */}
        <div className="mb-4">
          <span className={`text-xs font-semibold uppercase tracking-wide ${TXT_META} transition-theme`}>
            Asignaciones
          </span>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${TXT_BODY} transition-theme`}>Clientes asignados</span>
              <span className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>
                {user.clients}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-sm ${TXT_BODY} transition-theme`}>Proyectos asignados</span>
              <span className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>
                {user.projects}
              </span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mb-4">
          <div className={`flex items-center gap-2 text-sm ${TXT_META} transition-theme`}>
            <Icon name="FaCalendarPlus" className="w-4 h-4" />
            <span>Alta: {user.createdAt}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme max-h-[40px] flex flex-col">
          <div className="grid grid-cols-3 gap-2 mt-auto w-full place-items-center">
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="eye" />}
              tooltip="Abrir vista detalle del proyecto"
              onClick={handleViewUser}
              className="w-full"
            />
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="FaEdit" />}
              tooltip="Editar proyecto"
              onClick={handleEditUser}
              className="w-full"
            />
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="FaTrash" />}
              tooltip="Eliminar proyecto"
              onClick={handleDeleteUSer}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const TeamsCards = ({ users }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {users.map((user) => (
        <TeamsCard key={user.id} user={user} />
      ))}
    </div>
  );
};

export default TeamsCards;