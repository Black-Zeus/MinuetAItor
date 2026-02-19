/**
 * HeaderBreadcrumb.jsx
 * Componente de breadcrumb/migas de pan - 100% Tailwind
 */

import React from 'react';

const HeaderBreadcrumb = ({
  title,
  items = [],
  className = ''
}) => {
  return (
    <div className={className}>
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
        {title}
      </h1>
      {items.length > 0 && (
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-0.5">
          {items.map((item, index) => (
            <React.Fragment key={index}>
              {item.href ? (
                <a
                  href={item.href}
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  onClick={item.onClick}
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-gray-800 dark:text-gray-200">
                  {item.label}
                </span>
              )}
              {index < items.length - 1 && (
                <span className="mx-2">/</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderBreadcrumb;