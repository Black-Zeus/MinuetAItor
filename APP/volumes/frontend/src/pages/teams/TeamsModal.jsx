// src/pages/team/TeamsModal.jsx
import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import { ModalManager } from "@/components/ui/modal";

// ✅ Catálogos (ajusta rutas si tu alias difiere)
import clientsData from "@/data/dataClientes.json";
import projectsData from "@/data/dataProjectos.json";

const MODES = {
  CREATE: "createNewTeam",
  VIEW: "viewDetailTeam",
  EDIT: "editCurrentTeam",
};

const safeArray = (v) => (Array.isArray(v) ? v : []);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeText = (v) => String(v ?? "").trim();

const computeInitials = (name) => {
  const n = normalizeText(name);
  if (!n) return "";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
};

const normalizeProjects = (data = {}) => {
  const raw = data.projects ?? data.projectPermissions ?? [];
  return safeArray(raw)
    .map((p) => ({
      clientId: normalizeText(p?.clientId ?? p?.client ?? ""),
      projectId: normalizeText(p?.projectId ?? p?.project ?? ""),
      permission: p?.permission === "edit" ? "edit" : "read",
    }))
    .filter((p) => p.clientId && p.projectId);
};

const normalizeUser = (data = {}) => {
  const name = data.name ?? data.teamName ?? data.title ?? "";

  const statusRaw = data.status ?? data.teamStatus ?? "active";
  const status =
    statusRaw === "inactive" || statusRaw === "inactivo" ? "inactive" : "active";

  const systemRoleRaw = data.systemRole ?? "read";
  const systemRole =
    systemRoleRaw === "admin"
      ? "admin"
      : systemRoleRaw === "write"
      ? "write"
      : "read";

  const assignmentModeRaw = data.assignmentMode ?? "specific";
  const assignmentMode = assignmentModeRaw === "all" ? "all" : "specific";

  // "clients" se interpreta como "clientes visibles en la interfaz"
  const clients = safeArray(data.clients ?? data.clientVisibility ?? [])
    .map((x) => normalizeText(x))
    .filter(Boolean);

  const projects = normalizeProjects(data);

  return {
    id: data.id ?? data.teamId ?? "",
    name: normalizeText(name),
    email: normalizeText(data.email),
    position: normalizeText(data.position),
    phone: normalizeText(data.phone),
    department: normalizeText(data.department),
    status,
    systemRole,
    assignmentMode,
    clients,
    projects,
    notes: normalizeText(data.notes),
    initials: normalizeText(data.initials) || computeInitials(name),
    color: normalizeText(data.color) || "blue",
    createdAt: normalizeText(data.createdAt),
    lastActivity: normalizeText(data.lastActivity),
  };
};

const TeamsModal = ({ mode, data, onSubmit, onClose }) => {
  const isCreate = mode === MODES.CREATE;
  const isView = mode === MODES.VIEW;
  const isEdit = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeUser(data), [data]);

  const [formData, setFormData] = useState(() =>
    isCreate ? normalizeUser({}) : initial
  );
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  // ✅ Sub-tabs SOLO para Paso 3 (Clientes/Confidenciales)
  const ACCESS_TABS = { REGULAR: "regular", CONFIDENTIAL: "confidential" };
  const [accessTab, setAccessTab] = useState(ACCESS_TABS.REGULAR);

  // ✅ UI state: buscador + accordion
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState({}); // { [clientId]: boolean }
  const toggleExpanded = (clientId) =>
    setExpandedClients((p) => ({ ...p, [clientId]: !p[clientId] }));

  // ✅ (2) Collapsables en pestaña confidencial (por defecto colapsados)
  const [confAlertOpen, setConfAlertOpen] = useState(false);
  const [confInfoOpen, setConfInfoOpen] = useState(false);

  const steps = [
    { title: "Información General", number: 1 },
    { title: "Rol del Sistema", number: 2 },
    { title: "Asignación de Acceso", number: 3 },
    { title: "Clientes y Proyectos", number: 4 },
    { title: "Confirmación", number: 5 },
  ];

  const closeModal = () => {
    try {
      onClose?.();
    } catch (_) {}
    try {
      ModalManager.hide?.();
    } catch (_) {}
    try {
      ModalManager.close?.();
    } catch (_) {}
    try {
      ModalManager.dismiss?.();
    } catch (_) {}
    try {
      ModalManager.closeAll?.();
    } catch (_) {}
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const FieldRow = ({ label, value }) => {
    const v = (value ?? "").toString().trim();
    return (
      <div className="flex">
        <span className="font-medium text-gray-700 dark:text-gray-300 w-44">
          {label}:
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {v || (
            <span className="italic text-gray-500 dark:text-gray-500">
              Sin información
            </span>
          )}
        </span>
      </div>
    );
  };

  // ------------------------------------------------------------
  // Catálogos (Clientes/Proyectos) + helpers (según tus JSON)
  // ------------------------------------------------------------
  const catalogClients = safeArray(clientsData?.clients);
  const catalogProjects = safeArray(projectsData?.projects);

  const clientsById = useMemo(() => {
    const m = new Map();
    for (const c of catalogClients) m.set(String(c?.id), c);
    return m;
  }, [catalogClients]);

  const projectsById = useMemo(() => {
    const m = new Map();
    for (const p of catalogProjects) m.set(String(p?.id), p);
    return m;
  }, [catalogProjects]);

  const isClientConfidential = (clientId) => {
    const c = clientsById.get(String(clientId));
    return !!c?.isconfidential;
  };

  const isProjectConfidential = (projectId) => {
    const p = projectsById.get(String(projectId));
    return !!p?.isconfidential;
  };

  // (5) Si el cliente es confidencial => se asume que TODOS sus proyectos son confidenciales
  const isEffectiveConfidential = (clientId, projectId) => {
    return isClientConfidential(clientId) || isProjectConfidential(projectId);
  };

  const getClientName = (clientId) => {
    const c = clientsById.get(String(clientId));
    return normalizeText(c?.company || c?.name || clientId);
  };

  const getProjectName = (projectId) => {
    const p = projectsById.get(String(projectId));
    return normalizeText(p?.name || projectId);
  };

  // ------------------------------------------------------------
  // Reglas de modo asignación:
  // - (4) assignmentMode=all aplica SOLO a regulares
  // - Confidenciales SIEMPRE requieren gestión explícita
  // Por ello: en modo "all" mantenemos en formData.projects SOLO asignaciones confidenciales
  // ------------------------------------------------------------
  const setAssignmentMode = (modeValue) => {
    const v = modeValue === "all" ? "all" : "specific";

    setFormData((prev) => {
      const currentProjects = safeArray(prev.projects);

      // Si pasa a "all": limpiar asignaciones NO confidenciales, pero mantener confidenciales
      const nextProjects =
        v === "all"
          ? currentProjects.filter((x) =>
              isEffectiveConfidential(x?.clientId, x?.projectId)
            )
          : currentProjects;

      return {
        ...prev,
        assignmentMode: v,
        projects: nextProjects,
        // clients visibles: en "all" puedes elegir mantenerlos como estén.
        // No los forzamos, pero al seleccionar regulares en "specific" sí auto-marcamos.
      };
    });
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (isView) {
      setErrors({});
      return true;
    }

    switch (step) {
      case 0: {
        if (!normalizeText(formData.name))
          newErrors.name = "Nombre completo es requerido";
        const email = normalizeText(formData.email);
        if (!email) newErrors.email = "Email corporativo es requerido";
        else if (!EMAIL_RE.test(email)) newErrors.email = "Email inválido";
        if (!normalizeText(formData.position))
          newErrors.position = "Cargo / Puesto es requerido";
        break;
      }
      case 1: {
        if (!["admin", "write", "read"].includes(formData.systemRole))
          newErrors.systemRole = "Rol de sistema inválido";
        break;
      }
      case 2: {
        if (!["all", "specific"].includes(formData.assignmentMode))
          newErrors.assignmentMode = "Modo de asignación inválido";
        break;
      }
      case 3: {
        // Valida filas de proyectos (en "all" solo deberían existir confidenciales, pero igual validamos)
        for (let i = 0; i < (formData.projects?.length || 0); i++) {
          const p = formData.projects[i];
          if (!p?.clientId || !p?.projectId) {
            newErrors.projects = `Proyecto inválido en fila #${i + 1}`;
            break;
          }
          if (!["read", "edit"].includes(p?.permission)) {
            newErrors.projects = `Permiso inválido en fila #${i + 1}`;
            break;
          }
        }
        break;
      }
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
      else handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (isView) {
      closeModal();
      return;
    }

    // (4) En modo "all": el usuario tiene acceso implícito a TODOS los regulares.
    // Enviamos explícitamente SOLO los confidenciales que sí fueron asignados.
    const payloadProjects =
      formData.assignmentMode === "specific"
        ? safeArray(formData.projects)
            .map((p) => ({
              clientId: normalizeText(p?.clientId),
              projectId: normalizeText(p?.projectId),
              permission: p?.permission === "edit" ? "edit" : "read",
            }))
            .filter((p) => p.clientId && p.projectId)
        : safeArray(formData.projects)
            .filter((p) => isEffectiveConfidential(p?.clientId, p?.projectId))
            .map((p) => ({
              clientId: normalizeText(p?.clientId),
              projectId: normalizeText(p?.projectId),
              permission: p?.permission === "edit" ? "edit" : "read",
            }))
            .filter((p) => p.clientId && p.projectId);

    const payload = {
      id: formData.id || undefined,
      name: normalizeText(formData.name),
      email: normalizeText(formData.email),
      position: normalizeText(formData.position),
      phone: normalizeText(formData.phone),
      department: normalizeText(formData.department),
      status: formData.status === "inactive" ? "inactive" : "active",
      systemRole: ["admin", "write", "read"].includes(formData.systemRole)
        ? formData.systemRole
        : "read",
      assignmentMode: formData.assignmentMode === "all" ? "all" : "specific",

      // clients = "Cliente visible en la interfaz"
      clients: safeArray(formData.clients)
        .map((x) => normalizeText(x))
        .filter(Boolean),

      projects: payloadProjects,

      notes: normalizeText(formData.notes),
      initials: normalizeText(formData.initials) || computeInitials(formData.name),
      color: normalizeText(formData.color) || "blue",
      createdAt: normalizeText(formData.createdAt),
      lastActivity: normalizeText(formData.lastActivity),
    };

    onSubmit?.(payload);
  };

  // ------------------------------------------------------------
  // Maps de proyectos por cliente:
  // (5) clientes isconfidential => todos sus proyectos pasan a CONF
  // y no aparecen en REGULAR.
  // ------------------------------------------------------------
  const projectsRegularByClientId = useMemo(() => {
    const map = new Map(); // clientId -> projects[]
    for (const p of catalogProjects) {
      const clientId = String(p?.clientId ?? "");
      if (!clientId) continue;
      if (isClientConfidential(clientId)) continue; // (5) cliente confidencial no entra aquí
      if (p?.isconfidential) continue;
      if (!map.has(clientId)) map.set(clientId, []);
      map.get(clientId).push(p);
    }
    return map;
  }, [catalogProjects, clientsById]);

  const projectsConfByClientId = useMemo(() => {
    const map = new Map(); // clientId -> projects[]
    for (const p of catalogProjects) {
      const clientId = String(p?.clientId ?? "");
      if (!clientId) continue;

      const clientIsConf = isClientConfidential(clientId);
      const projIsConf = !!p?.isconfidential;

      // (5) cliente confidencial => TODOS sus proyectos se tratan como confidenciales
      if (clientIsConf || projIsConf) {
        if (!map.has(clientId)) map.set(clientId, []);
        map.get(clientId).push(p);
      }
    }
    return map;
  }, [catalogProjects, clientsById]);

  const byClientId = useMemo(() => {
    const map = new Map();
    for (const c of catalogClients) map.set(String(c?.id), c);
    return map;
  }, [catalogClients]);

  // ------------------------------------------------------------
  // Permisos
  // ------------------------------------------------------------
  const getPermission = (clientId, projectId) => {
    const cid = String(clientId);
    const pid = String(projectId);
    const hit = safeArray(formData.projects).find(
      (x) => String(x?.clientId) === cid && String(x?.projectId) === pid
    );
    return hit?.permission === "edit" ? "edit" : hit ? "read" : null;
  };

  const isClientVisible = (clientId) =>
    safeArray(formData.clients).some((x) => String(x) === String(clientId));

  const toggleClientVisible = (clientId, visible) => {
    const cid = String(clientId);
    const cur = safeArray(formData.clients).map((x) => String(x));
    const has = cur.includes(cid);
    const next =
      visible === true
        ? has
          ? cur
          : [...cur, cid]
        : cur.filter((x) => x !== cid);

    handleChange("clients", next);
  };

  // (3) al seleccionar un proyecto REGULAR (read/edit), auto-marca cliente visible
  const ensureClientVisibleIfRegular = (clientId, projectId) => {
    const cid = String(clientId);
    const pid = String(projectId);
    if (isEffectiveConfidential(cid, pid)) return; // confidencial => no fuerza visibilidad
    if (!isClientVisible(cid)) toggleClientVisible(cid, true);
  };

  const setPermission = (clientId, projectId, permission) => {
    const cid = String(clientId);
    const pid = String(projectId);
    const perm = permission === "edit" ? "edit" : "read";

    const next = [...safeArray(formData.projects)];
    const idx = next.findIndex(
      (x) => String(x?.clientId) === cid && String(x?.projectId) === pid
    );

    if (idx >= 0) next[idx] = { ...next[idx], permission: perm };
    else next.push({ clientId: cid, projectId: pid, permission: perm });

    handleChange("projects", next);

    // (3) auto activar visibilidad si es regular
    ensureClientVisibleIfRegular(cid, pid);
  };

  const clearPermission = (clientId, projectId) => {
    const cid = String(clientId);
    const pid = String(projectId);
    const next = safeArray(formData.projects).filter(
      (x) => !(String(x?.clientId) === cid && String(x?.projectId) === pid)
    );
    handleChange("projects", next);
  };

  const selectAllClientProjectsAs = (clientId, permission, isConfidential) => {
    const cid = String(clientId);
    const list = isConfidential
      ? safeArray(projectsConfByClientId.get(cid))
      : safeArray(projectsRegularByClientId.get(cid));

    if (!list.length) return;

    if (isConfidential) {
      // solo a los ya habilitados (checkbox "asignar acceso")
      for (const p of list) {
        const pid = String(p?.id ?? "");
        if (!pid) continue;
        const enabled = getPermission(cid, pid) != null;
        if (enabled) setPermission(cid, pid, permission);
      }
      return;
    }

    for (const p of list) {
      const pid = String(p?.id ?? "");
      if (!pid) continue;
      setPermission(cid, pid, permission);
      // (3) y fuerza visibilidad cliente
      ensureClientVisibleIfRegular(cid, pid);
    }
  };

  const filterClient = (c) => {
    const q = normalizeText(clientSearch).toLowerCase();
    if (!q) return true;
    const name = normalizeText(c?.name).toLowerCase();
    const company = normalizeText(c?.company).toLowerCase();
    const email = normalizeText(c?.email).toLowerCase();
    return name.includes(q) || company.includes(q) || email.includes(q);
  };

  const regularClientIds = useMemo(() => {
    const ids = [];
    for (const [cid, list] of projectsRegularByClientId.entries()) {
      if (safeArray(list).length) ids.push(cid);
    }
    return ids;
  }, [projectsRegularByClientId]);

  const confClientIds = useMemo(() => {
    // (5) incluye:
    // - clientes con proyectos confidenciales
    // - clientes marcados isconfidential aunque no tengan proyectos conf marcados
    const ids = new Set();

    for (const [cid, list] of projectsConfByClientId.entries()) {
      if (safeArray(list).length) ids.add(cid);
    }
    for (const c of catalogClients) {
      const cid = String(c?.id ?? "");
      if (!cid) continue;
      if (c?.isconfidential) ids.add(cid);
    }

    return Array.from(ids);
  }, [projectsConfByClientId, catalogClients]);

  const selectedRegularClientsCount = useMemo(() => {
    const set = new Set();
    for (const p of safeArray(formData.projects)) {
      const cid = String(p?.clientId ?? "");
      const pid = String(p?.projectId ?? "");
      if (!cid || !pid) continue;
      if (isEffectiveConfidential(cid, pid)) continue; // no cuenta confidenciales
      set.add(cid);
    }
    return set.size;
  }, [formData.projects, clientsById, projectsById]);

  const assignedConfProjectsCount = useMemo(() => {
    let n = 0;
    for (const p of safeArray(formData.projects)) {
      const cid = String(p?.clientId ?? "");
      const pid = String(p?.projectId ?? "");
      if (isEffectiveConfidential(cid, pid)) n++;
    }
    return n;
  }, [formData.projects, clientsById, projectsById]);

  // ------------------------------------------------------------
  // (1) Resumen: construir filas con NOMBRE cliente/proyecto + tipo + permiso
  // ------------------------------------------------------------
  const summaryRows = useMemo(() => {
    const rows = safeArray(formData.projects).map((p) => {
      const clientId = String(p?.clientId ?? "");
      const projectId = String(p?.projectId ?? "");
      const perm = p?.permission === "edit" ? "edit" : "read";
      const confidential = isEffectiveConfidential(clientId, projectId);

      return {
        clientId,
        projectId,
        clientName: getClientName(clientId),
        projectName: getProjectName(projectId),
        type: confidential ? "Confidencial" : "Normal",
        permission: perm === "edit" ? "Editor" : "Lector",
      };
    });

    const typeRank = (t) => (t === "Confidencial" ? 0 : 1);

    return rows.sort((a, b) => {
      const t = typeRank(a.type) - typeRank(b.type);
      if (t !== 0) return t;
      const c = a.clientName.localeCompare(b.clientName, "es");
      if (c !== 0) return c;
      return a.projectName.localeCompare(b.projectName, "es");
    });
  }, [formData.projects, clientsById, projectsById]);

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="flex flex-col w-full h-[650px]">
      {/* Header con stepper */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                  ${
                    idx === currentStep
                      ? "bg-blue-600 text-white"
                      : idx < currentStep
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  }
                `}
              >
                {idx < currentStep ? "✓" : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-12 h-1 mx-2 ${
                    idx < currentStep
                      ? "bg-green-600"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="FaUsers" className="w-5 h-5" />
            {isCreate && `Nuevo Usuario — ${steps[currentStep].title}`}
            {isEdit && `Editar Usuario — ${steps[currentStep].title}`}
            {isView && `Detalles de Usuario — ${steps[currentStep].title}`}
          </h3>

          <div className="flex items-center gap-2">
            <span
              className={`
                px-3 py-1 rounded-full text-xs font-semibold
                ${
                  formData.status === "inactive"
                    ? "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300"
                    : "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                }
              `}
            >
              {formData.status === "inactive" ? "Inactivo" : "Activo"}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
              {formData.systemRole === "admin"
                ? "Administrador"
                : formData.systemRole === "write"
                ? "Escritura"
                : "Lectura"}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {/* Paso 0: Información General */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.name || (
                      <span className="italic text-gray-500">
                        Sin información
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className={`
                        w-full px-3 py-2.5 border rounded-lg text-sm
                        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                        ${
                          errors.name
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                        }
                        focus:outline-none focus:ring-2
                      `}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email corporativo <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.email || (
                      <span className="italic text-gray-500">
                        Sin información
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="juan.perez@company.com"
                      className={`
                        w-full px-3 py-2.5 border rounded-lg text-sm
                        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                        ${
                          errors.email
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                        }
                        focus:outline-none focus:ring-2
                      `}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.email}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cargo / Puesto <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.position || (
                      <span className="italic text-gray-500">
                        Sin información
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => handleChange("position", e.target.value)}
                      placeholder="Ej: Project Manager"
                      className={`
                        w-full px-3 py-2.5 border rounded-lg text-sm
                        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                        ${
                          errors.position
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                        }
                        focus:outline-none focus:ring-2
                      `}
                    />
                    {errors.position && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.position}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono
                </label>
                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.phone || (
                      <span className="italic text-gray-500">
                        Sin información
                      </span>
                    )}
                  </div>
                ) : (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="
                      w-full px-3 py-2.5 border rounded-lg text-sm
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Departamento
                </label>
                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.department || (
                      <span className="italic text-gray-500">
                        Sin información
                      </span>
                    )}
                  </div>
                ) : (
                  <select
                    value={formData.department}
                    onChange={(e) => handleChange("department", e.target.value)}
                    className="
                      w-full px-3 py-2.5 border rounded-lg text-sm
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  >
                    <option value="">Seleccionar departamento</option>
                    <option value="it">Tecnología</option>
                    <option value="sales">Ventas</option>
                    <option value="marketing">Marketing</option>
                    <option value="operations">Operaciones</option>
                    <option value="hr">Recursos Humanos</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estado inicial
                </label>
                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.status === "inactive" ? "Inactivo" : "Activo"}
                  </div>
                ) : (
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      handleChange(
                        "status",
                        e.target.value === "inactive" ? "inactive" : "active"
                      )
                    }
                    className="
                      w-full px-3 py-2.5 border rounded-lg text-sm
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notas internas
              </label>
              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {formData.notes || (
                    <span className="italic text-gray-500">Sin información</span>
                  )}
                </div>
              ) : (
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Información adicional sobre el usuario..."
                  className="
                    w-full px-3 py-2.5 border rounded-lg text-sm
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    resize-none
                  "
                />
              )}
            </div>
          </div>
        )}

        {/* Paso 1: Rol del Sistema */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {errors.systemRole && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
                {errors.systemRole}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-4">
                Selecciona el rol del sistema{" "}
                <span className="text-red-500">*</span>
              </label>

              {/* Admin */}
              <div className="mb-4">
                <label
                  className={`
                    flex items-start gap-4 p-5 border-2 rounded-lg cursor-pointer transition-all
                    ${
                      isView
                        ? "opacity-80 cursor-default"
                        : "hover:bg-purple-50 hover:border-purple-300"
                    }
                    ${
                      formData.systemRole === "admin"
                        ? "border-purple-400 bg-purple-50"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/10"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="systemRole"
                    value="admin"
                    disabled={isView}
                    checked={formData.systemRole === "admin"}
                    onChange={() => handleChange("systemRole", "admin")}
                    className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Icon
                          name="FaUserShield"
                          className="w-5 h-5 text-purple-600"
                        />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Administrador
                        </h4>
                        <p className="text-xs text-purple-600 font-medium">
                          Acceso total al sistema
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Control completo sobre módulos y configuraciones.
                    </p>
                  </div>
                </label>
              </div>

              {/* Write */}
              <div className="mb-4">
                <label
                  className={`
                    flex items-start gap-4 p-5 border-2 rounded-lg cursor-pointer transition-all
                    ${
                      isView
                        ? "opacity-80 cursor-default"
                        : "hover:bg-blue-50 hover:border-blue-300"
                    }
                    ${
                      formData.systemRole === "write"
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/10"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="systemRole"
                    value="write"
                    disabled={isView}
                    checked={formData.systemRole === "write"}
                    onChange={() => handleChange("systemRole", "write")}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon name="FaPen" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Escritura
                        </h4>
                        <p className="text-xs text-blue-600 font-medium">
                          Crear y editar contenido
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Puede crear/editar dentro de lo asignado.
                    </p>
                  </div>
                </label>
              </div>

              {/* Read */}
              <div className="mb-4">
                <label
                  className={`
                    flex items-start gap-4 p-5 border-2 rounded-lg cursor-pointer transition-all
                    ${
                      isView
                        ? "opacity-80 cursor-default"
                        : "hover:bg-green-50 hover:border-green-300"
                    }
                    ${
                      formData.systemRole === "read"
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/10"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="systemRole"
                    value="read"
                    disabled={isView}
                    checked={formData.systemRole === "read"}
                    onChange={() => handleChange("systemRole", "read")}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Icon
                          name="FaCircleCheck"
                          className="w-5 h-5 text-green-600"
                        />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Lectura
                        </h4>
                        <p className="text-xs text-green-600 font-medium">
                          Solo visualización
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Solo puede ver/descargar dentro de lo asignado.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Paso 2: Asignación de Acceso */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {errors.assignmentMode && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
                {errors.assignmentMode}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">
                Modo de asignación <span className="text-red-500">*</span>
              </label>

              <div className="space-y-3">
                <label
                  className={`
                    flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all
                    ${
                      isView
                        ? "opacity-80 cursor-default"
                        : "hover:border-blue-300 hover:bg-blue-50"
                    }
                    ${
                      formData.assignmentMode === "all"
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 dark:border-gray-700"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="all"
                    disabled={isView}
                    checked={formData.assignmentMode === "all"}
                    onChange={() => setAssignmentMode("all")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Todos los clientes y proyectos (solo normales)
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Acceso automático a todos los clientes/proyectos regulares
                      existentes y futuros. Los confidenciales se gestionan aparte.
                    </p>
                  </div>
                </label>

                <label
                  className={`
                    flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all
                    ${
                      isView
                        ? "opacity-80 cursor-default"
                        : "hover:border-blue-300 hover:bg-blue-50"
                    }
                    ${
                      formData.assignmentMode === "specific"
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 dark:border-gray-700"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="specific"
                    disabled={isView}
                    checked={formData.assignmentMode === "specific"}
                    onChange={() => setAssignmentMode("specific")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Clientes y proyectos específicos
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Selección manual de clientes y permisos por proyecto.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3: Clientes y Proyectos */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {errors.projects && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
                {errors.projects}
              </div>
            )}

            {/* (4) En modo all: regulares automáticos, pero confidenciales siguen gestionables */}
            {formData.assignmentMode === "all" && (
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20">
                <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Modo “Todos” aplicado a proyectos normales
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  El usuario tendrá acceso automático a todos los clientes/proyectos regulares.
                  <br />
                  Los proyectos confidenciales deben asignarse explícitamente en la pestaña correspondiente.
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex gap-2 overflow-x-auto pb-2">
                <button
                  type="button"
                  disabled={formData.assignmentMode === "all"} // (4) no gestionas regulares manualmente en modo all
                  onClick={() => setAccessTab(ACCESS_TABS.REGULAR)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold border
                    ${
                      formData.assignmentMode === "all"
                        ? "opacity-60 cursor-not-allowed bg-white dark:bg-gray-900/10 border-transparent text-gray-500"
                        : accessTab === ACCESS_TABS.REGULAR
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white dark:bg-gray-900/10 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    }
                  `}
                >
                  <Icon name="FaUsers" className="w-4 h-4" />
                  Clientes y Proyectos
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {selectedRegularClientsCount} clientes seleccionados
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessTab(ACCESS_TABS.CONFIDENTIAL)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold border
                    ${
                      accessTab === ACCESS_TABS.CONFIDENTIAL
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white dark:bg-gray-900/10 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    }
                  `}
                >
                  <Icon name="FaLock" className="w-4 h-4" />
                  Proyectos Confidenciales
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {assignedConfProjectsCount} proyecto asignado
                  </span>
                </button>
              </nav>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icon name="FaSearch" className="w-4 h-4" />
                </span>
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="
                    w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                />
              </div>
            </div>

            {/* TAB: REGULARES */}
            {accessTab === ACCESS_TABS.REGULAR && (
              <div className="space-y-4">
                {formData.assignmentMode === "all" ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 italic">
                    En modo “Todos”, los permisos regulares no se configuran manualmente.
                  </div>
                ) : (
                  <>
                    {regularClientIds
                      .map((cid) => ({ cid, c: byClientId.get(cid) }))
                      .filter(({ c }) => !!c)
                      .map(({ cid, c }) => ({
                        cid,
                        c,
                        projects: safeArray(projectsRegularByClientId.get(cid)),
                      }))
                      .filter(({ c }) => filterClient(c))
                      .map(({ cid, c, projects }) => {
                        const expanded = !!expandedClients[cid];
                        return (
                          <div
                            key={cid}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleExpanded(cid)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900/10 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold">
                                  {computeInitials(c?.company || c?.name)}
                                </div>
                                <div className="text-left">
                                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {c?.company || c?.name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {c?.email || "—"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="px-2 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                  {projects.length} proyectos
                                </span>
                                <Icon
                                  name={expanded ? "FaChevronUp" : "FaChevronDown"}
                                  className="w-4 h-4 text-gray-500"
                                />
                              </div>
                            </button>

                            {expanded && (
                              <div className="p-4 bg-white dark:bg-gray-900/5">
                                {/* Cliente visible toggle */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <Icon name="FaEye" className="w-4 h-4" />
                                    Cliente visible en la interfaz
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                      El usuario podrá ver este cliente al crear minutas
                                    </span>
                                    <label className="inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        disabled={isView}
                                        checked={isClientVisible(cid)}
                                        onChange={(e) =>
                                          toggleClientVisible(cid, e.target.checked)
                                        }
                                      />
                                      <div
                                        className="
                                          relative w-11 h-6 bg-gray-200 peer-focus:outline-none
                                          peer-focus:ring-2 peer-focus:ring-blue-500
                                          rounded-full peer dark:bg-gray-700
                                          peer-checked:after:translate-x-full peer-checked:after:border-white
                                          after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                          after:bg-white after:border-gray-300 after:border after:rounded-full
                                          after:h-5 after:w-5 after:transition-all dark:border-gray-600
                                          peer-checked:bg-blue-600
                                        "
                                      />
                                    </label>
                                  </div>
                                </div>

                                {/* Encabezado tabla + acción select all */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                    Proyectos de {c?.company || c?.name}
                                  </div>

                                  {!isView && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        selectAllClientProjectsAs(cid, "edit", false)
                                      }
                                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      Seleccionar todos como Editor
                                    </button>
                                  )}
                                </div>

                                {/* Tabla */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-900/20 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                    <div className="col-span-8">Proyecto</div>
                                    <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                      <Icon name="FaEye" className="w-3.5 h-3.5" />
                                      Lector
                                    </div>
                                    <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                      <Icon name="FaPen" className="w-3.5 h-3.5" />
                                      Editor
                                    </div>
                                  </div>

                                  {projects.map((p) => {
                                    const pid = String(p?.id ?? "");
                                    const perm = getPermission(cid, pid); // null|read|edit

                                    return (
                                      <div
                                        key={pid}
                                        className="grid grid-cols-12 px-3 py-3 border-t border-gray-200 dark:border-gray-700"
                                      >
                                        <div className="col-span-8 flex items-start gap-2">
                                          <Icon
                                            name="FaFolder"
                                            className="w-4 h-4 text-blue-600 mt-0.5"
                                          />
                                          <div>
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                              {p?.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {p?.description || "—"}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Lector */}
                                        <div className="col-span-2 flex items-center justify-center">
                                          <input
                                            type="checkbox"
                                            disabled={isView}
                                            checked={perm === "read"}
                                            onChange={(e) => {
                                              if (isView) return;
                                              if (e.target.checked) setPermission(cid, pid, "read");
                                              else clearPermission(cid, pid);
                                            }}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                          />
                                        </div>

                                        {/* Editor */}
                                        <div className="col-span-2 flex items-center justify-center">
                                          <input
                                            type="checkbox"
                                            disabled={isView}
                                            checked={perm === "edit"}
                                            onChange={(e) => {
                                              if (isView) return;
                                              if (e.target.checked) setPermission(cid, pid, "edit");
                                              else clearPermission(cid, pid);
                                            }}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {!regularClientIds.length && (
                      <div className="text-sm italic text-gray-500 dark:text-gray-500">
                        No existen proyectos regulares en el catálogo.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB: CONFIDENCIALES */}
            {accessTab === ACCESS_TABS.CONFIDENTIAL && (
              <div className="space-y-4">
                {/* (2) Banner warning colapsable */}
                <div className="rounded-lg border border-red-200 dark:border-red-900/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setConfAlertOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name="FaTriangleExclamation"
                        className="w-5 h-5 text-red-600"
                      />
                      <div className="text-left">
                        <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                          Acceso sensible - Proyectos Confidenciales
                        </div>
                        <div className="text-xs text-red-700 dark:text-red-300">
                          Requieren asignación explícita
                        </div>
                      </div>
                    </div>
                    <Icon
                      name={confAlertOpen ? "FaChevronUp" : "FaChevronDown"}
                      className="w-4 h-4 text-red-700 dark:text-red-300"
                    />
                  </button>

                  {confAlertOpen && (
                    <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-900/40">
                      <div className="text-sm text-red-700 dark:text-red-300">
                        Estos proyectos contienen información sensible y requieren asignación explícita.
                        <br />
                        NO se incluyen en "Todos los clientes". Solo asigna acceso a usuarios autorizados.
                      </div>
                    </div>
                  )}
                </div>

                {/* (2) Caja informativa colapsable */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setConfInfoOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900/10"
                  >
                    <div className="flex items-center gap-3">
                      <Icon name="FaCircleInfo" className="w-5 h-5 text-gray-500" />
                      <div className="text-left">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          ¿Qué son los proyectos confidenciales?
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Definición y reglas de asignación
                        </div>
                      </div>
                    </div>
                    <Icon
                      name={confInfoOpen ? "FaChevronUp" : "FaChevronDown"}
                      className="w-4 h-4 text-gray-600 dark:text-gray-300"
                    />
                  </button>

                  {confInfoOpen && (
                    <div className="px-4 py-3 bg-white dark:bg-gray-900/10 border-t border-gray-200 dark:border-gray-700">
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-5">
                        <li>Proyectos con información sensible, estratégica, financiera o legal sensible</li>
                        <li>Requieren asignación manual y explícita de cada usuario</li>
                        <li>Cada asignación queda registrada en el sistema de auditoría</li>
                        <li>
                          Si un cliente está marcado como confidencial, se asume que todos sus proyectos son confidenciales
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Listado por cliente */}
                <div className="space-y-4">
                  {confClientIds
                    .map((cid) => ({ cid, c: byClientId.get(cid) }))
                    .filter(({ c }) => !!c)
                    .map(({ cid, c }) => ({
                      cid,
                      c,
                      projects: safeArray(projectsConfByClientId.get(cid)),
                    }))
                    .filter(({ c }) => filterClient(c))
                    .map(({ cid, c, projects }) => {
                      const expanded = !!expandedClients[`conf_${cid}`];
                      const toggle = () =>
                        setExpandedClients((p) => ({
                          ...p,
                          [`conf_${cid}`]: !p[`conf_${cid}`],
                        }));

                      return (
                        <div
                          key={cid}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={toggle}
                            className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900/10 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold">
                                {computeInitials(c?.company || c?.name)}
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {c?.company || c?.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {isClientConfidential(cid) ? (
                                    <span className="font-semibold text-red-600 dark:text-red-300">
                                      CLIENTE CONFIDENCIAL
                                    </span>
                                  ) : (
                                    <>
                                      {projects.length} proyecto confidencial
                                      {projects.length > 1 ? "es" : ""}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Icon
                              name={expanded ? "FaChevronUp" : "FaChevronDown"}
                              className="w-4 h-4 text-gray-500"
                            />
                          </button>

                          {expanded && (
                            <div className="p-4 bg-white dark:bg-gray-900/5">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  Proyectos Confidenciales por Cliente
                                </div>

                                {!isView && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectAllClientProjectsAs(cid, "edit", true)
                                    }
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                    title="Aplica 'Editor' a todos los proyectos confidenciales habilitados"
                                  >
                                    Marcar habilitados como Editor
                                  </button>
                                )}
                              </div>

                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                Marca el checkbox izquierdo para asignar acceso (por defecto Lector).
                              </div>

                              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-900/20 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                  <div className="col-span-8">Proyecto</div>
                                  <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                    <Icon name="FaEye" className="w-3.5 h-3.5" />
                                    Lector
                                  </div>
                                  <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                    <Icon name="FaPen" className="w-3.5 h-3.5" />
                                    Editor
                                  </div>
                                </div>

                                {projects.map((p) => {
                                  const pid = String(p?.id ?? "");
                                  const perm = getPermission(cid, pid); // null|read|edit
                                  const enabled = perm != null;

                                  return (
                                    <div
                                      key={pid}
                                      className="grid grid-cols-12 px-3 py-3 border-t border-gray-200 dark:border-gray-700"
                                    >
                                      <div className="col-span-8 flex items-start gap-2">
                                        <input
                                          type="checkbox"
                                          disabled={isView}
                                          checked={enabled}
                                          onChange={(e) => {
                                            if (isView) return;
                                            if (e.target.checked) setPermission(cid, pid, "read");
                                            else clearPermission(cid, pid);
                                          }}
                                          className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                                          title="Asignar acceso"
                                        />

                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <Icon
                                              name="FaLock"
                                              className="w-4 h-4 text-gray-700 dark:text-gray-300"
                                            />
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                              {p?.name}
                                            </div>
                                            <span className="ml-auto px-2 py-0.5 text-[11px] font-semibold rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                              CONFIDENCIAL
                                            </span>
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {p?.description || "—"}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Lector */}
                                      <div className="col-span-2 flex items-center justify-center">
                                        <input
                                          type="checkbox"
                                          disabled={isView || !enabled}
                                          checked={perm === "read"}
                                          onChange={(e) => {
                                            if (isView) return;
                                            if (!enabled) return;
                                            if (e.target.checked) setPermission(cid, pid, "read");
                                          }}
                                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                        />
                                      </div>

                                      {/* Editor */}
                                      <div className="col-span-2 flex items-center justify-center">
                                        <input
                                          type="checkbox"
                                          disabled={isView || !enabled}
                                          checked={perm === "edit"}
                                          onChange={(e) => {
                                            if (isView) return;
                                            if (!enabled) return;
                                            if (e.target.checked) setPermission(cid, pid, "edit");
                                          }}
                                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {!confClientIds.length && (
                    <div className="text-sm italic text-gray-500 dark:text-gray-500">
                      No existen proyectos confidenciales en el catálogo.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paso 4: Confirmación */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Revise la información antes de{" "}
              {isCreate ? "crear" : isEdit ? "guardar" : "cerrar"} el usuario.
            </p>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">
                  1
                </span>
                Usuario
              </h4>

              <div className="space-y-2 text-sm">
                <FieldRow label="Nombre" value={formData.name} />
                <FieldRow label="Email" value={formData.email} />
                <FieldRow label="Cargo" value={formData.position} />
                <FieldRow label="Teléfono" value={formData.phone} />
                <FieldRow label="Departamento" value={formData.department} />
                <FieldRow
                  label="Estado"
                  value={formData.status === "inactive" ? "Inactivo" : "Activo"}
                />
                <FieldRow
                  label="Rol Sistema"
                  value={
                    formData.systemRole === "admin"
                      ? "Administrador"
                      : formData.systemRole === "write"
                      ? "Escritura"
                      : "Lectura"
                  }
                />
                <FieldRow
                  label="Asignación"
                  value={
                    formData.assignmentMode === "all"
                      ? "Todos (solo normales) + confidenciales manual"
                      : "Específica"
                  }
                />
              </div>
            </div>

            {/* (1) Resumen de permisos: tabla con nombre cliente/proyecto + tipo + permiso */}
            <div className="border-l-4 border-indigo-500 pl-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs mr-2">
                  2
                </span>
                Permisos
              </h4>

              {formData.assignmentMode === "all" && (
                <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Acceso automático (Normales)
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    El usuario tendrá acceso a todos los proyectos normales.
                    El listado siguiente corresponde a permisos explícitos (principalmente confidenciales).
                  </div>
                </div>
              )}

              {!summaryRows.length ? (
                <div className="text-sm italic text-gray-500 dark:text-gray-500">
                  Sin permisos asignados
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-900/20 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                    <div className="col-span-4">Cliente</div>
                    <div className="col-span-5">Proyecto</div>
                    <div className="col-span-2 text-center">Tipo</div>
                    <div className="col-span-1 text-center">Permiso</div>
                  </div>

                  {summaryRows.map((r, idx) => {
                    const showTypeHeader =
                      idx === 0 || summaryRows[idx - 1]?.type !== r.type;

                    return (
                      <React.Fragment key={`${r.clientId}_${r.projectId}_${idx}`}>
                        {showTypeHeader && (
                          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/10">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <Icon
                                name={r.type === "Confidencial" ? "FaLock" : "FaFolder"}
                                className="w-4 h-4"
                              />
                              {r.type}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-12 px-3 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/5">
                          <div className="col-span-4">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {r.clientName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {r.clientId}
                            </div>
                          </div>

                          <div className="col-span-5">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {r.projectName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {r.projectId}
                            </div>
                          </div>

                          <div className="col-span-2 flex items-center justify-center">
                            <span
                              className={`
                                px-2 py-1 text-xs font-semibold rounded-md border
                                ${
                                  r.type === "Confidencial"
                                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/40"
                                    : "bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                                }
                              `}
                            >
                              {r.type}
                            </span>
                          </div>

                          <div className="col-span-1 flex items-center justify-center">
                            <span
                              className={`
                                px-2 py-1 text-xs font-semibold rounded-md border
                                ${
                                  r.permission === "Editor"
                                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40"
                                    : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/40"
                                }
                              `}
                              title={r.permission}
                            >
                              {r.permission === "Editor" ? "E" : "L"}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">
                  3
                </span>
                Notas
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {formData.notes || (
                  <span className="italic text-gray-500">Sin notas</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between">
          <button
            type="button"
            onClick={currentStep === 0 ? closeModal : handlePrevious}
            className="
              px-4 py-2 text-sm font-medium
              text-gray-700 dark:text-gray-300
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              hover:bg-gray-50 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors
            "
          >
            {currentStep === 0 ? "Cancelar" : "Anterior"}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="
              px-4 py-2 text-sm font-medium
              text-white
              bg-blue-600
              rounded-lg
              hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors
            "
          >
            {currentStep === steps.length - 1
              ? isView
                ? "Cerrar"
                : isCreate
                ? "Crear Usuario"
                : "Guardar"
              : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamsModal;
export { MODES as TEAMS_MODAL_MODES };