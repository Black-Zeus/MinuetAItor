import TeamsCards from './TeamsCards';

const TeamsGrid = ({ users, sortBy, onSortChange }) => {
  const handleSortChange = (e) => {
    onSortChange(e.target.value);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Mostrando <span className="font-semibold text-gray-900">{users.length}</span> usuarios
        </p>
        <div className="flex items-center gap-3">
          <select 
            value={sortBy}
            onChange={handleSortChange}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name-asc">Ordenar: Nombre A-Z</option>
            <option value="name-desc">Ordenar: Nombre Z-A</option>
            <option value="date-created">Ordenar: Fecha de alta</option>
            <option value="last-activity">Ordenar: Última actividad</option>
          </select>
        </div>
      </div>

      <TeamsCards users={users} />
    </div>
  );
};

export default TeamsGrid;