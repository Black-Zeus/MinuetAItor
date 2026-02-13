import Icon from '@/components/ui/icon/iconManager';

const TeamsHeader = ({ onNewUser }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de usuarios y permisos del sistema</p>
        </div>
        <button 
          onClick={onNewUser}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Icon name="FaUserPlus" className="text-sm" />
          Nuevo Usuario
        </button>
      </div>
    </div>
  );
};

export default TeamsHeader;