/**
 * HeaderActionButton.jsx
 * Botón de acción con badge dinámico
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const HeaderActionButton = ({ 
  iconName, 
  onClick, 
  ariaLabel,
  showBadge = false,
  badgeCount = 0
}) => {
  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      aria-label={ariaLabel}
    >
      <Icon name={iconName} className="text-xl text-gray-600 dark:text-gray-300" />
      
      {showBadge && badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </button>
  );
};

export default HeaderActionButton;