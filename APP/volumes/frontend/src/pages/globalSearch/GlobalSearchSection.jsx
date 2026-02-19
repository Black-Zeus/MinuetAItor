/**
 * GlobalSearchSection.jsx
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon/iconManager';
import { ModalManager } from '@/components/ui/modal';
import ClientModal, { CLIENT_MODAL_MODES }           from '@/pages/clientes/ClientModal';
import ProjectModal, { PROJECT_MODAL_MODES }         from '@/pages/project/ProjectModal';
import TagsModal, { TAGS_MODAL_MODES }               from '@/pages/tags/TagsModal';
import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from '@/pages/profiles/ProfilesCatalogModal';

// ====================================
// NOTA DE CAMPOS POR MÓDULO
// ====================================
const SEARCH_FIELDS_NOTE = {
  clientes:  'Busca en: nombre, cargo, empresa, email, teléfono, industria y estado.',
  proyectos: 'Busca en: nombre del proyecto, cliente, descripción, estado y etiquetas.',
  minutes:   'Busca en: título, resumen, cliente, proyecto, participantes y estado.',
  tags:      'Busca en: nombre de etiqueta, categoría y descripción.',
  teams:     'Busca en: nombre, cargo, email, departamento, rol de sistema y estado.',
  profiles:  'Busca en: nombre del perfil, categoría y descripción.',
};

const FieldsNote = ({ moduleId }) => {
  const note = SEARCH_FIELDS_NOTE[moduleId];
  if (!note) return null;
  return (
    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-700 pt-2">
      <Icon name="FaCircleInfo" className="inline mr-1 text-[10px]" />
      {note}
    </p>
  );
};

// ====================================
// SIN RESULTADOS
// ====================================
const EmptySection = () => (
  <tr>
    <td colSpan={99} className="px-4 py-6 text-center">
      <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
        <Icon name="FaFolderOpen" className="text-base" />
        <span className="text-sm">Sin registros para esta sección</span>
      </div>
    </td>
  </tr>
);

// ====================================
// BADGE CONFIDENCIAL
// ====================================
const ConfidentialBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
    <Icon name="FaLock" className="text-[10px]" />
    Confidencial
  </span>
);

// ====================================
// PAGINADOR
// ====================================
const Paginator = ({ currentPage, totalPages, onPage }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1 justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
      <button onClick={() => onPage(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Icon name="FaChevronLeft" className="text-xs" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button key={page} onClick={() => onPage(page)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === currentPage ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
          {page}
        </button>
      ))}
      <button onClick={() => onPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Icon name="FaChevronRight" className="text-xs" />
      </button>
    </div>
  );
};

// ====================================
// MODALES
// ====================================
const openClientModal = (item) => {
  const close = () => { ModalManager.hide?.(); ModalManager.close?.(); ModalManager.dismiss?.(); ModalManager.closeAll?.(); };
  ModalManager.show({ type: 'custom', title: 'Detalle Cliente', size: 'large', showFooter: false,
    content: <ClientModal mode={CLIENT_MODAL_MODES.VIEW} data={item.rawData} onClose={close} /> });
};
const openProjectModal = (item) => {
  ModalManager.show({ type: 'custom', title: 'Detalles del Proyecto', size: 'large', showFooter: false,
    content: <ProjectModal mode={PROJECT_MODAL_MODES.VIEW} data={item.rawData} clients={[]} onClose={() => ModalManager.closeAll?.()} onSubmit={() => {}} /> });
};
const openTagModal = (item) => {
  ModalManager.show({ type: 'custom', title: 'Detalle de Etiqueta', size: 'large', showFooter: false,
    content: <TagsModal mode={TAGS_MODAL_MODES.VIEW} data={item.rawData} onClose={() => ModalManager.closeAll?.()} onSubmit={() => {}} /> });
};
const openProfileModal = (item) => {
  ModalManager.show({ type: 'custom', title: 'Ver Perfil de Análisis', size: 'large', showFooter: false,
    content: <ProfilesCatalogModal mode={PROFILE_MODAL_MODES.VIEW} profile={item.rawData} onClose={() => ModalManager.closeAll?.()} onSubmit={() => {}} /> });
};

// ====================================
// MINUTAS: ACCIÓN POR STATUS
// ====================================
const MINUTE_EDITABLE = ['pending', 'ready-for-edit'];
const resolveMinuteAction = (item, navigate) => {
  if (MINUTE_EDITABLE.includes(item.status ?? '')) {
    return { icon: 'FaArrowUpRightFromSquare', label: 'Abrir Minuta', handler: () => navigate(`/minutes/process/${item.id}`) };
  }
  return {
    icon: 'FaDownload', label: 'Descargar PDF',
    handler: () => {
      const filename = `${item.date ?? 'minuta'}_${item.label}.pdf`.replace(/\s+/g, '_');
      fetch('/pdf/demo.pdf', { cache: 'no-store' }).then(r => r.blob()).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }).catch(() => ModalManager.error?.({ title: 'Error', message: 'No fue posible descargar el PDF.' }));
    },
  };
};

const ACTION_BY_MODULE = {
  clientes:  { icon: 'FaEye', label: 'Ver Cliente',  handler: openClientModal  },
  proyectos: { icon: 'FaEye', label: 'Ver Proyecto', handler: openProjectModal },
  tags:      { icon: 'FaEye', label: 'Ver Etiqueta', handler: openTagModal     },
  profiles:  { icon: 'FaEye', label: 'Ver Perfil',   handler: openProfileModal },
  minutes:   { icon: 'FaArrowUpRightFromSquare', label: 'Abrir Minuta', handler: null },
  default:   { icon: 'FaArrowUpRightFromSquare', label: 'Abrir',        handler: null },
};
const getAction = (moduleId, item, navigate) => {
  if (moduleId === 'minutes') return resolveMinuteAction(item, navigate);
  return ACTION_BY_MODULE[moduleId] ?? ACTION_BY_MODULE.default;
};

// ====================================
// BADGES
// ====================================
const MINUTE_STATUS_CFG = {
  completed:        { label: 'Completada',      cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  pending:          { label: 'Pendiente',        cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
  'in-progress':    { label: 'En Progreso',      cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  'ready-for-edit': { label: 'Lista p/ edición', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
};
const MinuteStatusBadge = ({ status }) => {
  const cfg = MINUTE_STATUS_CFG[status] ?? MINUTE_STATUS_CFG.pending;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.cls}`}>{cfg.label}</span>;
};

const GenericStatusBadge = ({ status }) => {
  const isActive = ['active', 'activo'].includes(String(status).toLowerCase());
  const cls = isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>{isActive ? 'Activo' : 'Inactivo'}</span>;
};

// Rol de sistema — solo equipos
const ROLE_CFG = {
  admin: { label: 'Admin',     cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  write: { label: 'Escritura', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  read:  { label: 'Lectura',   cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
};
const RoleBadge = ({ role }) => {
  const cfg = ROLE_CFG[role] ?? ROLE_CFG.read;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.cls}`}>{cfg.label}</span>;
};

// ====================================
// COLUMNAS POR MÓDULO
// ====================================
const COLUMNS = {
  clientes: [
    { key: 'nombre',   label: 'Nombre',   align: 'left',   width: '18%' },
    { key: 'cargo',    label: 'Cargo',    align: 'left',   width: '15%' },
    { key: 'empresa',  label: 'Empresa',  align: 'left',   width: '17%' },
    { key: 'telefono', label: 'Teléfono', align: 'left',   width: '13%' },
    { key: 'email',    label: 'Email',    align: 'left',   width: '20%' },
    { key: 'estado',   label: 'Estado',   align: 'center', width: '10%' },
    { key: 'accion',   label: 'Acción',   align: 'right',  width: '7%'  },
  ],
  proyectos: [
    { key: 'nombre',      label: 'Nombre',      align: 'left',   width: '20%' },
    { key: 'cliente',     label: 'Cliente',     align: 'left',   width: '18%' },
    { key: 'descripcion', label: 'Descripción', align: 'left',   width: '32%' },
    { key: 'estado',      label: 'Estado',      align: 'center', width: '13%' },
    { key: 'accion',      label: 'Acción',      align: 'right',  width: '17%' },
  ],
  minutes: [
    { key: 'nombre',  label: 'Nombre',  align: 'left',   width: '27%' },
    { key: 'detalle', label: 'Detalle', align: 'left',   width: '25%' },
    { key: 'fecha',   label: 'Fecha',   align: 'center', width: '13%' },
    { key: 'estado',  label: 'Estado',  align: 'center', width: '15%' },
    { key: 'accion',  label: 'Acción',  align: 'right',  width: '20%' },
  ],
  tags: [
    { key: 'nombre',      label: 'Nombre',      align: 'left',   width: '18%' },
    { key: 'categoria',   label: 'Categoría',   align: 'left',   width: '18%' },
    { key: 'descripcion', label: 'Descripción', align: 'left',   width: '37%' },
    { key: 'estado',      label: 'Estado',      align: 'center', width: '13%' },
    { key: 'accion',      label: 'Acción',      align: 'right',  width: '14%' },
  ],
  teams: [
    { key: 'nombre',  label: 'Nombre',  align: 'left',   width: '22%' },
    { key: 'email',   label: 'Email',   align: 'left',   width: '25%' },
    { key: 'cargo',   label: 'Cargo',   align: 'left',   width: '18%' },
    { key: 'rol',     label: 'Rol',     align: 'center', width: '12%' },
    { key: 'estado',  label: 'Estado',  align: 'center', width: '11%' },
    { key: 'accion',  label: 'Acción',  align: 'right',  width: '12%' },
  ],
  profiles: [
    { key: 'nombre',      label: 'Nombre',      align: 'left',   width: '20%' },
    { key: 'categoria',   label: 'Categoría',   align: 'left',   width: '18%' },
    { key: 'descripcion', label: 'Descripción', align: 'left',   width: '36%' },
    { key: 'estado',      label: 'Estado',      align: 'center', width: '12%' },
    { key: 'accion',      label: 'Acción',      align: 'right',  width: '14%' },
  ],
  default: [
    { key: 'nombre',  label: 'Nombre',  align: 'left',   width: '35%' },
    { key: 'detalle', label: 'Detalle', align: 'left',   width: '35%' },
    { key: 'info',    label: 'Info',    align: 'right',  width: '15%' },
    { key: 'accion',  label: 'Acción',  align: 'right',  width: '15%' },
  ],
};
const getColumns  = (moduleId) => COLUMNS[moduleId] ?? COLUMNS.default;
const alignClass  = { left: 'text-left', center: 'text-center', right: 'text-right' };

// ====================================
// FILA
// ====================================
const ResultRow = ({ item, moduleId, onNavigate }) => {
  const navigate    = useNavigate();
  const action      = getAction(moduleId, item, navigate);
  const isMinutes   = moduleId === 'minutes';
  const isTags      = moduleId === 'tags';
  const isProyectos = moduleId === 'proyectos';
  const isClientes  = moduleId === 'clientes';
  const isProfiles  = moduleId === 'profiles';
  const isTeams     = moduleId === 'teams';
  const isDefault   = !isMinutes && !isTags && !isProyectos && !isClientes && !isProfiles && !isTeams;

  const handleAction = (e) => {
    e.stopPropagation();
    if (action.handler) action.handler(item);
    else onNavigate(item);
  };

  return (
    <tr className="group border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">

      {/* Nombre — siempre primero */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
            {item.label}
          </span>
          {item.isConfidential && <ConfidentialBadge />}
        </div>
      </td>

      {/* CLIENTES: cargo · empresa · teléfono · email · estado */}
      {isClientes && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400 truncate block">{item.position || '-'}</span></td>}
      {isClientes && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400 truncate block">{item.company || '-'}</span></td>}
      {isClientes && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400">{item.phone || '-'}</span></td>}
      {isClientes && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400 truncate block">{item.email || '-'}</span></td>}
      {isClientes && <td className="px-4 py-3 text-center"><GenericStatusBadge status={item.status} /></td>}

      {/* PROYECTOS: cliente · descripción · estado */}
      {isProyectos && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400">{item.client || '-'}</span></td>}
      {isProyectos && <td className="px-4 py-3"><span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.description || '-'}</span></td>}
      {isProyectos && <td className="px-4 py-3 text-center"><GenericStatusBadge status={item.status} /></td>}

      {/* MINUTAS: resumen · estado · fecha */}
      {isMinutes && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{item.sublabel}</span></td>}
      {isMinutes && <td className="px-4 py-3 text-center"><span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.date || '-'}</span></td>}
      {isMinutes && <td className="px-4 py-3 text-center"><MinuteStatusBadge status={item.status} /></td>}

      {/* TAGS: categoría · estado · descripción */}
      {isTags && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400">{item.category || '-'}</span></td>}
      {isTags && <td className="px-4 py-3"><span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.description || '-'}</span></td>}
      {isTags && <td className="px-4 py-3 text-center"><GenericStatusBadge status={item.status} /></td>}

      {/* EQUIPOS: email · cargo · rol · estado */}
      {isTeams && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400 truncate block">{item.email || '-'}</span></td>}
      {isTeams && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400 truncate block">{item.position || '-'}</span></td>}
      {isTeams && <td className="px-4 py-3 text-center"><RoleBadge role={item.systemRole} /></td>}
      {isTeams && <td className="px-4 py-3 text-center"><GenericStatusBadge status={item.status} /></td>}

      {/* PERFILES: categoría · estado · descripción */}
      {isProfiles && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400">{item.categoria || '-'}</span></td>}
      {isProfiles && <td className="px-4 py-3"><span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.description || '-'}</span></td>}
      {isProfiles && <td className="px-4 py-3 text-center"><GenericStatusBadge status={item.status} /></td>}

      {/* DEFAULT */}
      {isDefault && <td className="px-4 py-3"><span className="text-sm text-gray-500 dark:text-gray-400">{item.sublabel}</span></td>}
      {isDefault && <td className="px-4 py-3 text-right"><span className="text-xs text-gray-400 dark:text-gray-500">{item.meta}</span></td>}

      {/* Acción — siempre */}
      <td className="px-4 py-3 text-right">
        <button onClick={handleAction} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer whitespace-nowrap">
          <Icon name={action.icon} className="text-[10px]" />
          {action.label}
        </button>
      </td>
    </tr>
  );
};

// ====================================
// SECCIÓN PRINCIPAL
// ====================================
const GlobalSearchSection = ({ module, items, limit }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(items.length > 0);
  const [page,   setPage]   = useState(1);

  // Colapsar si queda sin resultados (ej: filtro de estado), expandir si los recupera
  useEffect(() => {
    setIsOpen(items.length > 0);
    setPage(1); // resetear página al filtrar
  }, [items.length]);

  const hasItems   = items.length > 0;
  const totalPages = hasItems ? Math.ceil(items.length / limit) : 0;
  const start      = (page - 1) * limit;
  const pageItems  = items.slice(start, start + limit);
  const columns    = getColumns(module.id);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">

      {/* Header colapsable */}
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left">
        <div className="flex items-center gap-2">
          <Icon name={module.icon} className="text-sm text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{module.label}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hasItems ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
            {items.length} resultado{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Icon name={isOpen ? 'FaChevronUp' : 'FaChevronDown'} className="text-xs text-gray-400" />
      </button>

      {/* Tabla */}
      {isOpen && (
        <div className="px-4 pb-4">
          <table className="w-full table-fixed">
            <colgroup>
              {columns.map((col) => <col key={col.key} style={{ width: col.width }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide ${alignClass[col.align]}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasItems
                ? pageItems.map((item) => (
                    <ResultRow key={item.id} item={item} moduleId={module.id} onNavigate={(i) => navigate(i.navigateTo)} />
                  ))
                : <EmptySection />
              }
            </tbody>
          </table>

          {hasItems && (
            <Paginator currentPage={page} totalPages={totalPages} onPage={(p) => { if (p >= 1 && p <= totalPages) setPage(p); }} />
          )}

          <FieldsNote moduleId={module.id} />
        </div>
      )}
    </div>
  );
};

export default GlobalSearchSection;