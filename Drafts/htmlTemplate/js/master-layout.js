/**
 * =====================================================
 * MinuetAItor - Master Layout JavaScript
 * Funcionalidad principal del layout
 * =====================================================
 */

// =====================================================
// INICIALIZACIÓN
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
  initSidebar();
  initHeader();
  initTheme();
  loadDefaultContent();
});

// =====================================================
// SIDEBAR FUNCTIONALITY
// =====================================================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');

  if (!sidebar || !sidebarToggle) return;

  // Toggle sidebar
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  });

  // Restaurar estado del sidebar
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }

  // Manejar navegación activa
  const menuItems = document.querySelectorAll('.sidebar-menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remover clase active de todos los items
      menuItems.forEach(i => i.classList.remove('active'));
      
      // Agregar clase active al item clickeado
      this.classList.add('active');
      
      // Actualizar título del header
      const menuText = this.querySelector('.sidebar-menu-text')?.textContent;
      if (menuText) {
        updateHeaderTitle(menuText);
      }
    });
  });
}

// =====================================================
// HEADER FUNCTIONALITY
// =====================================================
function initHeader() {
  const headerUser = document.getElementById('headerUser');
  const headerUserDropdown = document.getElementById('headerUserDropdown');
  const notificationsBtn = document.getElementById('notificationsBtn');
  const messagesBtn = document.getElementById('messagesBtn');

  if (!headerUser || !headerUserDropdown) return;

  // Toggle user dropdown
  headerUser.addEventListener('click', (e) => {
    e.stopPropagation();
    headerUserDropdown.classList.toggle('show');
    headerUser.classList.toggle('active');
  });

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!headerUser.contains(e.target)) {
      headerUserDropdown.classList.remove('show');
      headerUser.classList.remove('active');
    }
  });

  // Prevenir que los clics dentro del dropdown lo cierren
  headerUserDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Notificaciones
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
      showNotification('Panel de notificaciones - En desarrollo', 'info');
    });
  }

  // Mensajes
  if (messagesBtn) {
    messagesBtn.addEventListener('click', () => {
      showNotification('Panel de mensajes - En desarrollo', 'info');
    });
  }

  // Búsqueda
  const searchInput = document.querySelector('.header-search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value;
        if (query.trim()) {
          showNotification(`Búsqueda: "${query}" - En desarrollo`, 'info');
        }
      }
    });
  }
}

// =====================================================
// THEME FUNCTIONALITY
// =====================================================
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  if (!themeToggle) return;

  // Detectar preferencia del sistema
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');

  // Aplicar tema guardado o preferencia del sistema
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    html.classList.add('dark');
  }

  // Toggle theme
  themeToggle.addEventListener('click', () => {
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    showNotification(
      isDark ? 'Tema oscuro activado' : 'Tema claro activado', 
      'success'
    );
  });

  // Escuchar cambios en la preferencia del sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
  });
}

// =====================================================
// CONTENT LOADING
// =====================================================
function loadDefaultContent() {
  const contentContainer = document.getElementById('contentContainer');
  if (!contentContainer) return;

  // Cargar contenido por defecto
  fetch('./default-content.html')
    .then(response => {
      if (!response.ok) throw new Error('Error al cargar contenido');
      return response.text();
    })
    .then(html => {
      contentContainer.innerHTML = html;
    })
    .catch(error => {
      console.error('Error:', error);
      contentContainer.innerHTML = `
        <div class="empty-state" style="padding: var(--spacing-2xl);">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 64px; height: 64px; margin-bottom: var(--spacing-lg); opacity: 0.3;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Error al cargar el contenido</h3>
          <p style="color: var(--text-muted);">Por favor, recarga la página.</p>
        </div>
      `;
    });
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Actualizar el título del header
 */
function updateHeaderTitle(title) {
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.textContent = title;
  }

  // Actualizar breadcrumb
  const breadcrumbActive = document.querySelector('.header-breadcrumb-item.active');
  if (breadcrumbActive) {
    breadcrumbActive.textContent = title;
  }
}

/**
 * Mostrar notificación temporal
 */
function showNotification(message, type = 'info') {
  // Remover notificaciones previas
  const existingNotification = document.querySelector('.notification-toast');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Crear notificación
  const notification = document.createElement('div');
  notification.className = 'notification-toast';
  
  // Colores según tipo
  const colors = {
    success: 'var(--color-success-600)',
    error: 'var(--color-danger-600)',
    warning: 'var(--color-warning-600)',
    info: 'var(--color-info-600)'
  };

  notification.style.cssText = `
    position: fixed;
    top: calc(var(--header-height) + var(--spacing-lg));
    right: var(--spacing-lg);
    background-color: var(--bg-surface);
    color: var(--text-primary);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    border-left: 4px solid ${colors[type] || colors.info};
    z-index: var(--z-tooltip);
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
    font-size: var(--font-size-sm);
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  // Remover después de 3 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Cargar contenido dinámico
 */
function loadContent(url) {
  const contentContainer = document.getElementById('contentContainer');
  if (!contentContainer) return;

  // Mostrar indicador de carga
  contentContainer.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 400px;">
      <div style="text-align: center;">
        <div style="width: 48px; height: 48px; border: 4px solid var(--border-color); border-top-color: var(--color-primary-500); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto var(--spacing-lg);"></div>
        <p style="color: var(--text-muted);">Cargando...</p>
      </div>
    </div>
  `;

  // Cargar contenido
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Error al cargar contenido');
      return response.text();
    })
    .then(html => {
      contentContainer.innerHTML = html;
      contentContainer.scrollTop = 0;
    })
    .catch(error => {
      console.error('Error:', error);
      contentContainer.innerHTML = `
        <div class="empty-state" style="padding: var(--spacing-2xl);">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 64px; height: 64px; margin-bottom: var(--spacing-lg); opacity: 0.3;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Error al cargar el contenido</h3>
          <p style="color: var(--text-muted);">Por favor, intenta nuevamente.</p>
          <button class="btn btn-primary" onclick="loadContent('${url}')" style="margin-top: var(--spacing-lg);">
            Reintentar
          </button>
        </div>
      `;
    });
}

// =====================================================
// ANIMATIONS (CSS-in-JS)
// =====================================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// =====================================================
// EXPORT FUNCTIONS (para uso en HTML)
// =====================================================
window.MinuetAItor = {
  loadContent,
  showNotification,
  updateHeaderTitle
};