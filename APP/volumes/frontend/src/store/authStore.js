/**
 * stores/authStore.js
 * Store de autenticación con Zustand - ACTUALIZADO CON USERSERVICE
 * Maneja tokens, user info, estado de login/logout, persistencia y perfil de usuario
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { shouldLog } from '@/utils/environment';
import { getMyProfile, transformProfileData } from '@/services/userService';

// ==========================================
// STORAGE KEYS
// ==========================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  AUTH_STATE: 'auth_state',
  USER_PROFILE: 'user_profile'
};

// ==========================================
// INITIAL STATE
// ==========================================

const initialState = {
  // Auth tokens
  accessToken: null,
  refreshToken: null,

  // User information
  user: null,
  userProfile: null, // ✅ NUEVO: Perfil completo del usuario

  // Auth status
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  // Profile loading status
  isProfileLoading: false, // ✅ NUEVO: Estado de carga del perfil
  profileLoadError: null,  // ✅ NUEVO: Errores de carga del perfil
  profileLastFetch: null,  // ✅ NUEVO: Timestamp de última carga

  // Login session info
  sessionInfo: null,
  loginTimestamp: null,

  // Error handling
  lastError: null
};

// ==========================================
// AUTH STORE
// ==========================================

const useAuthStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // ==========================================
      // ACTIONS - LOGIN
      // ==========================================

      /**
       * Configura el estado después de un login exitoso
       * @param {Object} loginResponse - Respuesta del login del backend
       */
      login: (loginResponse) => {
        const { data } = loginResponse;

        if (!data?.access_token || !data?.user_info) {
          throw new Error('Invalid login response format');
        }

        const authState = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: data.user_info,
          isAuthenticated: true,
          isLoading: false,
          sessionInfo: data.session_info || null,
          loginTimestamp: new Date().toISOString(),
          lastError: null,
          // Reset profile state on new login
          userProfile: null,
          profileLastFetch: null,
          profileLoadError: null
        };

        // Guardar tokens en localStorage separadamente (para axios interceptor)
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        if (data.refresh_token) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        }
        localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(data.user_info));

        // Actualizar el store
        set(authState);

        if (shouldLog()) {
          console.log('✅ Auth state updated after login');
        }

        // Auto-cargar perfil después del login
        get().loadUserProfile();
      },

      // ==========================================
      // ACTIONS - LOGOUT
      // ==========================================

      /**
       * Limpia el estado de autenticación
       * @param {string} reason - Razón del logout (opcional)
       */
      logout: (reason = 'Manual logout') => {
        if (shouldLog()) {
          console.log(`🚪 Logging out: ${reason}`);
        }

        // Limpiar localStorage
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });

        // Reset del store
        set({
          ...initialState,
          isInitialized: true
        });
      },

      // ==========================================
      // ACTIONS - USER PROFILE (NUEVAS)
      // ==========================================

      /**
       * Cargar perfil completo del usuario desde el backend
       * @param {boolean} forceRefresh - Forzar recarga aunque ya esté cargado
       */
      loadUserProfile: async (forceRefresh = false) => {
        const state = get();
        
        // No cargar si no está autenticado
        if (!state.isAuthenticated || !state.user) {
          return;
        }

        // No cargar si ya está cargando
        if (state.isProfileLoading) {
          return;
        }

        // Verificar si necesita recarga (cache de 5 minutos)
        const cacheTime = 5 * 60 * 1000; // 5 minutos
        const now = new Date().getTime();
        const lastFetch = state.profileLastFetch ? new Date(state.profileLastFetch).getTime() : 0;
        
        if (!forceRefresh && state.userProfile && (now - lastFetch) < cacheTime) {
          if (shouldLog()) {
            console.log('📋 Using cached user profile');
          }
          return;
        }

        // Iniciar carga
        set({
          isProfileLoading: true,
          profileLoadError: null
        });

        try {
          if (shouldLog()) {
            console.log('📋 Loading user profile...');
          }

          const response = await getMyProfile();
          const transformedProfile = transformProfileData(response);

          set({
            userProfile: transformedProfile,
            isProfileLoading: false,
            profileLoadError: null,
            profileLastFetch: new Date().toISOString()
          });

          // Guardar en localStorage para persistencia
          localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(transformedProfile));

          if (shouldLog()) {
            console.log('✅ User profile loaded successfully');
          }

        } catch (error) {
          if (shouldLog()) {
            console.error('❌ Failed to load user profile:', error);
          }

          set({
            isProfileLoading: false,
            profileLoadError: error.message || 'Error al cargar perfil'
          });
        }
      },

      /**
       * Actualizar datos del perfil en el store después de una modificación
       * @param {Object} updatedData - Datos actualizados
       */
      updateUserProfile: (updatedData) => {
        const currentProfile = get().userProfile;
        
        if (!currentProfile) {
          return;
        }

        const updatedProfile = {
          ...currentProfile,
          ...updatedData,
          updatedAt: new Date().toISOString()
        };

        set({
          userProfile: updatedProfile,
          profileLastFetch: new Date().toISOString()
        });

        // Actualizar en localStorage
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));

        if (shouldLog()) {
          console.log('✅ User profile updated in store');
        }
      },

      /**
       * Limpiar datos del perfil
       */
      clearUserProfile: () => {
        set({
          userProfile: null,
          profileLastFetch: null,
          profileLoadError: null,
          isProfileLoading: false
        });

        localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);

        if (shouldLog()) {
          console.log('🧹 User profile cleared from store');
        }
      },

      // ==========================================
      // ACTIONS - TOKEN MANAGEMENT
      // ==========================================

      /**
       * Actualiza tokens después de un refresh
       * @param {Object} newTokens - Nuevos tokens
       */
      updateTokens: (newTokens) => {
        const { access_token, refresh_token } = newTokens;

        const tokenState = {
          accessToken: access_token,
          ...(refresh_token && { refreshToken: refresh_token }),
          lastError: null
        };

        // Actualizar localStorage
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
        if (refresh_token) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
        }

        // Actualizar store
        set(tokenState);

        if (shouldLog()) {
          console.log('🔄 Tokens updated in store');
        }
      },

      /**
       * Marcar como iniciado desde storage
       */
      initFromStorage: async () => {
        try {
          const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          const userInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO);
          const userProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);

          if (accessToken && userInfo) {
            const parsedUser = JSON.parse(userInfo);
            const parsedProfile = userProfile ? JSON.parse(userProfile) : null;

            set({
              accessToken,
              refreshToken,
              user: parsedUser,
              userProfile: parsedProfile,
              isAuthenticated: true,
              isInitialized: true,
              profileLastFetch: parsedProfile?.profileLastFetch || null
            });

            if (shouldLog()) {
              console.log('🔄 Auth state restored from storage');
            }

            // Cargar perfil si no está en cache o es muy viejo
            if (!parsedProfile) {
              get().loadUserProfile();
            }
          } else {
            set({ isInitialized: true });
          }
        } catch (error) {
          console.error('Error initializing auth from storage:', error);
          get().logout('Storage initialization error');
        }
      },

      // ==========================================
      // GETTERS / COMPUTED VALUES (ACTUALIZADOS)
      // ==========================================

      /**
       * Verifica si el usuario tiene un rol específico
       * @param {string|Array} role - Rol(es) a verificar
       * @returns {boolean}
       */
      hasRole: (role) => {
        const userProfile = get().userProfile;
        const userRoles = userProfile?.roles || get().user?.roles || [];
        
        if (Array.isArray(role)) {
          return role.some(r => userRoles.includes(r));
        }
        
        return userRoles.includes(role);
      },

      /**
       * Verifica si el usuario tiene un permiso específico
       * @param {string|Array} permission - Permiso(s) a verificar
       * @returns {boolean}
       */
      hasPermission: (permission) => {
        const userProfile = get().userProfile;
        const userPermissions = userProfile?.permissions || get().user?.permissions || [];
        
        if (Array.isArray(permission)) {
          return permission.some(p => userPermissions.includes(p));
        }
        
        return userPermissions.includes(permission);
      },

      /**
       * Verifica si el usuario tiene cualquiera de los permisos dados
       * @param {Array<string>} permissions - Lista de permisos
       * @returns {boolean}
       */
      hasAnyPermission: (permissions) => {
        const userProfile = get().userProfile;
        const userPermissions = userProfile?.permissions || get().user?.permissions || [];
        
        if (!userPermissions || !Array.isArray(userPermissions)) return false;

        return permissions.some(permission =>
          userPermissions.includes(permission)
        );
      },

      /**
       * Verifica si el usuario tiene roles específicos
       * @param {Array<string>} roles - Lista de roles
       * @returns {boolean}
       */
      hasAnyRole: (roles) => {
        const userProfile = get().userProfile;
        const userRoles = userProfile?.roles || get().user?.roles || [];
        
        if (!userRoles || !Array.isArray(userRoles)) return false;

        return roles.some(role => userRoles.includes(role));
      },

      /**
       * Verifica si el usuario es admin
       * @returns {boolean}
       */
      isAdmin: () => {
        const userProfile = get().userProfile;
        return userProfile?.hasAdminRole || get().hasRole(['ADMIN', 'ADMINISTRATOR']);
      },

      /**
       * Verifica si el usuario es manager
       * @returns {boolean}
       */
      isManager: () => {
        const userProfile = get().userProfile;
        return userProfile?.hasManagerRole || get().hasRole(['MANAGER', 'SUPERVISOR']);
      },

      /**
       * Obtiene información de display del usuario
       * @returns {Object} Información para mostrar
       */
      getUserDisplay: () => {
        const userProfile = get().userProfile;
        const basicUser = get().user;
        
        if (userProfile) {
          return {
            id: userProfile.id,
            username: userProfile.username,
            displayName: userProfile.displayName,
            fullName: userProfile.fullName,
            initials: userProfile.initials,
            email: userProfile.email,
            isActive: userProfile.isActive,
            roles: userProfile.roleNames || [],
            lastLogin: userProfile.lastLoginAt
          };
        }
        
        if (basicUser) {
          return {
            id: basicUser.id,
            username: basicUser.username,
            displayName: basicUser.full_name || `${basicUser.first_name} ${basicUser.last_name}`,
            fullName: basicUser.full_name,
            initials: `${basicUser.first_name?.charAt(0) || ''}${basicUser.last_name?.charAt(0) || ''}`,
            email: basicUser.email,
            isActive: basicUser.is_active,
            roles: basicUser.roles || [],
            lastLogin: basicUser.last_login_at
          };
        }
        
        return null;
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionInfo: state.sessionInfo,
        loginTimestamp: state.loginTimestamp,
        userProfile: state.userProfile,
        profileLastFetch: state.profileLastFetch
      })
    }
  )
);

// ==========================================
// SELECTORS OPTIMIZADOS (ACTUALIZADOS)
// ==========================================

export const authSelectors = {
  // Basic auth
  isAuthenticated: (state) => state.isAuthenticated,
  isLoading: (state) => state.isLoading,
  user: (state) => state.user,
  userProfile: (state) => state.userProfile, // ✅ NUEVO
  isProfileLoading: (state) => state.isProfileLoading, // ✅ NUEVO
  
  // Display info
  userDisplay: (state) => state.getUserDisplay(),
  
  // Status
  needsLogin: (state) => 
    !state.isAuthenticated || 
    !(state.accessToken && state.refreshToken),

  // Error
  lastError: (state) => state.lastError,
  profileLoadError: (state) => state.profileLoadError, // ✅ NUEVO

  // Session
  sessionInfo: (state) => state.sessionInfo
};

// ==========================================
// HOOKS HELPERS (ACTUALIZADOS)
// ==========================================

/**
 * Hook para usar auth con selectors optimizados
 * @param {Function} selector - Selector function (opcional)
 */
export const useAuth = (selector = null) => {
  if (selector) {
    return useAuthStore(selector);
  }
  return useAuthStore();
};

/**
 * Hook específico para verificar autenticación
 */
export const useIsAuthenticated = () => {
  return useAuthStore(authSelectors.isAuthenticated);
};

/**
 * Hook específico para info del usuario
 */
export const useUser = () => {
  return useAuthStore(authSelectors.user);
};

/**
 * Hook específico para perfil completo del usuario
 */
export const useUserProfile = () => {
  return useAuthStore(authSelectors.userProfile);
};

/**
 * Hook específico para display del usuario
 */
export const useUserDisplay = () => {
  return useAuthStore(authSelectors.userDisplay);
};

/**
 * Hook específico para estado de carga del perfil
 */
export const useProfileLoading = () => {
  return useAuthStore(authSelectors.isProfileLoading);
};

// ==========================================
// EXPORT POR DEFECTO 
// ==========================================

export default useAuthStore;