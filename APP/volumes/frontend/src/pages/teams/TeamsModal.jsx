/**
 * TeamsModal.jsx — v4 (definitivo)
 *
 * Fixes:
 *  1. h-[80vh] fijo — el modal NO cambia de tamaño entre pasos.
 *     Cada body scrollea internamente cuando necesita más espacio.
 *  2. VIEW mode paso "Clientes y Proyectos": muestra SOLO los asignados al usuario.
 *     EDIT mode: muestra el catálogo completo para seleccionar.
 *  3. Resumen (VIEW y EDIT): lista clientes + proyectos con candados, siempre.
 *  4. email omitido del payload UPDATE si el usuario no lo cambió
 *     (fix para emails .local guardados en BD que no pasan validación RFC).
 *  5. color hex → nombre corto al normalizar desde backend.
 *  6. normalizeUser convierte clients[]/projects[] planos del backend
 *     en la estructura clientProjects que usa el modal.
 *
 * Pasos EDIT/VIEW:  Info General → Rol → Modo Acceso → Clientes/Proyectos → Confirmación
 * Pasos CREATE:     Info General → Rol → Modo Acceso → Confirmación
 */

import React, { useEffect, useMemo, useState } from "react";
import Icon         from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError } from "@/components/common/toast/toastHelpers";

import clientService  from "@/services/clientService";
import projectService from "@/services/projectService";

// ─── Modos ────────────────────────────────────────────────────────────────────

const MODES = {
  CREATE: "createNewTeam",
  VIEW:   "viewDetailTeam",
  EDIT:   "editCurrentTeam",
};

// ─── Departamentos (enum backend exacto) ──────────────────────────────────────

const DEPARTMENTS = [
  { value: "operations", label: "Operaciones"     },
  { value: "it",         label: "Tecnología (IT)" },
  { value: "sales",      label: "Ventas"           },
  { value: "marketing",  label: "Marketing"        },
  { value: "finance",    label: "Finanzas"         },
  { value: "hr",         label: "Recursos Humanos" },
];
const deptLabel = (val) =>
  DEPARTMENTS.find((d) => d.value === val)?.label ?? val ?? "—";

// ─── Colores avatar ───────────────────────────────────────────────────────────

const COLORS = ["blue","green","purple","red","orange","teal","pink","yellow"];
const COLOR_MAP = {
  blue:   "from-blue-500 to-blue-700",
  green:  "from-green-500 to-green-700",
  purple: "from-purple-500 to-purple-700",
  red:    "from-red-500 to-red-700",
  orange: "from-orange-500 to-orange-700",
  teal:   "from-teal-500 to-teal-700",
  pink:   "from-pink-500 to-pink-700",
  yellow: "from-yellow-500 to-yellow-700",
};
const HEX_TO_NAME = {
  "#6366f1":"purple","#8b5cf6":"purple","#a855f7":"purple",
  "#3b82f6":"blue",  "#2563eb":"blue",  "#1d4ed8":"blue",
  "#10b981":"green", "#059669":"green",
  "#ef4444":"red",   "#dc2626":"red",
  "#f97316":"orange","#ea580c":"orange",
  "#14b8a6":"teal",  "#0d9488":"teal",
  "#ec4899":"pink",  "#db2777":"pink",
  "#eab308":"yellow","#ca8a04":"yellow",
};
const normalizeColor = (c) => {
  if (!c) return "blue";
  const l = String(c).toLowerCase();
  return COLORS.includes(l) ? l : (HEX_TO_NAME[l] ?? "blue");
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeText = (v) => String(v ?? "").trim();
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const computeInitials = (name) => {
  const n = normalizeText(name);
  if (!n) return "";
  const p = n.split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1]?.[0] ?? "" : "")).toUpperCase();
};

/**
 * normalizeUser — convierte el shape del backend al shape interno del modal.
 *
 * El backend devuelve:
 *   clients:  ["uuid1", "uuid2", ...]   (IDs de clientes asignados)
 *   projects: ["uuid3", "uuid4", ...]   (IDs de proyectos asignados)
 *
 * El modal trabaja internamente con:
 *   clientProjects: { [clientId]: { clientEnabled: bool, projects: Set<projectId> } }
 *
 * IMPORTANTE: el backend NO dice qué proyecto pertenece a qué cliente en los arrays planos.
 * Guardamos _clientIds y _projectIds como arrays separados para uso posterior.
 * StepAccessControl reconstruirá clientProjects correctamente cruzando con el catálogo.
 */
const normalizeUser = (data = {}) => {
  const name           = data.name ?? data.full_name ?? "";
  const status         = (data.status ?? "active") === "inactive" ? "inactive" : "active";
  const rawRole        = data.systemRole ?? data.system_role ?? "READ";
  const systemRole     = ["ADMIN","EDITOR","READ"].includes(rawRole) ? rawRole : "READ";
  const assignmentMode = ((data.assignmentMode ?? data.assignment_mode ?? "specific") === "all") ? "all" : "specific";

  const clientIds  = Array.isArray(data.clients)  ? data.clients  : [];
  const projectIds = Array.isArray(data.projects) ? data.projects : [];

  // clientProjects inicial: cada cliente con todos los proyectos como pool.
  // StepAccessControl lo reconstruirá correctamente con el catálogo.
  const clientProjects = data.clientProjects ?? {};
  if (Object.keys(clientProjects).length === 0 && clientIds.length > 0) {
    clientIds.forEach((cid) => {
      clientProjects[cid] = { clientEnabled: true, projects: new Set(projectIds) };
    });
  }

  return {
    id:             data.id           ?? "",
    name:           normalizeText(name),
    username:       normalizeText(data.username),
    email:          normalizeText(data.email),
    emailOriginal:  normalizeText(data.email),   // para detectar si cambió
    position:       normalizeText(data.position),
    phone:          normalizeText(data.phone),
    department:     normalizeText(data.department),
    status,
    systemRole:     normalizeText(data.systemRole).toLocaleUpperCase("es-CL"),
    assignmentMode,
    notes:          normalizeText(data.notes),
    initials:       normalizeText(data.initials) || computeInitials(name),
    color:          normalizeColor(data.color),
    createdAt:      normalizeText(data.createdAt),
    _clientIds:     clientIds,    // arrays planos originales del backend
    _projectIds:    projectIds,
    clientProjects,
  };
};

// ─── Micro-componentes ────────────────────────────────────────────────────────

const SectionTitle = ({ number, color, children }) => {
  const cls = { blue:"bg-blue-500", purple:"bg-purple-500", green:"bg-green-500", amber:"bg-amber-500", gray:"bg-gray-500" };
  return (
    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${cls[color] ?? cls.gray} text-white text-xs flex-shrink-0`}>
        {number}
      </span>
      {children}
    </h4>
  );
};

const FieldRow = ({ label, value, icon }) => (
  <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0 gap-2">
    <span className="text-gray-500 dark:text-gray-400 font-medium flex-shrink-0 flex items-center gap-1.5">
      {icon && <Icon name={icon} className="w-3 h-3" />}
      {label}
    </span>
    <span className="text-gray-800 dark:text-gray-200 text-right">
      {value || <em className="text-gray-400 font-normal">—</em>}
    </span>
  </div>
);

const ViewField = ({ label, value }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</label>
    <p className="text-sm text-gray-800 dark:text-gray-200 min-h-[1.5rem]">
      {value || <em className="text-gray-400">—</em>}
    </p>
  </div>
);

const FormField = ({ label, required, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm rounded-lg border transition-colors bg-white dark:bg-gray-800 ` +
  `text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 ` +
  (err ? "border-red-400 dark:border-red-500"
       : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500");

// ─── Validación ───────────────────────────────────────────────────────────────

const validateStep = (step, formData, isCreate) => {
  const e = {};
  if (step === 0) {
    if (!formData.name.trim())  e.name  = "El nombre es obligatorio";
    if (!formData.email.trim()) e.email = "El email es obligatorio";
    else if (!EMAIL_RE.test(formData.email)) e.email = "Email inválido";
    if (isCreate) {
      if (!formData.username.trim()) e.username   = "El usuario es obligatorio";
      if (!formData.position.trim()) e.position   = "El cargo es obligatorio";
      if (!formData.department)      e.department = "El departamento es obligatorio";
      if (!formData.initials.trim()) e.initials   = "Las iniciales son obligatorias";
    }
  }
  if (step === 1 && !formData.systemRole) e.systemRole = "Selecciona un rol";
  return e;
};

// ══════════════════════════════════════════════════════════════════════════════
// ACORDEÓN DE CLIENTE (un cliente + sus proyectos)
// ══════════════════════════════════════════════════════════════════════════════

const ClientAccordion = ({
  clientRows, confidential, selection,
  onToggleClient, onToggleProject, onToggleAllProjects,
  isView, searchValue,
}) => {
  const [expanded, setExpanded] = useState({});
  const toggleOpen = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const filtered = useMemo(() => {
    if (!searchValue) return clientRows;
    const term = searchValue.toLowerCase();
    return clientRows.map((row) => {
      const clientHit = row.client.name.toLowerCase().includes(term);
      const projHit   = row.projects.filter((p) => p.name.toLowerCase().includes(term));
      if (clientHit || projHit.length) return { ...row, projects: clientHit ? row.projects : projHit };
      return null;
    }).filter(Boolean);
  }, [clientRows, searchValue]);

  if (!filtered.length)
    return <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">{searchValue ? "Sin resultados." : "No hay elementos."}</p>;

  const activeBg    = confidential ? "bg-amber-500"  : "bg-primary-600";
  const activeBdr   = confidential ? "border-amber-400 dark:border-amber-600" : "border-primary-400 dark:border-primary-600";
  const badgeSel    = confidential ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300";
  const badgeGray   = "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400";
  const chkColor    = confidential ? "text-amber-600 focus:ring-amber-500" : "text-primary-600 focus:ring-primary-500";
  const rowSelBg    = confidential ? "bg-amber-50 dark:bg-amber-900/10" : "bg-primary-50 dark:bg-primary-900/10";

  return (
    <div className="space-y-2">
      {filtered.map(({ client, projects, totalCount }) => {
        const sel      = selection[client.id] ?? { clientEnabled: false, projects: new Set() };
        const enabled  = !!sel.clientEnabled;
        const selSet   = sel.projects instanceof Set ? sel.projects : new Set(sel.projects ?? []);
        const selCount = projects.filter((p) => selSet.has(p.id)).length;
        const allSel   = projects.length > 0 && projects.every((p) => selSet.has(p.id));
        const isOpen   = expanded[client.id] ?? false;
        const total    = totalCount ?? projects.length;

        return (
          <div key={client.id} className={`rounded-lg border-2 overflow-hidden transition-colors ${enabled ? activeBdr : "border-gray-200 dark:border-gray-700"}`}>

            {/* ── Cabecera ── */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800">
              {/* Toggle (solo EDIT) */}
              {!isView && (
                <button type="button" onClick={() => onToggleClient(client.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${enabled ? activeBg : "bg-gray-300 dark:bg-gray-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
                </button>
              )}

              {/* Nombre + badges */}
              <button type="button" onClick={() => toggleOpen(client.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                <span className={`font-semibold text-sm truncate transition-colors ${enabled ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>
                  {client.name}
                </span>
                {confidential && <Icon name="FaLock" className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                {/* Badge "Y de X proyectos" — X siempre visible */}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap ${enabled && selCount > 0 ? badgeSel : badgeGray}`}>
                  {enabled && selCount > 0 ? `${selCount} de ${total} proyecto${total !== 1 ? "s" : ""}` : `${total} proyecto${total !== 1 ? "s" : ""}`}
                </span>
              </button>

              {/* Todos / Ninguno (solo EDIT con cliente activo) */}
              {enabled && !isView && projects.length > 0 && (
                <button type="button" onClick={() => onToggleAllProjects(client.id, projects)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 hover:underline underline-offset-2">
                  {allSel ? "Ninguno" : "Todos"}
                </button>
              )}

              {/* Chevron */}
              <button type="button" onClick={() => toggleOpen(client.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                <Icon name="FaChevronDown" className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* ── Lista de proyectos ── */}
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/20 px-4 py-3 space-y-1">
                {!projects.length
                  ? <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">Sin proyectos en esta categoría.</p>
                  : projects.map((project) => {
                    const checked   = selSet.has(project.id);
                    const disabled  = !enabled || isView;
                    return (
                      <label key={project.id}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/40"} ${checked && !disabled ? rowSelBg : ""}`}>
                        <input type="checkbox" checked={checked} disabled={disabled}
                          onChange={() => !disabled && onToggleProject(client.id, project.id)}
                          className={`rounded border-gray-300 dark:border-gray-600 ${chkColor}`} />
                        <span className={`text-sm flex-1 ${checked ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-600 dark:text-gray-400"}`}>
                          {project.name}
                        </span>
                        {project.code && (
                          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 flex-shrink-0">{project.code}</span>
                        )}
                      </label>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PASO CLIENTES Y PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════

const EmptyMsg = ({ icon, text, amber }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <Icon name={icon} className={`w-10 h-10 ${amber ? "text-amber-300 dark:text-amber-700" : "text-primary-300 dark:text-primary-700"}`} />
    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">{text}</p>
  </div>
);

const StepAccessControl = ({ formData, setField, isView }) => {
  const [loading,     setLoading]     = useState(true);
  const [allClients,  setAllClients]  = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [activeTab,   setActiveTab]   = useState("regular");
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cRes, pRes] = await Promise.all([
          clientService.list({ isActive: true, limit: 200 }),
          projectService.list({ isActive: true, limit: 200 }),
        ]);
        if (cancelled) return;

        const allC = cRes.items ?? [];
        const allP = pRes.items ?? [];

        if (isView) {
          // VIEW MODE: mostrar SOLO los clientes y proyectos del usuario.
          // _clientIds y _projectIds son los arrays planos que vienen del backend.
          const myClientSet  = new Set(formData._clientIds  ?? []);
          const myProjectSet = new Set(formData._projectIds ?? []);

          const myClients  = allC.filter((c) => myClientSet.has(c.id));
          const myProjects = allP.filter((p) => myProjectSet.has(p.id));

          setAllClients(myClients);
          setAllProjects(myProjects);

          // Reconstruir clientProjects agrupando correctamente proyectos por cliente
          // (el catálogo nos da el clientId de cada proyecto)
          const rebuilt = {};
          myClients.forEach((c) => { rebuilt[c.id] = { clientEnabled: true, projects: new Set() }; });
          myProjects.forEach((p) => {
            const cid = p.clientId ?? p.client_id;
            if (rebuilt[cid]) {
              rebuilt[cid].projects.add(p.id);
            } else if (myClientSet.has(cid)) {
              // Cliente está asignado aunque no esté en el catálogo filtrado aún
              rebuilt[cid] = { clientEnabled: true, projects: new Set([p.id]) };
            }
          });
          setField("clientProjects", rebuilt);

        } else {
          // EDIT MODE: catálogo completo para selección
          setAllClients(allC);
          setAllProjects(allP);
        }
      } catch {
        if (!cancelled) toastError("Error al cargar clientes y proyectos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isView]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clasificar en Tab A (regulares) y Tab B (confidenciales) ─────────────

  const { regularRows, confidentialRows } = useMemo(() => {
    const byClient = allProjects.reduce((acc, p) => {
      const cid = p.clientId ?? p.client_id;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(p);
      return acc;
    }, {});

    const regular = [], confidential = [];
    allClients.forEach((client) => {
      const all    = byClient[client.id] ?? [];
      const isConf = client.isConfidential ?? client.is_confidential ?? false;
      if (isConf) {
        confidential.push({ client, projects: all, totalCount: all.length });
      } else {
        const pub  = all.filter((p) => !(p.isConfidential ?? p.is_confidential));
        const priv = all.filter((p) =>   (p.isConfidential ?? p.is_confidential));
        regular.push({ client, projects: pub, totalCount: pub.length });
        if (priv.length) confidential.push({ client, projects: priv, totalCount: priv.length });
      }
    });
    return { regularRows: regular, confidentialRows: confidential };
  }, [allClients, allProjects]);

  // ── Handlers de selección (EDIT) ──────────────────────────────────────────

  const current = formData.clientProjects ?? {};

  const handleToggleClient = (clientId) => {
    const sel    = current[clientId] ?? { clientEnabled: false, projects: new Set() };
    const enable = !sel.clientEnabled;
    setField("clientProjects", {
      ...current,
      [clientId]: { clientEnabled: enable, projects: enable ? sel.projects : new Set() },
    });
  };

  const handleToggleProject = (clientId, projectId) => {
    const sel   = current[clientId] ?? { clientEnabled: true, projects: new Set() };
    const prSet = sel.projects instanceof Set ? new Set(sel.projects) : new Set(sel.projects ?? []);
    prSet.has(projectId) ? prSet.delete(projectId) : prSet.add(projectId);
    setField("clientProjects", { ...current, [clientId]: { ...sel, clientEnabled: true, projects: prSet } });
  };

  const handleToggleAll = (clientId, projects) => {
    const sel   = current[clientId] ?? { clientEnabled: true, projects: new Set() };
    const prSet = sel.projects instanceof Set ? sel.projects : new Set(sel.projects ?? []);
    const allS  = projects.every((p) => prSet.has(p.id));
    setField("clientProjects", {
      ...current,
      [clientId]: { ...sel, clientEnabled: true, projects: allS ? new Set() : new Set(projects.map((p) => p.id)) },
    });
  };

  // ── Conteo de badges de tabs ──────────────────────────────────────────────

  const countReg  = regularRows.filter(({ client }) => current[client.id]?.clientEnabled).length;
  const countConf = confidentialRows.filter(({ client }) => current[client.id]?.clientEnabled).length;

  const sharedProps = {
    selection: current,
    onToggleClient: handleToggleClient,
    onToggleProject: handleToggleProject,
    onToggleAllProjects: handleToggleAll,
    isView,
    searchValue: search,
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <span className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Cargando catálogo…</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">

      {/* Buscador */}
      <div className="relative flex-shrink-0">
        <Icon name="FaSearch" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente o proyecto…"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <Icon name="FaTimes" className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {[
          { key: "regular",      label: isView ? "Clientes / Proyectos" : "Clientes / Proyectos", icon: "FaBuilding",
            activeCls: "border-primary-500 text-primary-600 dark:text-primary-400",
            badgeCls:  "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300",
            count: countReg },
          { key: "confidential", label: "Confidenciales", icon: "FaLock",
            activeCls: "border-amber-500 text-amber-600 dark:text-amber-400",
            badgeCls:  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
            count: countConf },
        ].map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? tab.activeCls : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}>
            <Icon name={tab.icon} className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full font-semibold ${activeTab === tab.key ? tab.badgeCls : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === "regular" ? (
          formData.assignmentMode === "all" && !isView
            ? <EmptyMsg icon="FaGlobe" text="Acceso total: no necesita asignación específica." />
            : regularRows.length === 0
            ? <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                {isView ? "No tiene clientes regulares asignados." : "No hay clientes disponibles."}
              </p>
            : <ClientAccordion clientRows={regularRows} confidential={false} {...sharedProps} />
        ) : (
          formData.assignmentMode === "all" && !isView
            ? <EmptyMsg icon="FaLock" text="Acceso total, incluido contenido confidencial." amber />
            : confidentialRows.length === 0
            ? <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                {isView ? "No tiene clientes o proyectos confidenciales asignados." : "No hay elementos confidenciales disponibles."}
              </p>
            : <ClientAccordion clientRows={confidentialRows} confidential={true} {...sharedProps} />
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE RESUMEN DE ACCESO — para el paso de Confirmación
// Siempre muestra lo que el usuario tiene/tendrá asignado.
// ══════════════════════════════════════════════════════════════════════════════

const AccessSummaryBlock = ({ formData, catClients, catProjects }) => {
  if (formData.assignmentMode === "all") {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800/40">
        <Icon name="FaGlobe" className="w-4 h-4 text-primary-500 flex-shrink-0" />
        <span>Acceso total — todos los clientes y proyectos.</span>
      </div>
    );
  }

  // Fuente de verdad preferida: clientProjects (ya reconstruido correctamente por StepAccessControl).
  // Fallback cuando aún no se cargó el catálogo: usar _clientIds/_projectIds.
  const sel = formData.clientProjects ?? {};
  const clientIds = Object.entries(sel)
    .filter(([, s]) => s?.clientEnabled)
    .map(([id]) => id);

  // Si no hay selección en clientProjects, caer back a los arrays planos
  const effectiveClientIds = clientIds.length > 0
    ? clientIds
    : (formData._clientIds ?? []);

  const effectiveProjectIds = clientIds.length > 0
    ? new Set(Object.values(sel).flatMap((s) => [...(s.projects instanceof Set ? s.projects : new Set(s.projects ?? []))]))
    : new Set(formData._projectIds ?? []);

  if (!effectiveClientIds.length)
    return <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin clientes asignados.</p>;

  const clientMap = Object.fromEntries((catClients ?? []).map((c) => [c.id, c]));
  const allP      = catProjects ?? [];

  return (
    <div className="space-y-2">
      {effectiveClientIds.map((clientId) => {
        const client  = clientMap[clientId];
        const isConf  = client?.isConfidential ?? client?.is_confidential ?? false;
        const cName   = client?.name ?? `[${clientId.slice(0, 8)}…]`;

        // Proyectos de ESTE cliente que están asignados
        const myProjects = allP.filter((p) => {
          const cid = p.clientId ?? p.client_id;
          return cid === clientId && effectiveProjectIds.has(p.id);
        });

        return (
          <div key={clientId} className={`rounded-lg border overflow-hidden ${isConf ? "border-amber-200 dark:border-amber-800/40" : "border-gray-200 dark:border-gray-700"}`}>
            {/* Cliente header */}
            <div className={`flex items-center gap-2 px-3 py-2 ${isConf ? "bg-amber-50 dark:bg-amber-900/10" : "bg-gray-50 dark:bg-gray-800/50"}`}>
              <Icon name={isConf ? "FaLock" : "FaBuilding"} className={`w-3.5 h-3.5 flex-shrink-0 ${isConf ? "text-amber-500" : "text-gray-400"}`} />
              <span className={`text-sm font-semibold flex-1 ${isConf ? "text-amber-800 dark:text-amber-300" : "text-gray-800 dark:text-gray-200"}`}>
                {cName}
              </span>
              {isConf && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                  Confidencial
                </span>
              )}
            </div>
            {/* Proyectos */}
            <div className="px-3 py-2">
              {!myProjects.length
                ? <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin proyectos específicos asignados.</p>
                : <div className="flex flex-wrap gap-1.5">
                    {myProjects.map((project) => {
                      const pConf = project.isConfidential ?? project.is_confidential ?? false;
                      return (
                        <span key={project.id}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${
                            pConf
                              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                          }`}>
                          {pConf && <Icon name="FaLock" className="w-2.5 h-2.5" />}
                          {project.name}
                        </span>
                      );
                    })}
                  </div>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODAL PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const TeamsModal = ({ mode, data, onSubmit }) => {
  const isCreate = mode === MODES.CREATE;
  const isView   = mode === MODES.VIEW;
  const isEdit   = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeUser(data), [data]);

  const [formData,    setFormData]    = useState(() => isCreate ? normalizeUser({}) : initial);
  const [errors,      setErrors]      = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting,  setSubmitting]  = useState(false);

  // Catálogos cargados lazy al llegar al paso de Confirmación (para el resumen)
  const [catClients,  setCatClients]  = useState([]);
  const [catProjects, setCatProjects] = useState([]);

  const steps = useMemo(() => {
    const s = [
      { title: "Información General", number: 1 },
      { title: "Rol del Sistema",     number: 2 },
      { title: "Modo de Acceso",      number: 3 },
    ];
    if (isEdit || isView) s.push({ title: "Clientes y Proyectos", number: 4 });
    s.push({ title: "Confirmación", number: s.length + 1 });
    return s;
  }, [isEdit, isView]);

  const accessStepIdx = steps.findIndex((s) => s.title === "Clientes y Proyectos");
  const lastStep      = steps.length - 1;
  const isAccessStep  = currentStep === accessStepIdx && accessStepIdx >= 0;
  const isLastStep    = currentStep === lastStep;

  // Cargar catálogos al llegar al paso de Confirmación (solo una vez)
  useEffect(() => {
    if (!isLastStep || catClients.length > 0) return;
    Promise.all([
      clientService.list({ isActive: true, limit: 200 }),
      projectService.list({ isActive: true, limit: 200 }),
    ]).then(([cR, pR]) => {
      setCatClients(cR.items ?? []);
      setCatProjects(pR.items ?? []);
    }).catch(() => {});
  }, [isLastStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const closeModal = () => { try { ModalManager.closeAll(); } catch (_) {} };

  // ── Navegación ────────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (isView) {
      if (currentStep < lastStep) { setCurrentStep((s) => s + 1); return; }
      closeModal(); return;
    }
    const errs = validateStep(currentStep, formData, isCreate);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (currentStep < lastStep) { setCurrentStep((s) => s + 1); return; }

    setSubmitting(true);
    try {
      await onSubmit?.(formData);
    } catch (err) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? "Error inesperado";
      toastError(`Error al guardar: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevious = () => { if (currentStep > 0) setCurrentStep((s) => s - 1); };

  // ── Render ────────────────────────────────────────────────────────────────
  // h-[80vh] fijo — nunca cambia de tamaño entre pasos.

  return (
    <div className="flex flex-col h-[80vh]">

      {/* ── HEADER: stepper + título ─────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-0.5">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                idx === currentStep ? "bg-primary-600 text-white"
                : idx < currentStep ? "bg-green-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}>
                {idx < currentStep ? "✓" : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-6 h-1 mx-0.5 rounded ${idx < currentStep ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"}`} />
              )}
            </div>
          ))}
        </div>
        {/* Título + badge estado */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="FaUsers" className="w-4 h-4" />
            {isCreate && `Nuevo Usuario — ${steps[currentStep].title}`}
            {isEdit   && `Editar Usuario — ${steps[currentStep].title}`}
            {isView   && `Detalle — ${steps[currentStep].title}`}
          </h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            formData.status === "inactive"
              ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          }`}>
            {formData.status === "inactive" ? "Inactivo" : "Activo"}
          </span>
        </div>
      </div>

      {/* ── BODY: scroll interno por paso ───────────────────────────────── */}
      {/* El paso de Acceso usa flex+overflow-hidden para que su acordeón scrollee */}
      <div className={`flex-1 min-h-0 px-6 py-5 ${isAccessStep ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>

        {/* ── PASO 0: Información General ──────────────────────────────── */}
        {currentStep === 0 && (
          <div className="space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className={`w-14 h-14 bg-gradient-to-br ${COLOR_MAP[formData.color] ?? COLOR_MAP.blue} rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0`}>
                {formData.initials || computeInitials(formData.name) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {formData.name || <em className="text-gray-400 font-normal text-sm">Sin nombre</em>}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {formData.email || <em className="text-gray-400">Sin email</em>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Nombre completo" required error={errors.name}>
                {isView ? <ViewField value={formData.name} /> : (
                  <input type="text" value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, name: val, initials: prev.initials || computeInitials(val) }));
                      if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                    }}
                    placeholder="Ej: María González" className={inputCls(errors.name)} />
                )}
              </FormField>

              <FormField label="Email" required error={errors.email}>
                {isView ? <ViewField value={formData.email} /> : (
                  <input type="email" value={formData.email} onChange={set("email")}
                    placeholder="usuario@empresa.com" className={inputCls(errors.email)} />
                )}
              </FormField>

              <FormField label="Nombre de usuario" required={isCreate} error={errors.username}>
                {isView ? <ViewField value={formData.username} /> : (
                  <>
                    <input type="text" value={formData.username} onChange={set("username")} placeholder="mgonzalez"
                      disabled={isEdit} className={`${inputCls(errors.username)} ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`} />
                    {isEdit && <p className="mt-1 text-xs text-gray-400">El nombre de usuario no puede modificarse.</p>}
                  </>
                )}
              </FormField>

              <FormField label="Cargo / Posición" required={isCreate} error={errors.position}>
                {isView ? <ViewField value={formData.position} /> : (
                  <input type="text" value={formData.position} onChange={set("position")} placeholder="Ej: Analista Senior" className={inputCls(errors.position)} />
                )}
              </FormField>

              <FormField label="Teléfono">
                {isView ? <ViewField value={formData.phone} /> : (
                  <input type="tel" value={formData.phone} onChange={set("phone")} placeholder="+56 9 1234 5678" className={inputCls(false)} />
                )}
              </FormField>

              <FormField label="Departamento" required={isCreate} error={errors.department}>
                {isView ? <ViewField value={deptLabel(formData.department)} /> : (
                  <select value={formData.department} onChange={set("department")} className={inputCls(errors.department)}>
                    <option value="">Seleccionar…</option>
                    {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                )}
              </FormField>

              <FormField label="Estado">
                {isView ? <ViewField value={formData.status === "inactive" ? "Inactivo" : "Activo"} /> : (
                  <div className="flex gap-4 pt-1">
                    {["active","inactive"].map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="status" value={s} checked={formData.status === s}
                          onChange={() => setField("status", s)} className="text-primary-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {s === "active" ? "Activo" : "Inactivo"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </FormField>
            </div>

            {/* Iniciales + color (solo formulario) */}
            {!isView && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="Iniciales" required={isCreate} error={errors.initials}>
                  <input type="text" value={formData.initials}
                    onChange={(e) => setField("initials", e.target.value.toUpperCase().slice(0, 3))}
                    maxLength={3} placeholder="MG" className={inputCls(errors.initials)} />
                </FormField>
                <FormField label="Color de avatar">
                  <div className="flex gap-2 flex-wrap pt-1">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setField("color", c)}
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${COLOR_MAP[c]} border-2 transition-all ${formData.color === c ? "border-gray-900 dark:border-white scale-110" : "border-transparent hover:scale-105"}`} title={c} />
                    ))}
                  </div>
                </FormField>
              </div>
            )}

            <FormField label="Notas internas">
              {isView ? <ViewField value={formData.notes} /> : (
                <textarea value={formData.notes} onChange={set("notes")} rows={3}
                  placeholder="Información adicional…" className={`${inputCls(false)} resize-none`} />
              )}
            </FormField>
          </div>
        )}

        {/* ── PASO 1: Rol del Sistema ──────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Define el nivel de acceso del usuario dentro del sistema.</p>
            {errors.systemRole && <p className="text-sm text-red-500">{errors.systemRole}</p>}
            {[
              { value: "ADMIN", label: "Administrador", desc: "Acceso completo: gestión de usuarios, clientes, proyectos y configuración del sistema.", icon: "FaUserShield", ring: "ring-red-500 border-red-400 bg-red-50 dark:bg-red-900/10" },
              { value: "EDITOR", label: "Escritura",     desc: "Puede crear y editar contenido asignado, sin acceso a configuración del sistema.",    icon: "FaEdit",       ring: "ring-blue-500 border-blue-400 bg-blue-50 dark:bg-blue-900/10" },
              { value: "READ",  label: "Solo lectura",  desc: "Visualización de contenido asignado sin posibilidad de realizar cambios.",              icon: "eye",          ring: "ring-gray-400 border-gray-400" },
            ].map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => !isView && setField("systemRole", opt.value)} disabled={isView}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${formData.systemRole === opt.value ? `ring-2 ${opt.ring}` : "border-gray-200 dark:border-gray-700"} ${isView ? "cursor-default" : "hover:shadow-sm"}`}>
                <div className="flex items-center gap-3">
                  <Icon name={opt.icon} className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{opt.label}</span>
                      {formData.systemRole === opt.value && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Seleccionado</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  {formData.systemRole === opt.value && <Icon name="FaCheck" className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── PASO 2: Modo de Acceso ───────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Define qué clientes y proyectos puede ver este usuario.</p>
            {[
              { value: "all",      label: "Acceso total",     desc: "El usuario puede ver todos los clientes y proyectos del sistema.", icon: "FaGlobe" },
              { value: "specific", label: "Acceso específico", desc: "El usuario solo puede ver los clientes y proyectos que se le asignen explícitamente.", icon: "FaFilter" },
            ].map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => !isView && setField("assignmentMode", opt.value)} disabled={isView}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${formData.assignmentMode === opt.value ? "ring-2 ring-primary-500 border-primary-400 bg-primary-50 dark:bg-primary-900/10" : "border-gray-200 dark:border-gray-700"} ${isView ? "cursor-default" : "hover:shadow-sm"}`}>
                <div className="flex items-center gap-3">
                  <Icon name={opt.icon} className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{opt.label}</span>
                      {formData.assignmentMode === opt.value && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Seleccionado</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  {formData.assignmentMode === opt.value && <Icon name="FaCheck" className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── PASO 3: Clientes y Proyectos (solo EDIT/VIEW) ───────────── */}
        {isAccessStep && (
          <StepAccessControl formData={formData} setField={setField} isView={isView} />
        )}

        {/* ── PASO FINAL: Confirmación completa ───────────────────────── */}
        {isLastStep && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isView ? "Resumen completo del usuario." : "Revise todos los datos antes de confirmar."}
            </p>

            {/* Sección 1: Datos personales */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
              <SectionTitle number="1" color="blue">Información personal</SectionTitle>
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className={`w-10 h-10 bg-gradient-to-br ${COLOR_MAP[formData.color] ?? COLOR_MAP.blue} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {formData.initials || computeInitials(formData.name) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">{formData.name || "—"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{formData.email || "—"}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  formData.status === "inactive"
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                }`}>
                  {formData.status === "inactive" ? "Inactivo" : "Activo"}
                </span>
              </div>
              <FieldRow label="Usuario"      value={formData.username}              />
              <FieldRow label="Cargo"        value={formData.position}              />
              <FieldRow label="Teléfono"     value={formData.phone}                 />
              <FieldRow label="Departamento" value={deptLabel(formData.department)} />
              {formData.notes && <FieldRow label="Notas" value={formData.notes} />}
            </div>

            {/* Sección 2: Rol y acceso */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
              <SectionTitle number="2" color="purple">Rol y modo de acceso</SectionTitle>
              <FieldRow
                label="Rol del sistema"
                value={formData.systemRole === "ADMIN" ? "Administrador" : formData.systemRole === "EDITOR" ? "Escritura" : "Solo lectura"}
                icon={formData.systemRole === "ADMIN" ? "FaUserShield" : formData.systemRole === "EDITOR" ? "FaEdit" : "eye"}
              />
              <FieldRow
                label="Modo de acceso"
                value={formData.assignmentMode === "all" ? "Acceso total" : "Acceso específico"}
                icon={formData.assignmentMode === "all" ? "FaGlobe" : "FaFilter"}
              />
            </div>

            {/* Sección 3: Clientes y proyectos (EDIT/VIEW) — siempre visible */}
            {(isEdit || isView) && (
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
                <SectionTitle number="3" color="amber">Clientes y proyectos asignados</SectionTitle>
                {catClients.length === 0 && catProjects.length === 0
                  ? <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                      <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      Cargando catálogo…
                    </div>
                  : <AccessSummaryBlock formData={formData} catClients={catClients} catProjects={catProjects} />
                }
              </div>
            )}

            {/* Aviso contraseña temporal (CREATE) */}
            {isCreate && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 flex gap-2">
                <Icon name="FaKey" className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Se generará una contraseña temporal automáticamente. El usuario deberá cambiarla en su primer acceso.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FOOTER — patrón ProjectModal / ClientModal ───────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <button
          type="button"
          onClick={currentStep === 0 ? closeModal : handlePrevious}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          {currentStep === 0 ? "Cancelar" : "Anterior"}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {isLastStep
            ? isView    ? "Cerrar"
              : isCreate ? "Crear"
              : "Guardar"
            : "Siguiente"}
        </button>
      </div>
    </div>
  );
};

export default TeamsModal;
export { MODES as TEAMS_MODAL_MODES };