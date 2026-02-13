import Icon from '@/components/ui/icon/iconManager';

// Subcomponente: Tarjeta individual de usuario
const TeamsCard = ({ user }) => {
  const getColorClass = (color) => {
    const colors = {
      purple: 'from-purple-500 to-purple-600',
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      orange: 'from-orange-500 to-orange-600',
      pink: 'from-pink-500 to-pink-600'
    };
    return colors[color] || colors.blue;
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      admin: 'bg-purple-100 text-purple-700',
      write: 'bg-blue-100 text-blue-700',
      read: 'bg-green-100 text-green-700'
    };
    return classes[role] || classes.read;
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: 'FaUserShield',
      write: 'FaPen',
      read: 'FaEye'
    };
    return icons[role] || icons.read;
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      write: 'Escritura',
      read: 'Lectura'
    };
    return labels[role] || 'Lectura';
  };

  const getRoleDescription = (role) => {
    const descriptions = {
      admin: 'Acceso total al sistema',
      write: 'Crear y editar contenido',
      read: 'Solo visualización'
    };
    return descriptions[role] || 'Solo visualización';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 overflow-hidden group">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${getColorClass(user.color)} rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0`}>
              {user.initials}
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                {user.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{user.position}</p>
            </div>
          </div>
          <span className={`px-2 py-1 ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} text-xs font-medium rounded-full`}>
            {user.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Icon name="FaEnvelope" className="text-gray-400" />
          <span>{user.email}</span>
        </div>
      </div>

      {/* Rol del Sistema */}
      <div className="p-5 pt-4 pb-4 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Rol del Sistema</span>
          <span className={`px-2.5 py-1 ${getRoleBadgeClass(user.systemRole)} text-xs font-semibold rounded-md flex items-center gap-1.5`}>
            <Icon name={getRoleIcon(user.systemRole)} />
            {getRoleLabel(user.systemRole)}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{getRoleDescription(user.systemRole)}</span>
            <Icon 
              name="FaCheckCircle" 
              className={user.systemRole === 'admin' ? 'text-purple-600' : user.systemRole === 'write' ? 'text-blue-600' : 'text-green-600'} 
            />
          </div>
        </div>
      </div>

      {/* Asignaciones */}
      <div className="p-5 pt-4 pb-4 border-t border-gray-200">
        <div className="mb-3">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Asignaciones</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Clientes asignados</span>
            <span className="font-semibold text-gray-900">{user.clients}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Proyectos asignados</span>
            <span className="font-semibold text-gray-900">{user.projects}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 pt-3 pb-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Icon name="FaCalendarPlus" className="text-gray-400" />
            Alta: {user.createdAt}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <Icon name="FaEye" className="text-xs" />
            Ver Detalles
          </button>
          <button className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg transition-colors">
            <Icon name="FaEllipsisVertical" className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente principal: Grid de tarjetas
const TeamsCards = ({ users }) => {
  return (
    <div className="grid grid-cols-3 gap-5">
      {users.map((user) => (
        <TeamsCard key={user.id} user={user} />
      ))}
    </div>
  );
};

export default TeamsCards;