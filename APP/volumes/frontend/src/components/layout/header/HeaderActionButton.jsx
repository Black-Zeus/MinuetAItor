/**
 * HeaderActionButton.jsx
 * Botón de acción con icono (notificaciones, mensajes, etc.) - 100% Tailwind
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const HeaderActionButton = ({ 
  iconName,
  onClick,
  ariaLabel,
  showBadge = false,
  className = '' 
}) => {
  return (
    <button
      className={`
        relative p-2 rounded-lg
        text-gray-600 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-700
        transition-colors
        ${className}
      `}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Icon name={iconName} className="w-5 h-5" />
      {showBadge && (
        <span className="
          absolute top-1 right-1
          w-2 h-2 bg-red-500 rounded-full
        "></span>
      )}
    </button>
  );
};

export default HeaderActionButton;