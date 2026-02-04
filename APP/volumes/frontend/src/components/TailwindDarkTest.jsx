/**
 * TailwindDarkTest.jsx
 * Componente super simple para probar que Tailwind dark mode funciona
 */

import React, { useState } from 'react';

const TailwindDarkTest = () => {
  const [isDark, setIsDark] = useState(false);

  const toggleManual = () => {
    setIsDark(!isDark);
    
    // Aplicar/remover clase dark directamente
    if (!isDark) {
      document.documentElement.classList.add('dark');
      console.log('✅ MANUAL: Dark mode activado');
    } else {
      document.documentElement.classList.remove('dark');
      console.log('☀️ MANUAL: Light mode activado');
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 p-6 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-w-sm">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        🧪 Tailwind Dark Test
      </h3>
      
      {/* Test básico de colores */}
      <div className="space-y-3 mb-4">
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded">
          <p className="text-gray-900 dark:text-white">
            Este texto debe cambiar
          </p>
        </div>
        
        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded">
          <p className="text-blue-900 dark:text-blue-100">
            Este también
          </p>
        </div>
        
        <div className="p-3 bg-green-100 dark:bg-green-900 rounded">
          <p className="text-green-900 dark:text-green-100">
            Y este
          </p>
        </div>
      </div>

      {/* Botón de toggle manual */}
      <button
        onClick={toggleManual}
        className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white font-bold rounded-lg transition-colors"
      >
        {isDark ? '☀️ Activar Light' : '🌙 Activar Dark'}
      </button>

      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        <p>Estado: <span className="font-bold">{isDark ? 'DARK' : 'LIGHT'}</span></p>
        <p>Si los colores NO cambian, el problema es Tailwind</p>
        <p>Si SÍ cambian, el problema es el toggle del header</p>
      </div>
    </div>
  );
};

export default TailwindDarkTest;