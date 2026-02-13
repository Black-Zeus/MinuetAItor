import { useState, useMemo } from 'react';
import TeamsHeader from './TeamsHeader';
import TeamsStats from './TeamsStats';
import TeamsFilters from './TeamsFilters';
import TeamsGrid from './TeamsGrid';
import TeamsModal from './TeamsModal';
import teamsData from '@/data/dataTeams.json';

const Teams = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    systemRole: '',
    client: ''
  });
  const [sortBy, setSortBy] = useState('name-asc');

  // Cargar usuarios del JSON
  const allUsers = teamsData.teams;

  // Calcular estadísticas
  const stats = useMemo(() => {
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const inactiveUsers = allUsers.filter(u => u.status === 'inactive').length;
    const admins = allUsers.filter(u => u.systemRole === 'admin').length;

    return {
      total: allUsers.length,
      active: activeUsers,
      inactive: inactiveUsers,
      admins: admins
    };
  }, [allUsers]);

  // Formatear usuarios para el display
  const formattedUsers = useMemo(() => {
    return allUsers.map(user => {
      // Calcular clientes y proyectos
      let clientsText = 'Todos';
      let projectsText = 'Todos';

      if (user.assignmentMode === 'specific') {
        const clientCount = user.clients.length;
        const projectCount = user.projects.length;
        clientsText = clientCount > 0 ? `${clientCount}` : 'Ninguno';
        projectsText = projectCount > 0 ? `${projectCount}` : 'Ninguno';
      }

      // Formatear fecha
      const createdDate = new Date(user.createdAt);
      const formattedDate = createdDate.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });

      return {
        ...user,
        clients: clientsText,
        projects: projectsText,
        createdAt: formattedDate
      };
    });
  }, [allUsers]);

  // Aplicar filtros
  const filteredUsers = useMemo(() => {
    return formattedUsers.filter(user => {
      // Filtro de búsqueda
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.position.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtro de estado
      if (filters.status && user.status !== filters.status) {
        return false;
      }

      // Filtro de rol del sistema
      if (filters.systemRole && user.systemRole !== filters.systemRole) {
        return false;
      }

      // Filtro de cliente (solo para usuarios con asignación específica)
      if (filters.client) {
        if (user.assignmentMode === 'all') {
          return true; // Usuarios con "todos" pasan el filtro
        }
        if (!user.clients.includes(filters.client)) {
          return false;
        }
      }

      return true;
    });
  }, [formattedUsers, filters]);

  // Aplicar ordenamiento
  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];

    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'date-created':
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'last-activity':
        sorted.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        break;
      default:
        break;
    }

    return sorted;
  }, [filteredUsers, sortBy]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFilterChange = (newFilters) => {
    setFilters({ ...filters, ...newFilters });
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      systemRole: '',
      client: ''
    });
  };

  const handleSortChange = (value) => {
    setSortBy(value);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6">
      <TeamsHeader onNewUser={handleOpenModal} />
      
      <TeamsStats stats={stats} />
      
      <TeamsFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
      
      <TeamsGrid 
        users={sortedUsers}
        sortBy={sortBy}
        onSortChange={handleSortChange}
      />

      <TeamsModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default Teams;