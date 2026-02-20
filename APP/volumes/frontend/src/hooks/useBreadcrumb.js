/**
 * useBreadcrumb.js
 * Deriva el breadcrumb desde la URL actual y registra en navigationHistory.
 *
 * Para rutas estáticas (sidebar, standalone) → registra automáticamente.
 * Para rutas dinámicas (/minutes/process/:id) → registra nombre genérico "Edición"
 *   PERO si la página llama useNavEntryUpdate({ label, meta }) sobrescribe la entry
 *   con el título real de la minuta y los metadatos (id, etc.)
 *
 * Configuración:
 *   NAV_HISTORY_MAX — entradas que persiste el store (default 10)
 *   HeaderBreadcrumb tiene su propio prop maxHistory (cuántas muestra la UI)
 */

import { useEffect }   from 'react';
import { useLocation } from 'react-router-dom';
import { SIDEBAR_MODULES } from '@config/sidebarConfig';
import useBaseSiteStore    from '@store/baseSiteStore';

// ─── Configuración ────────────────────────────────────────────────────────────
const NAV_HISTORY_MAX = 10;

// ─── Rutas standalone ─────────────────────────────────────────────────────────
const STANDALONE_ROUTES = [
  { path: '/globalSearch',         name: 'Búsqueda Global', icon: 'FaMagnifyingGlass' },
  { path: '/settings/userProfile', name: 'Mi Perfil',       icon: 'FaPerson'          },
  { path: '/help',                 name: 'Ayuda & Soporte', icon: 'FaCircleInfo'      },
];

// ─── Rutas dinámicas ──────────────────────────────────────────────────────────
// nameResolver(pathname) → nombre a mostrar antes de que la página sobreescriba con metadatos reales
const DYNAMIC_ROUTES = [
  {
    pattern:      /^\/minutes\/process\/([^/]+)$/,
    name:         'Edición',           // fallback hasta que la página llame useNavEntryUpdate
    icon:         'FaPenToSquare',
    parentPath:   '/minutes',
    extractId:    (pathname) => pathname.split('/').pop(), // extrae el id del path
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const findModuleByPath = (modules, pathname) => {
  for (const module of modules) {
    if (module.path === pathname) return { module, parent: null };
    if (module.children?.length) {
      for (const child of module.children) {
        if (child.path === pathname) return { module: child, parent: module };
      }
    }
  }
  return null;
};

const findModuleFlat = (modules, path) => {
  for (const module of modules) {
    if (module.path === path) return module;
    if (module.children?.length) {
      for (const child of module.children) {
        if (child.path === path) return child;
      }
    }
  }
  return null;
};

const buildItems = (segments) =>
  segments.map((seg, index) =>
    index < segments.length - 1
      ? { label: seg.name, href: seg.path || '#' }
      : { label: seg.name }
  );

const INICIO = { name: 'Inicio', path: '/dashboard' };

// ─── Hook principal ───────────────────────────────────────────────────────────
const useBreadcrumb = () => {
  const { pathname } = useLocation();
  const addToNavigationHistory = useBaseSiteStore((s) => s.addToNavigationHistory);

  let resolved = null;

  // 1. sidebarConfig — match exacto
  const found = findModuleByPath(SIDEBAR_MODULES, pathname);
  if (found) {
    const { module, parent } = found;
    const segments = parent ? [INICIO, parent, module] : [INICIO, module];
    resolved = {
      name:  module.name,
      icon:  module.icon ?? null,
      items: buildItems(segments),
      meta:  null,
    };
  }

  // 2. Rutas dinámicas — match por regex
  if (!resolved) {
    const dynamic = DYNAMIC_ROUTES.find((r) => r.pattern.test(pathname));
    if (dynamic) {
      const segments = [INICIO];
      if (dynamic.parentPath) {
        const parentModule = findModuleFlat(SIDEBAR_MODULES, dynamic.parentPath);
        if (parentModule) segments.push(parentModule);
      }
      segments.push({ name: dynamic.name, path: pathname });
      resolved = {
        name: dynamic.name,
        icon: dynamic.icon ?? null,
        items: buildItems(segments),
        // meta inicial con id extraído del path — se completa con useNavEntryUpdate
        meta: dynamic.extractId
          ? { id: dynamic.extractId(pathname) }
          : null,
      };
    }
  }

  // 3. Rutas standalone
  if (!resolved) {
    const standalone = STANDALONE_ROUTES.find((r) => pathname.startsWith(r.path));
    if (standalone) {
      resolved = {
        name:  standalone.name,
        icon:  standalone.icon ?? null,
        items: buildItems([INICIO, standalone]),
        meta:  null,
      };
    }
  }

  // 4. Fallback
  if (!resolved) {
    resolved = { name: 'Inicio', icon: null, items: buildItems([INICIO]), meta: null };
  }

  // Registrar en historial al cambiar pathname
  useEffect(() => {
    addToNavigationHistory({
      name: resolved.name,
      path: pathname,
      icon: resolved.icon,
      meta: resolved.meta,  // { id } para rutas dinámicas — label se actualiza con useNavEntryUpdate
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return {
    title: resolved.name,
    items: resolved.items,
  };
};

/**
 * useNavEntryUpdate
 * Se llama desde páginas con rutas dinámicas para enriquecer la entry de historial
 * con el título real del recurso y metadatos adicionales.
 *
 * Uso en la página de edición de minutas:
 *
 *   useNavEntryUpdate({
 *     label: minute.title,          // reemplaza "Edición" con el asunto real
 *     meta: { id: minute.id }       // persiste el id para poder volver
 *   });
 *
 * Se llama cuando `label` esté disponible (post-fetch).
 * El pathname actual se usa como key para encontrar la entry en el historial.
 */
export const useNavEntryUpdate = ({ label, meta = {} }) => {
  const { pathname } = useLocation();
  const updateNavigationEntry = useBaseSiteStore((s) => s.updateNavigationEntry);

  useEffect(() => {
    if (!label) return; // esperar a que el dato esté disponible
    updateNavigationEntry(pathname, { name: label, meta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, pathname]);
};

export default useBreadcrumb;