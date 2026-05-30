// ====================================
// Adaptador actualizado para API real
// ====================================

import { parseAppDate } from "@/utils/formats";

/**
 * Mapeo de roles de códigos a nombres legibles
 */
const ROLE_NAMES = {
    'ADMIN': 'Administrador',
    'EDITOR': 'Editor',
    'VIEWER': 'Lector',
    'DELETER': 'Eliminador'
};

/**
 * Mapeo de permisos a nombres legibles (muestra)
 */
const PERMISSION_NAMES = {
    'records.read': 'Leer documentos',
    'records.create': 'Crear documentos',
    'records.update': 'Editar documentos',
    'records.publish': 'Publicar documentos',
    'records.soft_delete': 'Baja lógica de documentos',
    'records.hard_delete': 'Eliminación física de documentos',
    'users.manage': 'Administrar usuarios',
    'clients.manage': 'Administrar clientes',
    'audit.read': 'Leer auditoría'
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
        editorUsers: users.filter(u => u.roles?.includes('EDITOR')).length,
        viewerUsers: users.filter(u => u.roles?.includes('VIEWER')).length
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
        const created = parseAppDate(user.created_at);
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
