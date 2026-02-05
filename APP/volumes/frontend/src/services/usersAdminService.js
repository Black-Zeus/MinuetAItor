/**
 * services/usersAdminService.js
 * Servicio para administración de usuarios - Operaciones CRUD
 * Integrado con apiAdapter para transformación de datos
 */

import api from '@/services/axiosInterceptor';
import { API_ENDPOINTS } from '@/constants';
import { parseError, getFormattedError } from '@/utils/errors';
import { shouldLog } from '@/utils/environment';
import {
    adaptApiUserToComponent,
    adaptApiStatsToComponent,
    adaptComponentUserToApi
} from '@/services/adapters/apiAdapter';

// ==========================================
// USERS ADMIN SERVICE CLASS
// ==========================================

class UsersAdminService {

    // ==========================================
    // READ OPERATIONS
    // ==========================================

    /**
     * Obtener lista de usuarios con filtros y paginación
     * @param {Object} options - Opciones de consulta
     * @param {number} options.skip - Registros a saltar (paginación)
     * @param {number} options.limit - Límite de registros
     * @param {boolean} options.active_only - Solo usuarios activos
     * @param {string} options.search - Búsqueda por texto
     * @param {string} options.role_filter - Filtro por rol
     * @param {boolean} options.include_inactive - Incluir usuarios inactivos
     * @returns {Promise<Object>} Lista de usuarios adaptada y estadísticas
     */
    async getUsers(options = {}) {
        try {
            if (shouldLog()) {
                console.log('👥 Fetching users list...', options);
            }

            // Construir parámetros de query
            const params = new URLSearchParams({
                skip: options.skip || 0,
                limit: options.limit || 1000,
                active_only: options.active_only ?? false,
                ...(options.search && { search: options.search }),
                ...(options.role_filter && { role_filter: options.role_filter }),
                ...(options.include_inactive && { include_inactive: options.include_inactive })
            });

            const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/?${params}`);

            if (response.data?.success && response.data?.data) {
                const apiData = response.data.data;

                // Adaptar usuarios usando el adaptador
                const adaptedUsers = apiData.users.map(adaptApiUserToComponent);

                // Adaptar estadísticas
                const adaptedStats = adaptApiStatsToComponent(apiData);

                const result = {
                    users: adaptedUsers,
                    stats: adaptedStats,
                    pagination: {
                        skip: apiData.pagination?.skip || 0,
                        limit: apiData.pagination?.limit || 100,
                        total: apiData.total_found || 0,
                        currentPage: Math.floor((apiData.pagination?.skip || 0) / (apiData.pagination?.limit || 100)) + 1,
                        totalPages: Math.ceil((apiData.total_found || 0) / (apiData.pagination?.limit || 100))
                    },
                    filters: apiData.filters_applied || {},
                    meta: response.data.meta || {}
                };

                if (shouldLog()) {
                    console.log(`✅ Users fetched: ${adaptedUsers.length} users`);
                }

                return result;

            } else {
                throw new Error('Invalid users response format');
            }

        } catch (error) {
            const formattedError = getFormattedError(error);

            if (shouldLog()) {
                console.error('❌ Failed to fetch users:', formattedError);
            }

            throw formattedError;
        }
    }

    /**
     * Obtener un usuario específico por ID
     * @param {number} userId - ID del usuario
     * @returns {Promise<Object>} Datos del usuario adaptados
     */
    async getUser(userId) {
        try {
            if (shouldLog()) {
                console.log(`👤 Fetching user ID: ${userId}`);
            }

            const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/${userId}`);

            if (response.data?.success && response.data?.data) {
                const adaptedUser = adaptApiUserToComponent(response.data.data);

                if (shouldLog()) {
                    console.log(`✅ User fetched: ${adaptedUser.username}`);
                }

                return {
                    user: adaptedUser,
                    meta: response.data.meta || {}
                };

            } else {
                throw new Error('Invalid user response format');
            }

        } catch (error) {
            const formattedError = getFormattedError(error);

            if (shouldLog()) {
                console.error(`❌ Failed to fetch user ${userId}:`, formattedError);
            }

            throw formattedError;
        }
    }

    // ==========================================
    // CREATE OPERATIONS
    // ==========================================

    /**
     * Crear nuevo usuario
     * @param {Object} userData - Datos del usuario
     * @param {string} userData.username - Nombre de usuario
     * @param {string} userData.email - Email
     * @param {string} userData.firstName - Nombre
     * @param {string} userData.lastName - Apellido
     * @param {string} userData.phone - Teléfono (opcional)
     * @param {boolean} userData.isActive - Estado activo
     * @param {Array} userData.rolesCodes - Códigos de roles
     * @param {Array} userData.permissions - Permisos adicionales
     * @returns {Promise<Object>} Usuario creado
     */
    async createUser(userData) {
        try {
            if (shouldLog()) {
                console.log('👤 Creating new user...', userData.username);
            }

            // Adaptar datos del componente para la API
            const apiData = adaptComponentUserToApi(userData);

            const response = await api.post(`${API_ENDPOINTS.USERS.BASE}/`, apiData);

            if (response.data?.success && response.data?.data) {
                const adaptedUser = adaptApiUserToComponent(response.data.data);

                if (shouldLog()) {
                    console.log(`✅ User created: ${adaptedUser.username}`);
                }

                return {
                    user: adaptedUser,
                    message: response.data.message,
                    meta: response.data.meta || {}
                };

            } else {
                throw new Error('Invalid create user response format');
            }

        } catch (error) {
            const formattedError = getFormattedError(error);

            if (shouldLog()) {
                console.error('❌ Failed to create user:', formattedError);
            }

            throw formattedError;
        }
    }

    // ==========================================
    // UPDATE OPERATIONS
    // ==========================================

    /**
     * Actualizar usuario existente
     * @param {number} userId - ID del usuario
     * @param {Object} userData - Datos a actualizar
     * @returns {Promise<Object>} Usuario actualizado
     */
    async updateUser(userId, userData) {
        try {
            if (shouldLog()) {
                console.log(`👤 Updating user ID: ${userId}`);
            }

            // Adaptar datos del componente para la API
            const apiData = adaptComponentUserToApi(userData);

            const response = await api.put(`${API_ENDPOINTS.USERS.BASE}/${userId}`, apiData);

            if (response.data?.success && response.data?.data) {
                const adaptedUser = adaptApiUserToComponent(response.data.data);

                if (shouldLog()) {
                    console.log(`✅ User updated: ${adaptedUser.username}`);
                }

                return {
                    user: adaptedUser,
                    message: response.data.message,
                    meta: response.data.meta || {}
                };

            } else {
                throw new Error('Invalid update user response format');
            }

        } catch (error) {
            const formattedError = getFormattedError(error);

            if (shouldLog()) {
                console.error(`❌ Failed to update user ${userId}:`, formattedError);
            }

            throw formattedError;
        }
    }

   /**
   * Cambiar estado activo/inactivo de un usuario
   * @param {number} userId - ID del usuario
   * @param {boolean} isActive - Nuevo estado
   * @returns {Promise<Object>} Usuario actualizado
   */
    async toggleUserStatus(userId, isActive) {
        try {
            if (shouldLog()) {
                console.log(`👤 Toggling user ${userId} status to: ${isActive ? 'active' : 'inactive'}`);
            }

            // CORRECCIÓN: Usar el endpoint correcto del backend
            const response = await api.put(`${API_ENDPOINTS.USERS.BASE}/${userId}/toggle-activation`, {
                is_active: isActive
            });

            if (response.data?.success && response.data?.data) {
                const adaptedUser = adaptApiUserToComponent(response.data.data);

                if (shouldLog()) {
                    console.log(`✅ User status toggled: ${adaptedUser.username} -> ${isActive ? 'active' : 'inactive'}`);
                }

                return {
                    user: adaptedUser,
                    message: response.data.message,
                    meta: response.data.meta || {}
                };

            } else {
                throw new Error('Invalid toggle status response format');
            }

        } catch (error) {
            const formattedError = getFormattedError(error);

            if (shouldLog()) {
                console.error(`❌ Failed to toggle user ${userId} status:`, formattedError);
            }

            throw formattedError;
        }
    }

    /**
     * Cambiar contraseña de un usuario (admin)
     * @param {number} userId - ID del usuario
     * @param {Object} passwordData - Datos de la nueva contraseña
     * @param {string} passwordData.newPassword - Nueva contraseña
     * @param {string} passwordData.confirmPassword - Confirmación
     * @param {string} passwordData.reason - Motivo del cambio
     * @returns {Promise<Object>} Respuesta del cambio
     */
    async changeUserPassword(userId, passwordData) {
        try {
            if (shouldLog()) {
                console.log(`🔒 Changing password for user ID: ${userId}`);
            }

            const response = await api.put(`${API_ENDPOINTS.AUTH.CHANGE_PASSWORD_ADMIN}`, {
                target_user_id: userId,
                new_password: passwordData.newPassword,
                confirm_password: passwordData.confirmPassword,
                reason: passwordData.reason
            });

            if (response.data?.success) {
                if (shouldLog()) {
                    console.log(`✅ Password changed for user ID: ${userId}`);
                }

                return {
                    message: response.data.message,
                    meta: response.data.meta || {}
                };

            } else {
                throw new Error('Invalid password change response format');
            }

        } catch (error) {
            // Manejo similar al userService para errores de contraseña
            let errorToThrow = {
                code: 'UNKNOWN_ERROR',
                message: 'Error al cambiar la contraseña',
                status: error.response?.status || 0
            };

            if (error.response?.data) {
                const backendData = error.response.data;

                let message = backendData.message || 'Error del servidor';

                if (backendData.error?.details) {
                    const details = backendData.error.details;

                    if (typeof details === 'string' && details.startsWith('[') && details.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(details.replace(/'/g, '"'));
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                message += '\n\n' + parsed.map(item => `\t• ${item}`).join('\n');
                            }
                        } catch (parseError) {
                            message += '\n\nDetalles: ' + details;
                        }
                    } else if (Array.isArray(details) && details.length > 0) {
                        message += '\n\n' + details.map(item => `\t• ${item}`).join('\n');
                    } else if (typeof details === 'string') {
                        message += '\n\nDetalles: ' + details;
                    }
                }

                errorToThrow = {
                    code: backendData.error?.code || 'BACKEND_ERROR',
                    message: message,
                    details: backendData.error?.details || 'Sin detalles adicionales',
                    status: backendData.status || error.response.status
                };
            }

            if (shouldLog()) {
                console.error(`❌ Failed to change password for user ${userId}:`, errorToThrow);
            }

            throw errorToThrow;
        }
    }

    // ==========================================
    // DELETE OPERATIONS
    // ==========================================

    /**
     * Eliminar usuario (soft delete)
     * @param {number} userId - ID del usuario
     * @returns {Promise<Object>} Respuesta de eliminación
     */
    async deleteUser(userId) {
        try {
            if (shouldLog()) {
                console.log(`🗑️ Deleting user ID: ${userId}`);
            }

            const response = await api.delete(`${API_ENDPOINTS.USERS.BASE}/${userId}`);

            if (response.data?.success) {
                if (shouldLog()) {
                    console.log(`✅ User deleted: ID ${userId}`);
                }

                return {
                    message: response.data.message,
                    meta: response.data.meta || {}
                };

            } else {
                throw new Error('Invalid delete user response format');
            }

        } catch (error) {
            const formattedError = getFormattedError(error);

            if (shouldLog()) {
                console.error(`❌ Failed to delete user ${userId}:`, formattedError);
            }

            throw formattedError;
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Obtener estadísticas de usuarios
     * @returns {Promise<Object>} Estadísticas generales
     */
    async getUsersStats() {
        try {
            // Por ahora usar el endpoint principal con límite 0 para solo obtener stats
            const response = await this.getUsers({ limit: 0 });
            return response.stats;
        } catch (error) {
            if (shouldLog()) {
                console.error('❌ Failed to fetch users stats:', error);
            }
            throw error;
        }
    }

    /**
     * Buscar usuarios por texto
     * @param {string} searchTerm - Término de búsqueda
     * @param {number} limit - Límite de resultados
     * @returns {Promise<Array>} Lista de usuarios encontrados
     */
    async searchUsers(searchTerm, limit = 10) {
        try {
            const response = await this.getUsers({
                search: searchTerm,
                limit: limit,
                active_only: false
            });
            return response.users;
        } catch (error) {
            if (shouldLog()) {
                console.error('❌ Failed to search users:', error);
            }
            throw error;
        }
    }

    /**
     * Filtrar usuarios por rol
     * @param {string} roleCode - Código del rol
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Array>} Lista de usuarios con el rol
     */
    async getUsersByRole(roleCode, options = {}) {
        try {
            const response = await this.getUsers({
                role_filter: roleCode,
                ...options
            });
            return response.users;
        } catch (error) {
            if (shouldLog()) {
                console.error(`❌ Failed to get users by role ${roleCode}:`, error);
            }
            throw error;
        }
    }

    /**
     * Validar datos de usuario antes de enviar
     * @param {Object} userData - Datos del usuario
     * @returns {Object} Resultado de validación
     */
    validateUserData(userData) {
        const errors = {};

        // Validaciones básicas
        if (!userData.username || userData.username.trim().length < 3) {
            errors.username = 'El nombre de usuario debe tener al menos 3 caracteres';
        }

        if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
            errors.email = 'El email no tiene un formato válido';
        }

        if (!userData.firstName || userData.firstName.trim().length < 2) {
            errors.firstName = 'El nombre debe tener al menos 2 caracteres';
        }

        if (!userData.lastName || userData.lastName.trim().length < 2) {
            errors.lastName = 'El apellido debe tener al menos 2 caracteres';
        }

        if (userData.phone && !/^\+?[\d\s\-\(\)]+$/.test(userData.phone)) {
            errors.phone = 'El teléfono no tiene un formato válido';
        }

        const isValid = Object.keys(errors).length === 0;

        return {
            isValid,
            errors,
            summary: isValid ? 'Datos válidos' : `${Object.keys(errors).length} errores encontrados`
        };
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

const usersAdminService = new UsersAdminService();

// ==========================================
// CONVENIENCE METHODS (funciones directas)
// ==========================================

/**
 * Obtener lista de usuarios - función directa
 */
export const getUsers = (options) => usersAdminService.getUsers(options);

/**
 * Obtener usuario por ID - función directa
 */
export const getUser = (userId) => usersAdminService.getUser(userId);

/**
 * Crear usuario - función directa
 */
export const createUser = (userData) => usersAdminService.createUser(userData);

/**
 * Actualizar usuario - función directa
 */
export const updateUser = (userId, userData) => usersAdminService.updateUser(userId, userData);

/**
 * Cambiar estado de usuario - función directa
 */
export const toggleUserStatus = (userId, isActive) => usersAdminService.toggleUserStatus(userId, isActive);

/**
 * Cambiar contraseña de usuario - función directa
 */
export const changeUserPassword = (userId, passwordData) => usersAdminService.changeUserPassword(userId, passwordData);

/**
 * Eliminar usuario - función directa
 */
export const deleteUser = (userId) => usersAdminService.deleteUser(userId);

/**
 * Obtener estadísticas - función directa
 */
export const getUsersStats = () => usersAdminService.getUsersStats();

/**
 * Buscar usuarios - función directa
 */
export const searchUsers = (searchTerm, limit) => usersAdminService.searchUsers(searchTerm, limit);

/**
 * Filtrar por rol - función directa
 */
export const getUsersByRole = (roleCode, options) => usersAdminService.getUsersByRole(roleCode, options);

/**
 * Validar datos - función directa
 */
export const validateUserData = (userData) => usersAdminService.validateUserData(userData);

// ==========================================
// EXPORT POR DEFECTO
// ==========================================

export default usersAdminService;