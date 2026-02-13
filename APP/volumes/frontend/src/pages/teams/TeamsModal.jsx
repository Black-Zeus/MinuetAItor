import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon/iconManager';

const TeamsModal = ({ isOpen, onClose }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [assignmentMode, setAssignmentMode] = useState('specific');
  const totalTabs = 5;

  // Reset al abrir modal
  useEffect(() => {
    if (isOpen) {
      setCurrentTab(1);
      setAssignmentMode('specific');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs = [
    { id: 1, label: 'Información General', icon: 'FaUser' },
    { id: 2, label: 'Rol del Sistema', icon: 'FaShieldHalved' },
    { id: 3, label: 'Asignación de Acceso', icon: 'FaBriefcase' },
    { id: 4, label: 'Clientes y Proyectos', icon: 'FaUsers' },
    { id: 5, label: 'Proyectos Confidenciales', icon: 'FaLock' }
  ];

  const handleTabClick = (tabId) => {
    // Prevenir acceso al Tab 4 si está deshabilitado
    if (tabId === 4 && assignmentMode === 'all') {
      return;
    }
    setCurrentTab(tabId);
  };

  const handleNext = () => {
    if (currentTab < totalTabs) {
      // Si estamos en Tab 3 y seleccionaron "Todos", saltar Tab 4
      if (currentTab === 3 && assignmentMode === 'all') {
        setCurrentTab(5);
      } else {
        setCurrentTab(currentTab + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentTab > 1) {
      // Si estamos en Tab 5 y Tab 4 está deshabilitado, retroceder a Tab 3
      if (currentTab === 5 && assignmentMode === 'all') {
        setCurrentTab(3);
      } else {
        setCurrentTab(currentTab - 1);
      }
    }
  };

  const handleSave = () => {
    console.log('Usuario guardado');
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isTab4Disabled = assignmentMode === 'all';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nuevo Usuario</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configura la información y permisos del usuario</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon name="FaTimes" className="text-xl" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="px-6 pt-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              const isDisabled = tab.id === 4 && isTab4Disabled;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={isDisabled}
                  className={`
                    px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap
                    ${isActive 
                      ? 'border-blue-600 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-gray-600'
                    }
                    ${isDisabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon name={tab.icon} className="mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          
          {/* Tab 1: Información General */}
          {currentTab === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                <Icon name="FaUser" className="text-blue-600 text-4xl mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Soy el Tab 1: Información General</h3>
                <p className="text-sm text-gray-600">Aquí irá el formulario de información básica del usuario</p>
              </div>
            </div>
          )}

          {/* Tab 2: Rol del Sistema */}
          {currentTab === 2 && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-8 text-center">
                <Icon name="FaShieldHalved" className="text-purple-600 text-4xl mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Soy el Tab 2: Rol del Sistema</h3>
                <p className="text-sm text-gray-600">Aquí irá la selección del rol del sistema (Admin, Escritura, Lectura)</p>
              </div>
            </div>
          )}

          {/* Tab 3: Asignación de Acceso */}
          {currentTab === 3 && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
                <Icon name="FaBriefcase" className="text-amber-600 text-4xl mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Soy el Tab 3: Asignación de Acceso</h3>
                <p className="text-sm text-gray-600">Aquí irá el selector de modo: Todos los clientes vs Específicos</p>
              </div>

              {/* Simulación de control de assignmentMode */}
              <div className="space-y-3">
                <label className="flex items-center gap-4 p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50">
                  <input 
                    type="radio" 
                    name="assignmentMode" 
                    value="all" 
                    checked={assignmentMode === 'all'}
                    onChange={() => setAssignmentMode('all')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="FaGlobe" className="text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">Todos los clientes y proyectos</h4>
                    </div>
                    <p className="text-xs text-gray-600">El usuario tendrá acceso a todos los clientes y proyectos (excepto confidenciales)</p>
                  </div>
                </label>

                <label className="flex items-center gap-4 p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50">
                  <input 
                    type="radio" 
                    name="assignmentMode" 
                    value="specific" 
                    checked={assignmentMode === 'specific'}
                    onChange={() => setAssignmentMode('specific')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="FaFilter" className="text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">Clientes y proyectos específicos</h4>
                    </div>
                    <p className="text-xs text-gray-600">Selecciona manualmente los clientes, proyectos y permisos en el siguiente tab</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Tab 4: Clientes y Proyectos */}
          {currentTab === 4 && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <Icon name="FaUsers" className="text-green-600 text-4xl mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Soy el Tab 4: Clientes y Proyectos</h3>
                <p className="text-sm text-gray-600">Aquí irá el listado de clientes con sus proyectos y checkboxes de permisos</p>
              </div>
            </div>
          )}

          {/* Tab 5: Proyectos Confidenciales */}
          {currentTab === 5 && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                <Icon name="FaLock" className="text-red-600 text-4xl mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Soy el Tab 5: Proyectos Confidenciales</h3>
                <p className="text-sm text-gray-600">Aquí irá el listado de proyectos confidenciales con asignación explícita</p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            {currentTab > 1 && (
              <button 
                onClick={handlePrevious}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                <Icon name="FaArrowLeft" className="mr-2" />
                Anterior
              </button>
            )}
            {currentTab < totalTabs ? (
              <button 
                onClick={handleNext}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Siguiente
                <Icon name="FaArrowRight" className="ml-2" />
              </button>
            ) : (
              <button 
                onClick={handleSave}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Icon name="FaCheck" className="mr-2" />
                Crear Usuario
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeamsModal;