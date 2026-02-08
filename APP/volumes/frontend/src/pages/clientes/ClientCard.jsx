/**
 * ClientCard.jsx
 * Tarjeta individual de cliente con acciones (Ver, Editar, Eliminar)
 * Incluye lógica de modales usando ModalManager
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';
import { ModalManager } from '@/components/ui/modal';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const ClientCard = ({ client, onEdit, onDelete, onUpdate }) => {
  
  // Status helpers
  const getStatusColor = (status) => {
    const colors = {
      'activo': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      'inactivo': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
      'prospecto': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    };
    return colors[status] || colors.activo;
  };

  const getStatusText = (status) => {
    const texts = {
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'prospecto': 'Prospecto'
    };
    return texts[status] || status;
  };

  // Modal: Ver Detalles
  const handleViewClient = () => {
    ModalManager.show({
      type: 'custom',
      title: 'Detalles del Cliente',
      size: 'large',
      content: <ViewClientContent client={client} onEdit={() => handleEditClient()} />,
      showFooter: false
    });
  };

  // Modal: Editar Cliente
  const handleEditClient = async () => {
    try {
      const data = await ModalManager.form({
        title: 'Editar Cliente',
        fields: [
          // Información del Cliente
          {
            name: 'name',
            label: 'Nombre Completo',
            type: 'text',
            required: true,
            defaultValue: client.name,
            placeholder: 'Ej: Carlos Rodríguez'
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            defaultValue: client.email,
            placeholder: 'carlos.rodriguez@empresa.com'
          },
          {
            name: 'phone',
            label: 'Teléfono',
            type: 'tel',
            defaultValue: client.phone || '',
            placeholder: '+56 9 1234 5678'
          },
          {
            name: 'position',
            label: 'Cargo',
            type: 'text',
            defaultValue: client.position || '',
            placeholder: 'Ej: Gerente de Proyectos'
          },
          // Información de la Empresa
          {
            name: 'company',
            label: 'Nombre de la Empresa',
            type: 'text',
            required: true,
            defaultValue: client.company,
            placeholder: 'Ej: TechCorp Chile'
          },
          {
            name: 'industry',
            label: 'Industria',
            type: 'select',
            defaultValue: client.industry || '',
            options: [
              { value: '', label: 'Seleccionar industria...' },
              { value: 'tecnologia', label: 'Tecnología' },
              { value: 'finanzas', label: 'Finanzas' },
              { value: 'salud', label: 'Salud' },
              { value: 'educacion', label: 'Educación' },
              { value: 'retail', label: 'Retail' },
              { value: 'manufactura', label: 'Manufactura' },
              { value: 'servicios', label: 'Servicios' },
              { value: 'construccion', label: 'Construcción' },
              { value: 'logistica', label: 'Logística' },
              { value: 'otra', label: 'Otra' }
            ]
          },
          {
            name: 'address',
            label: 'Dirección',
            type: 'text',
            defaultValue: client.address || '',
            placeholder: 'Av. Apoquindo 4501, Las Condes, Santiago'
          },
          {
            name: 'website',
            label: 'Sitio Web',
            type: 'url',
            defaultValue: client.website || '',
            placeholder: 'https://www.empresa.com'
          },
          // Estado y Clasificación
          {
            name: 'status',
            label: 'Estado',
            type: 'select',
            required: true,
            defaultValue: client.status,
            options: [
              { value: 'prospecto', label: 'Prospecto' },
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' }
            ]
          },
          {
            name: 'priority',
            label: 'Prioridad',
            type: 'select',
            defaultValue: client.priority || '',
            options: [
              { value: '', label: 'Sin prioridad definida' },
              { value: 'baja', label: 'Baja' },
              { value: 'media', label: 'Media' },
              { value: 'alta', label: 'Alta' },
              { value: 'critica', label: 'Crítica' }
            ]
          },
          {
            name: 'source',
            label: 'Fuente de Contacto',
            type: 'select',
            defaultValue: client.source || '',
            options: [
              { value: '', label: 'Seleccionar fuente...' },
              { value: 'referido', label: 'Referido' },
              { value: 'evento', label: 'Evento/Conferencia' },
              { value: 'web', label: 'Sitio Web' },
              { value: 'rrss', label: 'Redes Sociales' },
              { value: 'email', label: 'Email Marketing' },
              { value: 'llamada', label: 'Llamada en Frío' },
              { value: 'otro', label: 'Otro' }
            ]
          },
          // Notas y Observaciones
          {
            name: 'notes',
            label: 'Notas Generales',
            type: 'textarea',
            defaultValue: client.notes || '',
            placeholder: 'Agregue cualquier información relevante sobre el cliente, expectativas, intereses especiales, etc.',
            rows: 6
          },
          {
            name: 'tags',
            label: 'Etiquetas',
            type: 'text',
            defaultValue: client.tags || '',
            placeholder: 'Ej: VIP, Contrato anual, Zona norte (separadas por coma)'
          }
        ],
        submitText: 'Guardar Cambios',
        cancelText: 'Cancelar'
      });

      // Actualizar cliente
      onEdit({ ...client, ...data });
      
    } catch (error) {
      console.log('[ClientCard] Edición cancelada');
    }
  };

  // Eliminar Cliente
  const handleDeleteClient = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar a ${client.name}? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      });

      if (confirmed) {
        onDelete(client.id);
      }
    } catch (error) {
      console.log('[ClientCard] Eliminación cancelada');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <Icon name="FaUser" className="text-primary-600 dark:text-primary-400 w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold ${TXT_TITLE} truncate transition-theme`}>{client.name}</h3>
              <p className={`text-sm ${TXT_META} truncate`}>{client.position || 'Sin cargo'}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)} flex-shrink-0`}>
            {getStatusText(client.status)}
          </span>
        </div>

        {/* Company Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="FaBuilding" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
            <span className={`${TXT_BODY} truncate transition-theme`}>{client.company}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Icon name="FaEnvelope" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
            <span className={`${TXT_BODY} truncate transition-theme`}>{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Icon name="FaPhone" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
              <span className={`${TXT_BODY} transition-theme`}>{client.phone}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Icon name="FaFolder" className="text-primary-500 w-4 h-4" />
            <span className={`text-sm ${TXT_BODY} transition-theme`}>
              <span className={`font-semibold ${TXT_TITLE} transition-theme`}>{client.projects}</span>
              {' '}{client.projects === 1 ? 'proyecto' : 'proyectos'}
            </span>
          </div>
          {client.industry && (
            <div className="flex items-center gap-2">
              <Icon name="FaIndustry" className={`${TXT_META} w-4 h-4`} />
              <span className={`text-sm ${TXT_BODY} capitalize transition-theme`}>{client.industry}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleViewClient}
            className="flex-1 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
          >
            <Icon name="FaEye" className="w-4 h-4 inline mr-1" />
            Ver Detalles
          </button>
          <button
            onClick={handleEditClient}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon name="FaEdit" className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteClient}
            className="px-3 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Icon name="FaTrash" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de contenido para modal de ver detalles
const ViewClientContent = ({ client, onEdit }) => {
  const getStatusColor = (status) => {
    const colors = {
      'activo': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      'inactivo': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
      'prospecto': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    };
    return colors[status] || colors.activo;
  };

  const getStatusText = (status) => {
    const texts = {
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'prospecto': 'Prospecto'
    };
    return texts[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <Icon name="FaUser" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className={`text-2xl font-bold ${TXT_TITLE} transition-theme`}>{client.name}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(client.status)}`}>
              {getStatusText(client.status)}
            </span>
          </div>
          <p className={`${TXT_BODY} transition-theme`}>
            {client.position || 'Sin cargo'} en {client.company}
          </p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
          <Icon name="FaAddressCard" className="text-primary-500 w-5 h-5" />
          Información de Contacto
        </h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Icon name="FaEnvelope" className={`${TXT_META} w-5 h-5`} />
            <a href={`mailto:${client.email}`} className="text-primary-600 dark:text-primary-400 hover:underline">
              {client.email}
            </a>
          </div>
          {client.phone && (
            <div className="flex items-center gap-3">
              <Icon name="FaPhone" className={`${TXT_META} w-5 h-5`} />
              <a href={`tel:${client.phone}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                {client.phone}
              </a>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-3">
              <Icon name="FaMapMarkerAlt" className={`${TXT_META} w-5 h-5 mt-1`} />
              <span className={`${TXT_BODY} transition-theme`}>{client.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Company Info */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
          <Icon name="FaBuilding" className="text-primary-500 w-5 h-5" />
          Información de la Empresa
        </h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${TXT_META} w-24`}>Empresa:</span>
            <span className={`${TXT_TITLE} transition-theme`}>{client.company}</span>
          </div>
          {client.industry && (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${TXT_META} w-24`}>Industria:</span>
              <span className={`${TXT_TITLE} capitalize transition-theme`}>{client.industry}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${TXT_META} w-24`}>Sitio Web:</span>
              <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">
                {client.website}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Classification */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
          <Icon name="FaTags" className="text-primary-500 w-5 h-5" />
          Clasificación
        </h4>
        <div className="space-y-2">
          {client.priority && (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${TXT_META} w-24`}>Prioridad:</span>
              <span className={`${TXT_TITLE} capitalize transition-theme`}>{client.priority}</span>
            </div>
          )}
          {client.source && (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${TXT_META} w-24`}>Fuente:</span>
              <span className={`${TXT_TITLE} capitalize transition-theme`}>{client.source}</span>
            </div>
          )}
          {client.tags && (
            <div className="flex items-start gap-3">
              <span className={`text-sm font-medium ${TXT_META} w-24`}>Etiquetas:</span>
              <div className="flex flex-wrap gap-2">
                {client.tags.split(',').map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projects */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
          <Icon name="FaFolder" className="text-primary-500 w-5 h-5" />
          Proyectos
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
            {client.projects}
          </span>
          <span className={`${TXT_BODY} transition-theme`}>
            {client.projects === 1 ? 'proyecto activo' : 'proyectos activos'}
          </span>
        </div>
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className={`font-semibold ${TXT_TITLE} mb-3 flex items-center gap-2 transition-theme`}>
            <Icon name="FaStickyNote" className="text-primary-500 w-5 h-5" />
            Notas
          </h4>
          <p className={`${TXT_BODY} transition-theme`}>{client.notes}</p>
        </div>
      )}      
    </div>
  );
};

export default ClientCard;