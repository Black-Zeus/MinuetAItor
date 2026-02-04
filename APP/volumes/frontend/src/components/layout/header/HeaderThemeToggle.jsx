/**
 * HeaderThemeToggle.jsx
 * Toggle de theme con soporte para theme dinámico
 */

import React from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

const HeaderThemeToggle = ({ onClick, currentTheme = 'light' }) => {
  return (
    <button
      onClick={onClick}
      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      aria-label="Cambiar tema"
    >
      {currentTheme === 'light' ? (
        <FaMoon className="text-xl text-gray-600 dark:text-gray-300" />
      ) : (
        <FaSun className="text-xl text-gray-600 dark:text-gray-300" />
      )}
    </button>
  );
};

export default HeaderThemeToggle;