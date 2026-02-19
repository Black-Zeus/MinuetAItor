/**
 * HeaderThemeToggle.jsx
 * Toggle de tema con soporte para tema dinámico
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const HeaderThemeToggle = ({ onClick, currentTheme = 'light' }) => {
  return (
    <button
      onClick={onClick}
      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      aria-label="Cambiar tema"
    >
      <Icon
        name={currentTheme === 'light' ? 'FaMoon' : 'FaSun'}
        className="text-xl text-gray-600 dark:text-gray-300"
      />
    </button>
  );
};

export default HeaderThemeToggle;