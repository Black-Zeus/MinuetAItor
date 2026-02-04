import React, { useState } from 'react';
import useBaseSiteStore from '@store/baseSiteStore';

const Demo = () => {
  const [count, setCount] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const { theme } = useBaseSiteStore();

  return (
    <div className="space-y-8">
      {/* ====================================
          HEADER SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          🎨 Dark Mode Demo Page
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Página de pruebas para validar el sistema de dark mode
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Modo actual: <span className="font-semibold text-primary-600 dark:text-primary-400">{theme}</span>
        </p>
      </div>

      {/* ====================================
          TYPOGRAPHY SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          📝 Tipografía
        </h2>
        
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Heading 1 - 4xl Bold
          </h1>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Heading 2 - 3xl Bold
          </h2>
          <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Heading 3 - 2xl Semibold
          </h3>
          <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Heading 4 - xl Semibold
          </h4>
          <h5 className="text-lg font-medium text-gray-700 dark:text-gray-200">
            Heading 5 - lg Medium
          </h5>
          <h6 className="text-base font-medium text-gray-700 dark:text-gray-200">
            Heading 6 - base Medium
          </h6>
          
          <p className="text-base text-gray-600 dark:text-gray-300 mt-4">
            Párrafo normal con texto de ejemplo. Este es el estilo típico de contenido.
          </p>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Texto pequeño secundario para subtítulos o información adicional.
          </p>
          
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Texto extra pequeño para notas al pie o metadatos.
          </p>
        </div>
      </div>

      {/* ====================================
          BUTTONS SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          🔘 Botones
        </h2>
        
        <div className="space-y-4">
          {/* Primary Buttons */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Primary
            </h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                Primary
              </button>
              <button className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                Primary Large
              </button>
              <button className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors">
                Primary Small
              </button>
            </div>
          </div>

          {/* Secondary Buttons */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Secondary
            </h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors">
                Secondary
              </button>
              <button className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
                Outline
              </button>
              <button className="px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                Ghost
              </button>
            </div>
          </div>

          {/* Status Buttons */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Status
            </h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors">
                Success
              </button>
              <button className="px-4 py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg transition-colors">
                Warning
              </button>
              <button className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors">
                Danger
              </button>
              <button className="px-4 py-2 bg-info-600 hover:bg-info-700 text-white rounded-lg transition-colors">
                Info
              </button>
            </div>
          </div>

          {/* Disabled */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Disabled
            </h3>
            <button 
              disabled 
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 rounded-lg cursor-not-allowed opacity-60"
            >
              Disabled Button
            </button>
          </div>
        </div>
      </div>

      {/* ====================================
          INPUTS SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          📝 Inputs y Forms
        </h2>
        
        <div className="space-y-4">
          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribe algo..."
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Texto ingresado: {inputValue || '(vacío)'}
            </p>
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder="ejemplo@correo.com"
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comentarios
            </label>
            <textarea
              rows={4}
              placeholder="Escribe tus comentarios..."
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-none"
            />
          </div>

          {/* Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categoría
            </label>
            <select className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors">
              <option>Selecciona una opción</option>
              <option>Opción 1</option>
              <option>Opción 2</option>
              <option>Opción 3</option>
            </select>
          </div>

          {/* Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="checkbox-demo"
              className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="checkbox-demo" className="text-sm text-gray-700 dark:text-gray-300">
              Acepto los términos y condiciones
            </label>
          </div>

          {/* Radio Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selecciona una opción:
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="radio1"
                name="radio-demo"
                className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:ring-primary-500"
              />
              <label htmlFor="radio1" className="text-sm text-gray-700 dark:text-gray-300">
                Opción 1
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="radio2"
                name="radio-demo"
                className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:ring-primary-500"
              />
              <label htmlFor="radio2" className="text-sm text-gray-700 dark:text-gray-300">
                Opción 2
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================
          LISTS SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          📋 Listas
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unordered List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Lista sin orden
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li>Primer elemento de la lista</li>
              <li>Segundo elemento con más texto para ver cómo se comporta</li>
              <li>Tercer elemento</li>
              <li>Cuarto elemento con descripción adicional</li>
            </ul>
          </div>

          {/* Ordered List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Lista ordenada
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li>Paso uno: Configurar el entorno</li>
              <li>Paso dos: Instalar dependencias</li>
              <li>Paso tres: Ejecutar el proyecto</li>
              <li>Paso cuatro: Validar resultados</li>
            </ol>
          </div>
        </div>

        {/* Custom List */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Lista personalizada
          </h3>
          <div className="space-y-2">
            <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs">
                ✓
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Item completado</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Con descripción adicional</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 bg-warning-600 text-white rounded-full flex items-center justify-center text-xs">
                !
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Item con advertencia</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Requiere atención</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center text-xs">
                •
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Item pendiente</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Aún por hacer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================
          CARDS SECTION
      ==================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Card Title 1
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Descripción de la card con información relevante que se adapta al modo oscuro.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-success-100 dark:bg-success-900/30 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Card Title 2
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Otra card de ejemplo con diferentes colores y contenido.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900/30 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Card Title 3
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Tercera card mostrando variedad en el diseño del sistema.
          </p>
        </div>
      </div>

      {/* ====================================
          ALERTS SECTION
      ==================================== */}
      <div className="space-y-4">
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-primary-600 dark:text-primary-400 text-xl">ℹ️</span>
            <div>
              <h4 className="font-semibold text-primary-900 dark:text-primary-100">Info Alert</h4>
              <p className="text-sm text-primary-800 dark:text-primary-200 mt-1">
                Este es un mensaje informativo que se adapta al modo oscuro.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-success-600 dark:text-success-400 text-xl">✅</span>
            <div>
              <h4 className="font-semibold text-success-900 dark:text-success-100">Success Alert</h4>
              <p className="text-sm text-success-800 dark:text-success-200 mt-1">
                Operación completada exitosamente.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-warning-600 dark:text-warning-400 text-xl">⚠️</span>
            <div>
              <h4 className="font-semibold text-warning-900 dark:text-warning-100">Warning Alert</h4>
              <p className="text-sm text-warning-800 dark:text-warning-200 mt-1">
                Ten cuidado con esta acción, podría tener consecuencias.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-danger-600 dark:text-danger-400 text-xl">❌</span>
            <div>
              <h4 className="font-semibold text-danger-900 dark:text-danger-100">Error Alert</h4>
              <p className="text-sm text-danger-800 dark:text-danger-200 mt-1">
                Ha ocurrido un error. Por favor, intenta nuevamente.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================
          INTERACTIVE SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          🎮 Componente Interactivo
        </h2>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCount(count - 1)}
            className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors"
          >
            -
          </button>
          
          <div className="flex-1 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Contador</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">
              {count}
            </p>
          </div>
          
          <button
            onClick={() => setCount(count + 1)}
            className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setCount(0)}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ====================================
          BADGES SECTION
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          🏷️ Badges y Labels
        </h2>
        
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 text-sm font-medium rounded-full">
            Primary
          </span>
          <span className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-200 text-sm font-medium rounded-full">
            Success
          </span>
          <span className="px-3 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-200 text-sm font-medium rounded-full">
            Warning
          </span>
          <span className="px-3 py-1 bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-200 text-sm font-medium rounded-full">
            Danger
          </span>
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-full">
            Neutral
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-primary-600 text-white text-xs font-semibold rounded">
            NEW
          </span>
          <span className="px-2 py-1 bg-success-600 text-white text-xs font-semibold rounded">
            ACTIVE
          </span>
          <span className="px-2 py-1 bg-warning-600 text-white text-xs font-semibold rounded">
            PENDING
          </span>
          <span className="px-2 py-1 bg-danger-600 text-white text-xs font-semibold rounded">
            URGENT
          </span>
        </div>
      </div>

      {/* ====================================
          CODE BLOCK
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          💻 Code Block
        </h2>
        
        <pre className="bg-gray-900 dark:bg-black text-gray-100 dark:text-gray-200 p-4 rounded-lg overflow-x-auto">
          <code>{`const theme = useBaseSiteStore((state) => state.theme);

const toggleDarkMode = () => {
  // Toggle entre light y dark
  toggleTheme();
};

// El dark mode se aplica automáticamente`}</code>
        </pre>
      </div>

      {/* ====================================
          TABLE
      ==================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            📊 Tabla
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rol
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  John Doe
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-200 text-xs font-medium rounded-full">
                    Activo
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  Administrador
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  Jane Smith
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-200 text-xs font-medium rounded-full">
                    Pendiente
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  Editor
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  Bob Johnson
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-full">
                    Inactivo
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  Viewer
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Demo;