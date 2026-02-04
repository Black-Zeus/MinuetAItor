/**
 * DarkModeDebug.jsx
 * Componente de diagnóstico para dark mode
 * Agregar temporalmente al Layout para debugging
 */

import React, { useEffect, useState } from 'react';
import useBaseSiteStore from '@store/baseSiteStore';

const DarkModeDebug = () => {
  const { theme, toggleTheme } = useBaseSiteStore();
  const [htmlHasDark, setHtmlHasDark] = useState(false);
  const [localStorageData, setLocalStorageData] = useState(null);

  useEffect(() => {
    // Verificar cada 500ms
    const interval = setInterval(() => {
      const hasDark = document.documentElement.classList.contains('dark');
      setHtmlHasDark(hasDark);

      // Leer localStorage
      try {
        const stored = localStorage.getItem('minuteAItor-base-site');
        if (stored) {
          setLocalStorageData(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error leyendo localStorage:', e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg shadow-2xl max-w-md">
      <h3 className="text-lg font-bold mb-3 text-yellow-400">🔍 Dark Mode Debug</h3>
      
      <div className="space-y-2 text-xs font-mono">
        <div className="flex justify-between">
          <span>Store theme:</span>
          <span className={theme === 'dark' ? 'text-green-400' : 'text-red-400'}>
            {theme}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>HTML has 'dark' class:</span>
          <span className={htmlHasDark ? 'text-green-400' : 'text-red-400'}>
            {htmlHasDark ? 'YES ✓' : 'NO ✗'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>HTML classList:</span>
          <span className="text-blue-400">
            {Array.from(document.documentElement.classList).join(', ') || '(empty)'}
          </span>
        </div>

        {localStorageData && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <div className="text-xs text-gray-400 mb-1">localStorage:</div>
            <div className="text-green-400">
              theme: {localStorageData.state?.theme || 'undefined'}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          console.log('🎯 Manual toggle clicked');
          toggleTheme();
        }}
        className="mt-3 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
      >
        Manual Toggle (usar si header no funciona)
      </button>

      <button
        onClick={() => {
          console.log('🔄 Forzando dark class manualmente');
          document.documentElement.classList.toggle('dark');
        }}
        className="mt-2 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
      >
        Force Toggle HTML Class
      </button>
    </div>
  );
};

export default DarkModeDebug;