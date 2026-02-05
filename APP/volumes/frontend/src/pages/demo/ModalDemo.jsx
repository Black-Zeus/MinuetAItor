/**
 * ModalDemo.jsx
 * Demo completo que implementa todos los modales del sistema
 */

import React, { useState, useEffect } from 'react';
import ModalManager from '@/components/ui/modal';
import { dataModalRenderers } from '@/components/ui/modal/types/DataModals';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const CalendarModalContent = dataModalRenderers.calendar;

const ModalDemo = () => {
  const [demoResults, setDemoResults] = useState([]);

  useDocumentTitle("Modal Demos | Inventory App");

  // ====================================
  // CODE SNIPPETS - Código de cada modal
  // ====================================

  const codeSnippets = {
    info: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.info({
  title: 'Información del Sistema',
  message: 'El sistema realizará una actualización programada el próximo martes a las 02:00 AM.',
  onClose: () => console.log('Modal cerrado')
});`,

    confirm: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
const confirmed = await ModalManager.confirm({
  title: 'Confirmar Acción',
  message: '¿Está seguro de que desea eliminar este elemento?',
  confirmText: 'Eliminar',
  cancelText: 'Cancelar'
});
console.log(confirmed ? 'Confirmado' : 'Cancelado');`,

    success: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.success({
  title: 'Operación Completada',
  message: 'La operación se ha completado correctamente.',
  onClose: () => console.log('Éxito confirmado')
});`,

    warning: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.warning({
  title: 'Advertencia de Seguridad',
  message: 'Se ha detectado un intento de acceso no autorizado.',
  onClose: () => console.log('Advertencia vista')
});`,

    error: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.error({
  title: 'Error del Sistema',
  message: 'Se ha producido un error al conectar',
  details: [
    'Error Code: ERR_500_INTERNAL',
    'Connection timeout after 30s',
    \`Timestamp: \${new Date().toISOString()}\`
  ],
  onClose: () => console.log('Error reconocido')
});`,

    danger: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.danger({
  title: 'Acción Peligrosa',
  message: 'Esta acción eliminará permanentemente todos los datos del sistema.',
  onClose: () => console.log('Advertencia vista')
});`,

    form: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
const data = await ModalManager.form({
  title: 'Configuración de Usuario',
  fields: [
    { 
      name: 'fullName', 
      label: 'Nombre completo', 
      type: 'text', 
      required: true 
    },
    { 
      name: 'email', 
      label: 'Correo electrónico', 
      type: 'email', 
      required: true 
    },
    {
      name: 'department', 
      label: 'Departamento', 
      type: 'select', 
      required: true, 
      options: [
        { value: 'desarrollo', label: 'Desarrollo' },
        { value: 'marketing', label: 'Marketing' }
      ]
    }
  ],
  submitText: 'Guardar',
  cancelText: 'Cancelar'
});
console.log('Datos del formulario:', data);`,

    wizard: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
const data = await ModalManager.wizard({
  title: 'Asistente de Configuración',
  steps: [
    {
      title: 'Información Básica',
      description: 'Configure los datos básicos del proyecto',
      fields: [
        { 
          name: 'projectName', 
          label: 'Nombre del Proyecto', 
          type: 'text', 
          required: true 
        }
      ]
    },
    {
      title: 'Configuración Técnica',
      description: 'Seleccione las opciones técnicas',
      fields: [
        {
          name: 'type', 
          label: 'Tipo de Implementación', 
          type: 'select', 
          required: true,
          options: [
            { value: 'web', label: 'Aplicación Web' },
            { value: 'api', label: 'API Backend' }
          ]
        }
      ]
    }
  ]
});
console.log('Datos del wizard:', data);`,

    login: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
const credentials = await ModalManager.login({
  title: 'Iniciar Sesión',
  message: 'Ingrese sus credenciales para acceder al sistema',
  showRegisterLink: true,
  showForgotPassword: true,
  onRegister: () => console.log('Registro'),
  onForgotPassword: () => console.log('Recuperar contraseña')
});
console.log('Credenciales:', credentials);`,

    search: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.search({
  title: 'Búsqueda Avanzada',
  placeholder: 'Buscar productos, usuarios, documentos...',
  filters: [
    {
      name: 'category',
      label: 'Categoría',
      type: 'select',
      options: [
        { value: 'products', label: 'Productos' },
        { value: 'users', label: 'Usuarios' }
      ]
    }
  ],
  recentSearches: ['laptop', 'mouse wireless'],
  results: [
    { 
      id: 1, 
      title: 'Laptop Gaming Pro', 
      description: 'Alto rendimiento', 
      icon: '💻' 
    }
  ],
  onSearch: (query) => console.log(\`Búsqueda: "\${query}"\`),
  onResultSelect: (result) => console.log(\`Seleccionado: \${result.title}\`)
});`,

    datatable: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.datatable({
  title: 'Gestión de Usuarios',
  data: [
    { 
      id: 1, 
      name: 'Juan Pérez', 
      email: 'juan@empresa.com', 
      status: 'Activo' 
    }
  ],
  columns: [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'email', label: 'Email', sortable: true }
  ],
  actions: [
    { name: 'edit', label: 'Editar', icon: 'edit', color: 'blue' },
    { name: 'delete', label: 'Eliminar', icon: 'delete', color: 'red' }
  ],
  pagination: true,
  filtering: true,
  selection: true,
  onRowAction: (action, row) => console.log(\`\${action}: \${row.name}\`)
});`,

    calendar: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.calendar({
  title: 'Calendario de Eventos',
  selectedDate: new Date(),
  events: [
    { 
      id: 1, 
      title: 'Reunión de equipo', 
      date: '2024-02-15', 
      type: 'meeting' 
    }
  ],
  onDateSelect: (date) => console.log(\`Fecha: \${date.toDateString()}\`),
  onEventSelect: (event) => console.log(\`Evento: \${event.title}\`)
});`,

    calendarSingle: `// Imports necesarios
import ModalManager from '@/components/ui/modal';
import { dataModalRenderers } from '@/components/ui/modal/types/DataModals';

const CalendarModalContent = dataModalRenderers.calendar;

// Uso
ModalManager.custom({
  title: 'Calendario (Día Único)',
  size: 'large',
  content: (
    <CalendarModalContent
      selectedDate={new Date()}
      rangeSelection={false}
      onDateSelect={(date) => console.log(date.toLocaleDateString())}
    />
  ),
  buttons: [
    {
      text: 'Cerrar',
      variant: 'secondary',
      onClick: () => ModalManager.closeAll()
    }
  ]
});`,

    calendarRange: `// Imports necesarios
import ModalManager from '@/components/ui/modal';
import { dataModalRenderers } from '@/components/ui/modal/types/DataModals';

const CalendarModalContent = dataModalRenderers.calendar;

// Uso
ModalManager.custom({
  title: 'Calendario (Rango de Fechas)',
  size: 'large',
  content: (
    <CalendarModalContent
      selectedStartDate={null}
      selectedEndDate={null}
      rangeSelection={true}
      onRangeSelect={(start, end) => {
        if (start && end) {
          console.log(\`Rango: \${start.toLocaleDateString()} → \${end.toLocaleDateString()}\`);
        }
      }}
    />
  ),
  buttons: [
    {
      text: 'Cerrar',
      variant: 'secondary',
      onClick: () => ModalManager.closeAll()
    }
  ],
  showFooter: false
});`,

    image: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.image({
  title: 'Vista Previa de Imagen',
  images: [
    { 
      id: 1, 
      url: 'https://picsum.photos/800/600', 
      name: 'Imagen 1', 
      alt: 'Demo' 
    }
  ],
  currentIndex: 0,
  showThumbnails: true,
  allowDownload: true,
  onDownload: (image) => console.log(\`Descargando: \${image.name}\`)
});`,

    video: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.video({
  title: 'Reproductor de Video',
  video: {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny'
  },
  autoplay: false,
  controls: true,
  onPlay: () => console.log('Reproduciendo')
});`,

    gallery: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.gallery({
  title: 'Galería de Medios',
  items: [
    { 
      id: 1, 
      type: 'image', 
      name: 'Foto.jpg', 
      url: 'https://picsum.photos/400/300',
      size: '2.3 MB'
    }
  ],
  viewMode: 'grid',
  allowUpload: true,
  selectable: true,
  onItemSelect: (selection) => console.log(\`\${selection.length} seleccionados\`)
});`,

    fileManager: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.fileManager({
  title: 'Gestor de Archivos',
  currentPath: '/documentos/proyectos',
  files: [
    { 
      id: 1, 
      name: 'Proyecto 2024', 
      type: 'folder', 
      modified: '2024-01-15T10:30:00Z' 
    }
  ],
  allowUpload: true,
  allowCreateFolder: true,
  onNavigate: (path) => console.log(\`Navegando: \${path}\`)
});`,

    loading: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
const loadingModal = ModalManager.loading({
  title: 'Procesando Solicitud',
  message: 'Iniciando proceso...',
  progress: 0,
  showProgress: true,
  showCancel: true,
  onCancel: () => console.log('Cancelado')
});

// Simular progreso
let progress = 0;
const interval = setInterval(() => {
  progress += 10;
  if (progress >= 100) {
    clearInterval(interval);
    ModalManager.close(loadingModal);
  }
}, 300);`,

    progress: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
const progressModal = ModalManager.progress({
  title: 'Subiendo Archivos',
  steps: [
    'Preparando archivos...',
    'Comprimiendo datos...',
    'Subiendo al servidor...'
  ],
  currentStep: 0,
  progress: 0,
  allowCancel: true,
  onCancel: () => console.log('Cancelado')
});`,

    settings: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.settings({
  title: 'Configuración del Sistema',
  categories: [
    {
      id: 'general',
      name: 'General',
      settings: [
        {
          id: 'language',
          label: 'Idioma',
          type: 'select',
          options: [
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' }
          ]
        }
      ]
    }
  ],
  onSave: (settings) => console.log('Guardado', settings)
});`,

    help: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.help({
  title: 'Centro de Ayuda',
  categories: [
    { id: 'getting-started', name: 'Primeros Pasos', icon: '🚀' }
  ],
  popularArticles: [
    'Cómo crear un nuevo proyecto',
    'Gestión de usuarios y permisos'
  ],
  onSearch: (query) => console.log(\`Búsqueda: "\${query}"\`)
});`,

    custom: `// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Uso
ModalManager.custom({
  title: 'Modal Personalizado',
  size: 'large',
  content: (
    <div className="text-center py-6">
      <h3 className="text-xl font-semibold mb-4">
        ¡Contenido Personalizado!
      </h3>
      <p className="text-gray-600">
        Puedes agregar cualquier JSX aquí
      </p>
    </div>
  ),
  buttons: [
    { text: 'Cancelar', variant: 'secondary', onClick: () => {} },
    { text: 'Confirmar', variant: 'primary', onClick: () => {} }
  ]
});`
  };

  // ====================================
  // Función para mostrar el código
  // ====================================

  const showCode = (codeKey) => {
    const code = codeSnippets[codeKey];

    ModalManager.custom({
      title: '📋 Código del Modal',
      size: 'large',
      content: (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={() => {
                navigator.clipboard.writeText(code);
                addResult('code', 'Código copiado al portapapeles');
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            <code>{code}</code>
          </pre>
        </div>
      ),
      buttons: [
        {
          text: 'Cerrar',
          variant: 'secondary',
          onClick: () => ModalManager.closeAll()
        }
      ]
    });
  };

  // ====================================
  // HELPERS
  // ====================================

  const addResult = (type, result) => {
    const newResult = {
      id: Date.now(),
      type,
      result,
      timestamp: new Date().toLocaleTimeString()
    };
    setDemoResults(prev => [newResult, ...prev].slice(0, 5));
  };

  // ====================================
  // MODALES ESTÁNDAR
  // ====================================

  const showInfoModal = () => {
    ModalManager.info({
      title: 'Información del Sistema',
      message: 'El sistema realizará una actualización programada el próximo martes a las 02:00 AM. Durante este período, los servicios estarán temporalmente no disponibles.',
      onClose: () => addResult('info', 'Modal de información cerrado')
    });
  };

  const showConfirmModal = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: 'Confirmar Acción',
        message: '¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      });
      addResult('confirm', confirmed ? 'Elemento eliminado' : 'Acción cancelada');
    } catch (error) {
      addResult('confirm', 'Cancelado');
    }
  };

  const showSuccessModal = () => {
    ModalManager.success({
      title: 'Operación Completada',
      message: 'La operación se ha completado correctamente. Los cambios han sido guardados y aplicados al sistema.',
      onClose: () => addResult('success', 'Éxito confirmado')
    });
  };

  const showWarningModal = () => {
    ModalManager.warning({
      title: 'Advertencia de Seguridad',
      message: 'Se ha detectado un intento de acceso no autorizado. Por motivos de seguridad, recomendamos cambiar su contraseña inmediatamente.',
      onClose: () => addResult('warning', 'Advertencia vista')
    });
  };

  const showErrorModal = () => {
    ModalManager.error({
      title: 'Error del Sistema',
      message: 'Se ha producido un error al conectar',
      details: [
        'Error Code: ERR_500_INTERNAL',
        'Connection timeout after 30s',
        `Timestamp: ${new Date().toISOString()}`
      ],
      onClose: () => addResult('error', 'Error reconocido')
    });
  };

  const showDangerModal = () => {
    ModalManager.danger({
      title: 'Acción Peligrosa',
      message: 'Esta acción eliminará permanentemente todos los datos del sistema. Esta operación es irreversible.',
      onClose: () => addResult('danger', 'Advertencia de peligro vista')
    });
  };

  const showNotificationInfo = () => {
    ModalManager.show({
      type: 'notification',
      variant: 'info',
      title: 'Info',
      message: 'Esto es una notificación de información.',
      autoClose: 10 * 1000,
      position: 'bottom-right',
      onClose: () => addResult('notification', 'Info vista'),
    });
  };

  const showNotificationSuccess = () => {
    ModalManager.show({
      type: 'notification',
      variant: 'success',
      title: 'Éxito',
      message: 'Operación realizada correctamente.',
      autoClose: 10 * 1000,
      position: 'bottom-right',
      onClose: () => addResult('notification', 'Éxito vista'),
    });
  };

  const showNotificationWarning = () => {
    ModalManager.show({
      type: 'notification',
      variant: 'warning',
      title: 'Advertencia',
      message: 'Esta es una advertencia importante.',
      autoClose: 10 * 1000,
      position: 'bottom-right',
      onClose: () => addResult('notification', 'Advertencia vista'),
    });
  };

  const showNotificationError = () => {
    ModalManager.show({
      type: 'notification',
      variant: 'error',
      title: 'Error',
      message: 'Ha ocurrido un error inesperado.',
      autoClose: 10 * 1000,
      position: 'bottom-right',
      onClose: () => addResult('notification', 'Error vista'),
    });
  };

  const showNotificationModal = (variant = "info") => {
    switch (variant) {
      case "success":
        showNotificationSuccess();
        break;
      case "warning":
        showNotificationWarning();
        break;
      case "error":
        showNotificationError();
        break;
      case "info":
      default:
        showNotificationInfo();
        break;
    }
  };

  // ====================================
  // MODALES INTERACTIVOS
  // ====================================

  const showFormModal = async () => {
    try {
      const data = await ModalManager.form({
        title: 'Configuración de Usuario',
        fields: [
          { name: 'fullName', label: 'Nombre completo', type: 'text', required: true, placeholder: 'Ingrese su nombre completo' },
          { name: 'email', label: 'Correo electrónico', type: 'email', required: true, placeholder: 'usuario@empresa.com' },
          {
            name: 'department', label: 'Departamento', type: 'select', required: true, options: [
              { value: 'desarrollo', label: 'Desarrollo' },
              { value: 'marketing', label: 'Marketing' },
              { value: 'ventas', label: 'Ventas' },
              { value: 'soporte', label: 'Soporte' },
              { value: 'rrhh', label: 'Recursos Humanos' }
            ]
          },
          { name: 'phone', label: 'Teléfono', type: 'tel', placeholder: '+56 9 1234 5678' },
          { name: 'notes', label: 'Notas adicionales', type: 'textarea', placeholder: 'Información adicional (opcional)', rows: 3 }
        ],
        submitText: 'Guardar',
        cancelText: 'Cancelar'
      });
      addResult('form', `Usuario guardado: ${data.fullName}`);
    } catch (error) {
      addResult('form', 'Formulario cancelado');
    }
  };

  const showWizardModal = async () => {
    try {
      const data = await ModalManager.wizard({
        title: 'Asistente de Configuración',
        steps: [
          {
            title: 'Información Básica',
            description: 'Configure los datos básicos del proyecto',
            fields: [
              { name: 'projectName', label: 'Nombre del Proyecto', type: 'text', required: true, placeholder: 'Ingrese el nombre del proyecto' },
              { name: 'description', label: 'Descripción', type: 'textarea', rows: 3, placeholder: 'Breve descripción del proyecto' }
            ]
          },
          {
            title: 'Configuración Técnica',
            description: 'Seleccione las opciones técnicas',
            fields: [
              {
                name: 'type', label: 'Tipo de Implementación', type: 'select', required: true, options: [
                  { value: 'web', label: 'Aplicación Web' },
                  { value: 'desktop', label: 'Sistema Desktop' },
                  { value: 'mobile', label: 'Aplicación Móvil' },
                  { value: 'api', label: 'API Backend' }
                ]
              },
              {
                name: 'framework', label: 'Framework Tecnológico', type: 'select', required: true, options: [
                  { value: 'react', label: 'React + Node.js' },
                  { value: 'vue', label: 'Vue.js + Express' },
                  { value: 'angular', label: 'Angular + .NET' },
                  { value: 'laravel', label: 'Laravel + PHP' }
                ]
              }
            ]
          },
          {
            title: 'Revisión',
            description: 'Revise la configuración antes de continuar',
            fields: []
          }
        ]
      });
      addResult('wizard', `Configuración completada: ${data.projectName}`);
    } catch (error) {
      addResult('wizard', 'Asistente cancelado');
    }
  };

  const showLoginModal = async () => {
    try {
      const credentials = await ModalManager.login({
        title: 'Iniciar Sesión',
        message: 'Ingrese sus credenciales para acceder al sistema',
        showRegisterLink: true,
        showForgotPassword: true,
        onRegister: () => addResult('login', 'Redirigido a registro'),
        onForgotPassword: () => addResult('login', 'Redirigido a recuperar contraseña')
      });
      addResult('login', `Login exitoso: ${credentials.username}`);
    } catch (error) {
      addResult('login', 'Login cancelado');
    }
  };

  // ====================================
  // MODALES DE DATOS
  // ====================================

  const showSearchModal = () => {
    ModalManager.search({
      title: 'Búsqueda Avanzada',
      placeholder: 'Buscar productos, usuarios, documentos...',
      filters: [
        {
          name: 'category',
          label: 'Categoría',
          type: 'select',
          options: [
            { value: 'products', label: 'Productos' },
            { value: 'users', label: 'Usuarios' },
            { value: 'documents', label: 'Documentos' },
            { value: 'orders', label: 'Pedidos' }
          ]
        },
        {
          name: 'dateRange',
          label: 'Rango de fechas',
          type: 'select',
          options: [
            { value: 'today', label: 'Hoy' },
            { value: 'week', label: 'Esta semana' },
            { value: 'month', label: 'Este mes' },
            { value: 'year', label: 'Este año' }
          ]
        }
      ],
      recentSearches: ['laptop', 'mouse wireless', 'monitor 4k'],
      results: [
        { id: 1, title: 'Laptop Gaming Pro', description: 'Laptop de alto rendimiento', icon: '💻' },
        { id: 2, title: 'Mouse Inalámbrico', description: 'Mouse ergonómico', icon: '🖱️' },
        { id: 3, title: 'Monitor Ultra HD', description: 'Monitor 4K 27 pulgadas', icon: '🖥️' }
      ],
      onSearch: (query) => addResult('search', `Búsqueda realizada: "${query}"`),
      onResultSelect: (result) => addResult('search', `Resultado seleccionado: ${result.title}`)
    });
  };

  const showDataTableModal = () => {
    ModalManager.datatable({
      title: 'Gestión de Usuarios',
      data: [
        { id: 1, name: 'Juan Pérez', email: 'juan@empresa.com', department: 'Desarrollo', status: 'Activo' },
        { id: 2, name: 'Ana García', email: 'ana@empresa.com', department: 'Marketing', status: 'Activo' },
        { id: 3, name: 'Carlos López', email: 'carlos@empresa.com', department: 'Ventas', status: 'Inactivo' },
        { id: 4, name: 'María Rodríguez', email: 'maria@empresa.com', department: 'RRHH', status: 'Activo' }
      ],
      columns: [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'name', label: 'Nombre', sortable: true },
        { key: 'email', label: 'Email', sortable: true },
        { key: 'department', label: 'Departamento', sortable: true },
        { key: 'status', label: 'Estado', sortable: true }
      ],
      actions: [
        { name: 'edit', label: 'Editar', icon: 'edit', color: 'blue' },
        { name: 'delete', label: 'Eliminar', icon: 'delete', color: 'red' }
      ],
      pagination: true,
      filtering: true,
      selection: true,
      onRowAction: (action, row) => addResult('datatable', `${action} en usuario: ${row.name}`),
      onSelectionChange: (selection) => addResult('datatable', `${selection.length} usuarios seleccionados`),
      onAdd: () => addResult('datatable', 'Agregar nuevo usuario'),
      onExport: () => addResult('datatable', 'Exportar datos solicitado')
    });
  };

  const showCalendarModal = () => {
    ModalManager.calendar({
      title: 'Calendario de Eventos',
      selectedDate: new Date(),
      events: [
        { id: 1, title: 'Reunión de equipo', date: '2024-02-15', type: 'meeting' },
        { id: 2, title: 'Presentación cliente', date: '2024-02-20', type: 'presentation' },
        { id: 3, title: 'Deadline proyecto', date: '2024-02-25', type: 'deadline' }
      ],
      onDateSelect: (date) => addResult('calendar', `Fecha seleccionada: ${date.toDateString()}`),
      onEventSelect: (event) => addResult('calendar', `Evento seleccionado: ${event.title}`),
      onEventCreate: (date) => addResult('calendar', `Crear evento para: ${date.toDateString()}`)
    });
  };

  const showCalendarModalSingleDay = () => {
    ModalManager.custom({
      title: 'Calendario (Día Único)',
      size: 'large',
      content: (
        <CalendarModalContent
          selectedDate={new Date()}
          rangeSelection={false}
          onDateSelect={(date) => {
            addResult('calendar', `Seleccionaste: ${date.toLocaleDateString()}`);
          }}
        />
      ),
      buttons: [
        {
          text: 'Cerrar',
          variant: 'secondary',
          onClick: () => ModalManager.closeAll()
        }
      ]
    });
  };

  const showCalendarModalRange = () => {
    ModalManager.custom({
      title: 'Calendario (Rango de Fechas)',
      size: 'large',
      content: (
        <CalendarModalContent
          selectedStartDate={null}
          selectedEndDate={null}
          rangeSelection={true}
          onRangeSelect={(start, end) => {
            if (start && end) {
              addResult('calendar', `Rango: ${start.toLocaleDateString()} → ${end.toLocaleDateString()}`);
            } else if (start) {
              addResult('calendar', `Inicio de rango: ${start.toLocaleDateString()}`);
            }
          }}
        />
      ),
      buttons: [
        {
          text: 'Cerrar',
          variant: 'secondary',
          onClick: () => ModalManager.closeAll()
        }
      ],
      showFooter: false
    });
  };

  // ====================================
  // MODALES DE MEDIA
  // ====================================

  const showImageModal = () => {
    ModalManager.image({
      title: 'Vista Previa de Imagen',
      images: [
        { id: 1, url: 'https://picsum.photos/800/600?random=1', name: 'Imagen Demo 1', alt: 'Imagen de demostración 1' },
        { id: 2, url: 'https://picsum.photos/800/600?random=2', name: 'Imagen Demo 2', alt: 'Imagen de demostración 2' },
        { id: 3, url: 'https://picsum.photos/800/600?random=3', name: 'Imagen Demo 3', alt: 'Imagen de demostración 3' }
      ],
      currentIndex: 0,
      showThumbnails: true,
      showMetadata: true,
      allowDownload: true,
      allowRotate: true,
      onNext: (index) => addResult('image', `Imagen siguiente: ${index + 1}`),
      onPrevious: (index) => addResult('image', `Imagen anterior: ${index + 1}`),
      onDownload: (image) => addResult('image', `Descargando: ${image.name}`)
    });
  };

  const showVideoModal = () => {
    ModalManager.video({
      title: 'Reproductor de Video',
      video: {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        title: 'Big Buck Bunny',
        poster: 'https://picsum.photos/800/450?random=video'
      },
      videos: [
        {
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          title: 'Big Buck Bunny',
          duration: '10:34'
        },
        {
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          title: 'Elephants Dream',
          duration: '10:53'
        }
      ],
      autoplay: false,
      controls: true,
      showPlaylist: true,
      onPlay: () => addResult('video', 'Reproducción iniciada'),
      onPause: () => addResult('video', 'Reproducción pausada'),
      onEnded: () => addResult('video', 'Reproducción finalizada')
    });
  };

  const showGalleryModal = () => {
    ModalManager.gallery({
      title: 'Galería de Medios',
      items: [
        { id: 1, type: 'image', name: 'Foto 1.jpg', url: 'https://picsum.photos/400/300?random=1', size: '2.3 MB' },
        { id: 2, type: 'image', name: 'Foto 2.jpg', url: 'https://picsum.photos/400/300?random=2', size: '1.8 MB' },
        { id: 3, type: 'video', name: 'Video.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', size: '15.2 MB' },
        { id: 4, type: 'image', name: 'Foto 3.jpg', url: 'https://picsum.photos/400/300?random=3', size: '3.1 MB' }
      ],
      viewMode: 'grid',
      allowUpload: true,
      allowDelete: true,
      allowEdit: true,
      selectable: true,
      onItemSelect: (selection) => addResult('gallery', `${selection.length} elementos seleccionados`),
      onItemOpen: (item) => addResult('gallery', `Abriendo: ${item.name}`),
      onUpload: () => addResult('gallery', 'Subir archivos solicitado'),
      onDelete: (items) => addResult('gallery', `Eliminar ${items.length} elementos`),
      onEdit: (items) => addResult('gallery', `Editar ${items.length} elementos`)
    });
  };

  const showFileManagerModal = () => {
    ModalManager.fileManager({
      title: 'Gestor de Archivos',
      currentPath: '/documentos/proyectos',
      files: [
        { id: 1, name: 'Proyecto 2024', type: 'folder', size: null, modified: '2024-01-15T10:30:00Z' },
        { id: 2, name: 'Informe.pdf', type: 'document', size: 2048576, modified: '2024-01-14T15:45:00Z' },
        { id: 3, name: 'Presentación.pptx', type: 'document', size: 5242880, modified: '2024-01-13T09:20:00Z' },
        { id: 4, name: 'Imagen.jpg', type: 'image', size: 1048576, modified: '2024-01-12T16:10:00Z' },
        { id: 5, name: 'Backup.zip', type: 'archive', size: 10485760, modified: '2024-01-11T14:25:00Z' }
      ],
      allowUpload: true,
      allowCreateFolder: true,
      allowDelete: true,
      allowRename: true,
      allowMove: true,
      onNavigate: (path) => addResult('filemanager', `Navegando a: ${path}`),
      onFileSelect: (file) => addResult('filemanager', `Archivo seleccionado: ${file.name}`),
      onUpload: (files) => addResult('filemanager', `Subiendo ${files.length} archivos`),
      onCreateFolder: () => addResult('filemanager', 'Crear carpeta solicitado'),
      onDelete: (fileIds) => addResult('filemanager', `Eliminar ${fileIds.length} elementos`),
      onRename: (fileId) => addResult('filemanager', `Renombrar archivo: ${fileId}`),
      onMove: (fileIds) => addResult('filemanager', `Mover ${fileIds.length} elementos`)
    });
  };

  // ====================================
  // MODALES DE SISTEMA
  // ====================================

  const showLoadingModal = () => {
    const steps = [
      'Iniciando proceso...',
      'Validando datos...',
      'Procesando información...',
      'Guardando cambios...',
      'Finalizando...'
    ];

    const loadingModal = ModalManager.loading({
      title: 'Procesando Solicitud',
      message: steps[0],
      progress: 0,
      showProgress: true,
      steps: steps,
      currentStep: 0,
      showCancel: true,
      onCancel: () => {
        addResult('loading', 'Proceso cancelado');
      }
    });

    let currentStep = 0;
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 15;

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          ModalManager.close(loadingModal);
          addResult('loading', 'Proceso completado exitosamente');
        }, 500);
      } else {
        const newStep = Math.floor((progress / 100) * steps.length);
        if (newStep !== currentStep && newStep < steps.length) {
          currentStep = newStep;
        }
      }
    }, 300);
  };

  const showProgressModal = () => {
    const progressModal = ModalManager.progress({
      title: 'Subiendo Archivos',
      steps: [
        'Preparando archivos...',
        'Comprimiendo datos...',
        'Subiendo al servidor...',
        'Verificando integridad...',
        'Proceso completado'
      ],
      currentStep: 0,
      progress: 0,
      showSteps: true,
      showProgress: true,
      allowCancel: true,
      onCancel: () => addResult('progress', 'Subida cancelada')
    });

    let step = 0;
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 10;

      if (progress >= 100) {
        progress = 100;
        step = 4;
        clearInterval(interval);

        setTimeout(() => {
          ModalManager.close(progressModal);
          addResult('progress', 'Archivos subidos exitosamente');
        }, 1000);
      } else {
        step = Math.floor((progress / 100) * 4);
      }
    }, 400);
  };

  const showSettingsModal = () => {
    ModalManager.settings({
      title: 'Configuración del Sistema',
      categories: [
        {
          id: 'general',
          name: 'General',
          icon: 'general',
          settings: [
            {
              id: 'language',
              label: 'Idioma',
              type: 'select',
              options: [
                { value: 'es', label: 'Español' },
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'Français' }
              ],
              defaultValue: 'es'
            },
            {
              id: 'timezone',
              label: 'Zona horaria',
              type: 'select',
              options: [
                { value: 'America/Santiago', label: 'Santiago' },
                { value: 'America/Lima', label: 'Lima' },
                { value: 'Europe/Madrid', label: 'Madrid' }
              ],
              defaultValue: 'America/Santiago'
            }
          ]
        },
        {
          id: 'appearance',
          name: 'Apariencia',
          icon: 'appearance',
          settings: [
            {
              id: 'theme',
              label: 'Tema',
              type: 'select',
              options: [
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
                { value: 'auto', label: 'Automático' }
              ],
              defaultValue: 'auto'
            }
          ]
        }
      ],
      activeCategory: 'general',
      settings: {
        language: 'es',
        timezone: 'America/Santiago',
        theme: 'auto'
      },
      onSave: (settings) => addResult('settings', 'Configuración guardada'),
      onCategoryChange: (category) => addResult('settings', `Categoría cambiada: ${category}`),
      onSettingChange: (key, value) => addResult('settings', `${key} = ${value}`)
    });
  };

  const showHelpModal = () => {
    ModalManager.help({
      title: 'Centro de Ayuda',
      categories: [
        { id: 'getting-started', name: 'Primeros Pasos', icon: '🚀' },
        { id: 'tutorials', name: 'Tutoriales', icon: '📚' },
        { id: 'faq', name: 'FAQ', icon: '❓' },
        { id: 'contact', name: 'Contacto', icon: '📞' }
      ],
      popularArticles: [
        'Cómo crear un nuevo proyecto',
        'Gestión de usuarios y permisos',
        'Configuración de notificaciones',
        'Solución de problemas comunes'
      ],
      onSearch: (query) => addResult('help', `Búsqueda de ayuda: "${query}"`),
      onCategorySelect: (category) => addResult('help', `Categoría seleccionada: ${category.name}`),
      onArticleSelect: (article) => addResult('help', `Artículo seleccionado: ${article}`),
      onContactSupport: () => addResult('help', 'Contactar soporte solicitado')
    });
  };

  const showCustomModal = () => {
    ModalManager.custom({
      title: 'Modal Personalizado',
      size: 'large',
      content: (
        <div className="text-center py-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            ¡Modal Completamente Personalizable!
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Este modal demuestra las capacidades de personalización del sistema.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold">Estadísticas</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Datos en tiempo real</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold">Performance</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Optimización avanzada</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl mb-2">🔒</div>
              <h4 className="font-semibold">Seguridad</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Protección completa</p>
            </div>
          </div>
        </div>
      ),
      buttons: [
        {
          text: 'Cancelar',
          variant: 'secondary',
          onClick: () => addResult('custom', 'Modal personalizado cancelado')
        },
        {
          text: 'Confirmar',
          variant: 'primary',
          onClick: () => addResult('custom', 'Modal personalizado confirmado')
        }
      ],
      onClose: () => addResult('custom', 'Modal personalizado cerrado')
    });
  };

  // ====================================
  // CONTROLES DEL SISTEMA
  // ====================================

  const closeAllModals = () => {
    ModalManager.closeAll();
    addResult('control', 'Todos los modales cerrados');
  };

  const getSystemStats = () => {
    const stats = ModalManager.getStats();
    addResult('control', `Estadísticas: ${stats.total} modales abiertos`);
  };

  // ====================================
  // COMPONENTE DE BOTÓN CON CÓDIGO
  // ====================================

  const DemoButton = ({ onClick, onShowCode, icon, label, codeKey }) => (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md text-gray-700 dark:text-gray-300 font-medium"
      >
        {typeof icon === 'string' ? (
          <span className="text-lg">{icon}</span>
        ) : (
          icon
        )}
        {label}
      </button>
      <button
        onClick={() => onShowCode(codeKey)}
        className="absolute top-1 right-1 p-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="Ver código"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );

  // ====================================
  // RENDER
  // ====================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-5">
      <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg p-10 shadow-sm border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <h1 className="text-center text-gray-900 dark:text-gray-100 mb-10 text-3xl font-semibold">
          Sistema de Modales Profesional
        </h1>

        {/* Modales Estándar */}
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Modales Estándar
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <DemoButton
              onClick={showInfoModal}
              onShowCode={showCode}
              codeKey="info"
              icon={<svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>}
              label="Información"
            />

            <DemoButton
              onClick={showConfirmModal}
              onShowCode={showCode}
              codeKey="confirm"
              icon={<svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>}
              label="Confirmación"
            />

            <DemoButton
              onClick={showSuccessModal}
              onShowCode={showCode}
              codeKey="success"
              icon={<svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>}
              label="Éxito"
            />

            <DemoButton
              onClick={showWarningModal}
              onShowCode={showCode}
              codeKey="warning"
              icon={<svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>}
              label="Advertencia"
            />

            <DemoButton
              onClick={showErrorModal}
              onShowCode={showCode}
              codeKey="error"
              icon={<svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>}
              label="Error"
            />

            <DemoButton
              onClick={showDangerModal}
              onShowCode={showCode}
              codeKey="danger"
              icon={<svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>}
              label="Peligro"
            />
          </div>
        </div>

        {/* Modales Interactivos */}
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L16 11.586V5a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h2.586l-1.293-1.293a1 1 0 111.414-1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L14 15.586H6a2 2 0 01-2-2V5z" clipRule="evenodd" />
            </svg>
            Modales Interactivos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <DemoButton onClick={showFormModal} onShowCode={showCode} codeKey="form" icon="📝" label="Formulario" />
            <DemoButton onClick={showWizardModal} onShowCode={showCode} codeKey="wizard" icon="🎯" label="Asistente" />
            <DemoButton onClick={showLoginModal} onShowCode={showCode} codeKey="login" icon="🔐" label="Login" />
          </div>
        </div>

        {/* Modales de Datos */}
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            Modales de Datos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <DemoButton onClick={showSearchModal} onShowCode={showCode} codeKey="search" icon="🔍" label="Búsqueda" />
            <DemoButton onClick={showDataTableModal} onShowCode={showCode} codeKey="datatable" icon="📊" label="Tabla de Datos" />
          </div>
        </div>

        {/* Modales de Calendarios */}
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            Modales de Calendarios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <DemoButton onClick={showCalendarModal} onShowCode={showCode} codeKey="calendar" icon="📅" label="Calendario Eventos" />
            <DemoButton onClick={showCalendarModalSingleDay} onShowCode={showCode} codeKey="calendarSingle" icon="📅" label="Calendario Día" />
            <DemoButton onClick={showCalendarModalRange} onShowCode={showCode} codeKey="calendarRange" icon="📆" label="Calendario Rango" />
          </div>
        </div>

        {/* Modales de Media */}
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            Modales de Media
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <DemoButton onClick={showImageModal} onShowCode={showCode} codeKey="image" icon="🖼️" label="Vista Previa" />
            <DemoButton onClick={showVideoModal} onShowCode={showCode} codeKey="video" icon="🎬" label="Reproductor" />
            <DemoButton onClick={showGalleryModal} onShowCode={showCode} codeKey="gallery" icon="🖼️" label="Galería" />
            <DemoButton onClick={showFileManagerModal} onShowCode={showCode} codeKey="fileManager" icon="📁" label="Gestor Archivos" />
          </div>
        </div>

        {/* Modales de Sistema */}
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1z" clipRule="evenodd" />
            </svg>
            Modales de Sistema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <DemoButton onClick={showLoadingModal} onShowCode={showCode} codeKey="loading" icon="⏳" label="Loading" />
            <DemoButton onClick={showProgressModal} onShowCode={showCode} codeKey="progress" icon="📈" label="Progreso" />
            <DemoButton onClick={showSettingsModal} onShowCode={showCode} codeKey="settings" icon="⚙️" label="Configuración" />
            <DemoButton onClick={showHelpModal} onShowCode={showCode} codeKey="help" icon="❓" label="Ayuda" />
            <DemoButton onClick={showCustomModal} onShowCode={showCode} codeKey="custom" icon="🎨" label="Personalizado" />
          </div>
        </div>

        {/* Controles del Sistema */}
        <div className="mb-8 flex justify-center gap-4">
          <button
            onClick={closeAllModals}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
          >
            ❌ Cerrar Todos los Modales
          </button>
          <button
            onClick={getSystemStats}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
          >
            📊 Ver Estadísticas
          </button>
        </div>

        {/* Resultados */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">📋 Últimos Resultados:</h3>
          {demoResults.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">
              No hay resultados aún. ¡Prueba algunos modales!
            </p>
          ) : (
            <div className="space-y-2">
              {demoResults.map(result => (
                <div key={result.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-900 dark:text-gray-100">
                    <strong>{result.type}:</strong> {result.result}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">{result.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDemo;