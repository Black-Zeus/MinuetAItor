import Icon from '@/components/ui/icon/iconManager';

const TeamsFilters = ({ filters, onFilterChange, onClearFilters }) => {
  const handleSearchChange = (e) => {
    onFilterChange({ search: e.target.value });
  };

  const handleStatusChange = (e) => {
    onFilterChange({ status: e.target.value });
  };

  const handleSystemRoleChange = (e) => {
    onFilterChange({ systemRole: e.target.value });
  };

  const handleClientChange = (e) => {
    onFilterChange({ client: e.target.value });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="FaFilter" className="text-gray-400 text-sm" />
          Filtros
        </h2>
        <button 
          onClick={onClearFilters}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Búsqueda */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Buscar</label>
          <div className="relative">
            <Icon name="FaSearch" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input 
              type="text" 
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Nombre, email o cargo..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Estado</label>
          <select 
            value={filters.status}
            onChange={handleStatusChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>

        {/* Rol del Sistema */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Rol del Sistema</label>
          <select 
            value={filters.systemRole}
            onChange={handleSystemRoleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="admin">Administrador</option>
            <option value="write">Escritura</option>
            <option value="read">Lectura</option>
          </select>
        </div>

        {/* Cliente Asignado */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Cliente</label>
          <select 
            value={filters.client}
            onChange={handleClientChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="client1">TechCorp Solutions</option>
            <option value="client2">Global Industries</option>
            <option value="client3">StartupXYZ</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default TeamsFilters;