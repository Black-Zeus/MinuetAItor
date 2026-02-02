/**
 * HeaderThemeToggle.jsx
 * Botón para cambiar entre tema claro/oscuro - 100% Tailwind
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const HeaderThemeToggle = ({ 
  onClick,
  className = '' 
}) => {
  const handleToggle = () => {
    document.documentElement.classList.toggle('dark');
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      className={`
        p-2 rounded-lg
        text-gray-600 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-700
        transition-colors
        ${className}
      `}
      onClick={handleToggle}
      aria-label="Cambiar tema"
    >
      <Icon name="FaSun" className="w-5 h-5 dark:hidden" />
      <Icon name="FaMoon" className="w-5 h-5 hidden dark:block" />
    </button>
  );
};

export default HeaderThemeToggle;