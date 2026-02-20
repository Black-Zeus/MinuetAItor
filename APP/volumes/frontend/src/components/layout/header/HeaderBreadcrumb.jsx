/**
 * HeaderBreadcrumb.jsx
 *
 * - Autónomo: lee useBreadcrumb internamente, no recibe items/title desde el padre
 * - Muestra solo el módulo actual como texto fijo (sin "Inicio /")
 * - Historial horizontal: más viejo (izq) → más nuevo (der)
 *   El store guarda [nuevo, ..., viejo] → invertimos y tomamos los primeros MAX
 * - Cada pill es un link navegable con tooltip (label + path)
 * - MAX_HISTORY configurable por prop (default 5)
 */

import React           from 'react';
import { useNavigate } from 'react-router-dom';
import useBaseSiteStore from '@store/baseSiteStore';
import useBreadcrumb    from '@/hooks/useBreadcrumb';
import Icon             from '@/components/ui/icon/iconManager';

const HeaderBreadcrumb = ({ className = '', maxHistory = 5 }) => {
  const navigate = useNavigate();

  // Módulo actual — último segmento del breadcrumb
  const { title, items } = useBreadcrumb();
  const currentLabel = items[items.length - 1]?.label ?? title;

  // Store guarda [más nuevo primero, ..., más viejo al final]
  // Invertimos → [más viejo, ..., más nuevo] y tomamos los primeros maxHistory
  const navHistory    = useBaseSiteStore((s) => s.navigationHistory ?? []);
  // navHistory = [más nuevo, ..., más viejo]
  // slice(0, max) → los más recientes → reverse() → mostrar viejo→nuevo en UI
  const historyToShow = [...navHistory].slice(0, maxHistory).reverse();

  return (
    <div className={`flex flex-col ${className}`}>

      {/* Título de página */}
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 leading-tight">
        {title}
      </h1>

      {/* Fila inferior: módulo actual · historial */}
      <div className="flex items-center mt-0.5 text-sm text-gray-500 dark:text-gray-400 flex-wrap gap-y-0.5">

        {/* Módulo actual — no es link, es la página donde estás */}
        <span className="text-gray-800 dark:text-gray-200 font-medium">
          {currentLabel}
        </span>

        {/* Separador visual */}
        {historyToShow.length > 0 && (
          <span className="mx-2 text-gray-300 dark:text-gray-600 select-none">·</span>
        )}

        {/* Pills: viejo → nuevo — cada una es un link real */}
        {historyToShow.map((entry, idx) => {
          const isLast = idx === historyToShow.length - 1;
          return (
            <React.Fragment key={`${entry.path}-${idx}`}>
              <button
                type="button"
                onClick={() => navigate(entry.path)}
                title={`${entry.name}\n${entry.path}`}
                className={[
                  'flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap cursor-pointer',
                  isLast
                    ? 'text-primary-600 dark:text-primary-400 font-semibold hover:underline'
                    : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:underline',
                ].join(' ')}
              >
                {entry.icon && (
                  <Icon name={entry.icon} className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate max-w-[120px]">{entry.name}</span>
              </button>

              {/* Separador entre pills */}
              {!isLast && (
                <Icon
                  name="FaChevronRight"
                  className="w-2.5 h-2.5 text-gray-300 dark:text-gray-600 mx-0.5 shrink-0"
                />
              )}
            </React.Fragment>
          );
        })}

      </div>
    </div>
  );
};

export default HeaderBreadcrumb;