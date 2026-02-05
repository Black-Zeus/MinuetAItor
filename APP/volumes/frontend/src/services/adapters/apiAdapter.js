// ====================================
// Adaptador actualizado para API real
// ====================================

/**
 * Mapeo de roles de códigos a nombres legibles
 */
const ROLE_NAMES = {
    'ADMIN': 'Administrador',
    'WAREHOUSE_MANAGER': 'Jefe de Bodega',
    'SUPERVISOR': 'Supervisor',
    'SALES_PERSON': 'Vendedor',
    'CASHIER': 'Cajero',
    'ACCOUNTANT': 'Contador',
    'VIEWER': 'Consultor'
};

/**
 * Mapeo de permisos a nombres legibles (muestra)
 */
const PERMISSION_NAMES = {
    'MENU_ADMIN': 'Menú Administración',
    'USER_MENU_ADMIN': 'Administrar Usuarios',
    'WAREHOUSE_ADMIN': 'Administrar Bodegas',
    'WAREHOUSE_ACCESS_READ': 'Ver Acceso Bodegas',
    'WAREHOUSE_ACCESS_WRITE': 'Modificar Acceso Bodegas',
    'WAREHOUSE_ZONE_READ': 'Ver Zonas de Bodega',
    'WAREHOUSE_ZONE_WRITE': 'Modificar Zonas',
    'RETURNS_VIEW': 'Ver Devoluciones',
    'RETURNS_CREATE': 'Crear Devoluciones',
    'RETURNS_PROCESS': 'Procesar Devoluciones',
    'RETURNS_APPROVE': 'Aprobar Devoluciones'
};

/**
 * Convierte usuario de API a formato de componente
 */
export const adaptApiUserToComponent = (apiUser) => {
    return {
        // IDs y campos básicos
        id: apiUser.id,
        username: apiUser.username,
        email: apiUser.email,

        // Nombres (mapeo snake_case → camelCase)
        fullName: apiUser.full_name,
        firstName: apiUser.first_name,
        lastName: apiUser.last_name,
        initials: apiUser.initials,

        // Contacto
        phone: apiUser.phone,

        // Estado (mapeo is_active → isActive y status)
        isActive: apiUser.is_active,
        status: apiUser.is_active ? 'online' : 'inactive',

        // Roles - convertir códigos a nombres legibles
        rolesCodes: apiUser.roles || [],
        roles: (apiUser.roles || []).map(roleCode => ROLE_NAMES[roleCode] || roleCode),

        // Permisos
        permissions: apiUser.permissions || [],
        permissionNames: (apiUser.permissions || []).map(permCode =>
            PERMISSION_NAMES[permCode] || permCode
        ),

        // Campos temporales con mock data (hasta que endpoints estén listos)
        warehouses: ["Acceso por configurar"],
        warehouseAccess: [],

        // Avatar
        avatar: null,

        // Fechas
        createdAt: apiUser.created_at,
        updatedAt: apiUser.updated_at,
        lastLogin: apiUser.last_login || null, // A solicitar al backend

        // Métricas calculadas
        profileCompleteness: calculateProfileCompleteness(apiUser),
        securityScore: calculateSecurityScore(apiUser),

        // Campos específicos de API
        displayName: apiUser.display_name,
        isAuthenticated: apiUser.is_authenticated,
        pettyCashLimit: apiUser.petty_cash_limit,
        hasPettyCashAccess: apiUser.has_petty_cash_access,
        isRecentlyActive: apiUser.is_recently_active
    };
};

/**
 * Calcula completitud de perfil
 */
const calculateProfileCompleteness = (apiUser) => {
    let score = 0;
    const requiredFields = [
        apiUser.first_name,
        apiUser.last_name,
        apiUser.email,
        apiUser.username
    ];

    const optionalFields = [
        apiUser.phone
    ];

    // Campos requeridos (80% del score)
    requiredFields.forEach(field => {
        if (field && field.trim()) score += 20;
    });

    // Campos opcionales (20% del score)  
    optionalFields.forEach(field => {
        if (field && field.trim()) score += 20;
    });

    return Math.min(score, 100);
};

/**
 * Calcula score de seguridad
 */
const calculateSecurityScore = (apiUser) => {
    let score = 50; // Base score

    if (apiUser.phone) score += 15;
    if (apiUser.is_recently_active) score += 15;
    if (apiUser.permissions?.length > 0) score += 10;
    if (apiUser.roles?.length > 0) score += 10;

    return Math.min(score, 100);
};

/**
 * Adapta estadísticas de API
 */
export const adaptApiStatsToComponent = (apiData) => {
    const users = apiData.users || [];

    return {
        totalUsers: apiData.total_found || users.length,
        activeUsers: apiData.active_count || users.filter(u => u.is_active).length,
        inactiveUsers: (apiData.total_found || users.length) - (apiData.active_count || 0),
        newUsersThisMonth: calculateNewUsersThisMonth(users),
        lastLoginToday: apiData.recent_login_count || 0,
        adminUsers: users.filter(u => u.roles?.includes('ADMIN')).length,
        managerUsers: users.filter(u => u.roles?.includes('WAREHOUSE_MANAGER')).length,
        regularUsers: users.filter(u => !u.roles?.includes('ADMIN') && !u.roles?.includes('WAREHOUSE_MANAGER')).length
    };
};

/**
 * Calcula usuarios nuevos este mes
 */
const calculateNewUsersThisMonth = (users) => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    return users.filter(user => {
        if (!user.created_at) return false;
        const created = new Date(user.created_at);
        return created.getMonth() === thisMonth && created.getFullYear() === thisYear;
    }).length;
};

/**
 * Convierte usuario de componente para envío a API
 */
export const adaptComponentUserToApi = (componentUser) => {
    return {
        username: componentUser.username,
        email: componentUser.email,
        first_name: componentUser.firstName,
        last_name: componentUser.lastName,
        phone: componentUser.phone || null,
        is_active: componentUser.isActive
        // roles y permissions se manejarán en endpoints separados
    };
};

/**
 * Hook para manejo de datos de usuarios
 */
export const useUsersData = () => {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsers = async (filters = {}) => {
        try {
            setLoading(true);

            const params = new URLSearchParams({
                skip: filters.skip || 0,
                limit: filters.limit || 100,
                active_only: filters.active_only ?? true,
                ...(filters.search && { search: filters.search })
            });

            const response = await fetch(`/api/users/?${params}`);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const apiData = await response.json();

            if (!apiData.success) {
                throw new Error(apiData.message || 'Error en la respuesta de la API');
            }

            // Adaptar datos
            const adaptedUsers = apiData.data.users.map(adaptApiUserToComponent);
            const adaptedStats = adaptApiStatsToComponent(apiData.data);

            setUsers(adaptedUsers);
            setStats(adaptedStats);
            setError(null);

            return { users: adaptedUsers, stats: adaptedStats };

        } catch (err) {
            setError(err.message);
            console.error('Error fetching users:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        users,
        stats,
        loading,
        error,
        fetchUsers,
        refreshUsers: () => fetchUsers()
    };
};