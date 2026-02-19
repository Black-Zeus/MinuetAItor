/* =========================================================
   Global Search - MinuetAItor (Mock)
   - Agrupa por módulo
   - Tabs + Scope pills
   - Highlight del término
   - Expand/Collapse por grupo
   - "Ver más" (placeholder)
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  input: $("#globalSearchInput"),
  btnSearch: $("#btnSearch"),
  btnClear: $("#btnClearQuery"),
  btnReset: $("#btnReset"),
  resultsInfo: $("#resultsInfo"),

  tabs: $$(".gs-tab"),
  scopePills: $$(".gs-pill"),

  chkExact: $("#chkExact"),
  chkConf: $("#chkConfidentialOnly"),
  selSort: $("#selSort"),

  countAll: $("#countAll"),
  countClients: $("#countClients"),
  countProjects: $("#countProjects"),
  countMinutes: $("#countMinutes"),
  countPeople: $("#countPeople"),

  subClients: $("#subClients"),
  subProjects: $("#subProjects"),
  subMinutes: $("#subMinutes"),
  subPeople: $("#subPeople"),

  listClients: $("#listClients"),
  listProjects: $("#listProjects"),
  listMinutes: $("#listMinutes"),
  listPeople: $("#listPeople"),

  emptyState: $("#emptyState"),

  btnCollapseAll: $("#btnCollapseAll"),
  btnExpandAll: $("#btnExpandAll"),
};

let state = {
  tab: "all",
  scope: "all",
  query: "",
};

/** Mock DB (estructura normalizable) */
const MOCK_DB = {
  clients: [
    { id: "cli-001", name: "Acme Corporation", desc: "Cliente enterprise. Contratos activos en múltiples proyectos.", conf: false, updatedAt: "2025-01-18" },
    { id: "cli-002", name: "TechStart Inc", desc: "Startup enfocada en aplicaciones móviles y backend escalable.", conf: true, updatedAt: "2025-01-25" },
    { id: "cli-003", name: "Global Solutions", desc: "Servicios TI, consultoría e implementación de CRM.", conf: false, updatedAt: "2025-01-22" },
  ],
  projects: [
    { id: "prj-101", name: "Rediseño Web", client: "Acme Corporation", desc: "Actualización UI/UX, performance y analítica.", conf: false, updatedAt: "2025-01-28" },
    { id: "prj-102", name: "App Mobile", client: "TechStart Inc", desc: "Aplicación móvil con integración de servicios.", conf: true, updatedAt: "2025-01-30" },
    { id: "prj-103", name: "Sistema CRM", client: "Global Solutions", desc: "Levantamiento de requerimientos y arquitectura.", conf: false, updatedAt: "2025-01-22" },
  ],
  minutes: [
    { id: "min-9001", name: "Reunión de Kick-off del Proyecto", date: "2025-01-15", time: "10:00 AM", client: "Acme Corporation", project: "Rediseño Web", desc: "Objetivos, entregables y cronograma inicial.", conf: false, updatedAt: "2025-01-15", status: "completed" },
    { id: "min-9002", name: "Revisión de Avances - Sprint 1", date: "2025-01-20", time: "2:30 PM", client: "TechStart Inc", project: "App Mobile", desc: "Progreso, blockers y ajuste de prioridades.", conf: true, updatedAt: "2025-01-20", status: "pending" },
    { id: "min-9003", name: "Análisis de Requerimientos", date: "2025-01-22", time: "11:00 AM", client: "Global Solutions", project: "Sistema CRM", desc: "Requerimientos funcionales y no funcionales.", conf: false, updatedAt: "2025-01-22", status: "in-progress" },
  ],
  people: [
    { id: "usr-001", name: "Juan Pérez", role: "Participante", desc: "Participa frecuentemente en minutas de planificación y alcance.", conf: false, updatedAt: "2025-01-30" },
    { id: "usr-002", name: "María García", role: "Participante", desc: "Foco en UX/UI y coordinación con stakeholders.", conf: false, updatedAt: "2025-01-28" },
    { id: "usr-003", name: "Carlos López", role: "Participante", desc: "Backend, dependencias y coordinación técnica.", conf: true, updatedAt: "2025-01-30" },
  ],
};

/* ---------- Utils ---------- */

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function highlight(text, q) {
  const raw = String(text ?? "");
  if (!q) return escapeHtml(raw);

  // Highlight seguro: operamos sobre texto escapado, luego reemplazamos coincidencias escapadas
  const escaped = escapeHtml(raw);
  const nq = normalize(q);
  if (!nq) return escaped;

  // Para mantenerlo simple, hacemos highlight por tokens (q split)
  const tokens = nq.split(/\s+/).filter(Boolean);
  let out = escaped;

  tokens.forEach((t) => {
    if (t.length < 2) return;
    // Regex sobre versión escapada: aproximación aceptable para UI
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    out = out.replace(re, `<mark class="gs-hl">$1</mark>`);
  });

  return out;
}

function matchItem(item, q, exact) {
  if (!q) return true;
  const hay = normalize(`${item.name} ${item.desc ?? ""} ${item.client ?? ""} ${item.project ?? ""} ${item.role ?? ""}`);
  const needle = normalize(q);

  if (!needle) return true;
  if (exact) return hay.includes(needle);

  // tokens AND
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

function sortItems(items, mode) {
  const copy = [...items];
  if (mode === "az") {
    copy.sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
  } else if (mode === "recent") {
    copy.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } else {
    // relevance (muy simple): por posición del match
    const q = normalize(state.query);
    copy.sort((a, b) => {
      const ha = normalize(`${a.name} ${a.desc ?? ""}`);
      const hb = normalize(`${b.name} ${b.desc ?? ""}`);
      const pa = q ? ha.indexOf(q) : 0;
      const pb = q ? hb.indexOf(q) : 0;
      return (pa === -1 ? 9999 : pa) - (pb === -1 ? 9999 : pb);
    });
  }
  return copy;
}

/* ---------- Renderers ---------- */

function renderCard(moduleKey, item) {
  const q = state.query;

  const confBadge = item.conf ? `<span class="gs-badge conf"><i class="fa-solid fa-lock"></i> Confidencial</span>` : "";
  const moduleBadge = (() => {
    if (moduleKey === "clients") return `<span class="gs-badge"><i class="fa-solid fa-building"></i> Cliente</span>`;
    if (moduleKey === "projects") return `<span class="gs-badge"><i class="fa-solid fa-folder"></i> Proyecto</span>`;
    if (moduleKey === "minutes") return `<span class="gs-badge"><i class="fa-solid fa-file-lines"></i> Minuta</span>`;
    return `<span class="gs-badge"><i class="fa-solid fa-user"></i> Persona</span>`;
  })();

  const meta = (() => {
    if (moduleKey === "clients") {
      return `
        <div class="gs-card-meta">
          <span class="gs-meta-item"><i class="fa-solid fa-clock-rotate-left"></i> Actualizado: ${escapeHtml(item.updatedAt)}</span>
        </div>`;
    }
    if (moduleKey === "projects") {
      return `
        <div class="gs-card-meta">
          <span class="gs-meta-item"><i class="fa-solid fa-building"></i> ${highlight(item.client, q)}</span>
          <span class="gs-meta-item"><i class="fa-solid fa-clock-rotate-left"></i> ${escapeHtml(item.updatedAt)}</span>
        </div>`;
    }
    if (moduleKey === "minutes") {
      return `
        <div class="gs-card-meta">
          <span class="gs-meta-item"><i class="fa-solid fa-calendar"></i> ${escapeHtml(item.date)}</span>
          <span class="gs-meta-item"><i class="fa-solid fa-clock"></i> ${escapeHtml(item.time)}</span>
          <span class="gs-meta-item"><i class="fa-solid fa-building"></i> ${highlight(item.client, q)}</span>
          <span class="gs-meta-item"><i class="fa-solid fa-folder"></i> ${highlight(item.project, q)}</span>
        </div>`;
    }
    // people
    return `
      <div class="gs-card-meta">
        <span class="gs-meta-item"><i class="fa-solid fa-id-badge"></i> ${highlight(item.role, q)}</span>
        <span class="gs-meta-item"><i class="fa-solid fa-clock-rotate-left"></i> ${escapeHtml(item.updatedAt)}</span>
      </div>`;
  })();

  return `
    <article class="gs-card" data-module="${moduleKey}" data-id="${escapeHtml(item.id)}">
      <div class="gs-card-top">
        <div>
          <h3 class="gs-card-title">${highlight(item.name, q)}</h3>
          ${meta}
        </div>
        <div class="gs-badges">
          ${moduleBadge}
          ${confBadge}
        </div>
      </div>

      <div class="gs-card-desc">
        ${highlight(item.desc ?? "", q)}
      </div>

      <div class="gs-card-footer">
        <a class="gs-link" href="#" data-open="${escapeHtml(item.id)}">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
          Abrir
        </a>

        <div class="gs-actions">
          <button class="gs-icon-btn" title="Ver" data-action="view">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="gs-icon-btn" title="Editar" data-action="edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="gs-icon-btn" title="Timeline" data-action="timeline">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderGroup(moduleKey, items, limit = 6) {
  const container = {
    clients: els.listClients,
    projects: els.listProjects,
    minutes: els.listMinutes,
    people: els.listPeople,
  }[moduleKey];

  const visible = items.slice(0, limit);
  container.innerHTML = visible.map((x) => renderCard(moduleKey, x)).join("");
}

function setCounts(counts) {
  els.countClients.textContent = counts.clients;
  els.countProjects.textContent = counts.projects;
  els.countMinutes.textContent = counts.minutes;
  els.countPeople.textContent = counts.people;
  els.countAll.textContent = counts.total;

  els.subClients.textContent = `${counts.clients} resultados`;
  els.subProjects.textContent = `${counts.projects} resultados`;
  els.subMinutes.textContent = `${counts.minutes} resultados`;
  els.subPeople.textContent = `${counts.people} resultados`;
}

function applyTabVisibility() {
  const tab = state.tab;
  $$(".gs-group").forEach((group) => {
    const g = group.getAttribute("data-group");
    const show = (tab === "all" || tab === g);
    group.style.display = show ? "" : "none";
  });
}

function applyScopeToSearch(moduleKey) {
  // scope pills restringen qué módulos se consultan
  return state.scope === "all" || state.scope === moduleKey;
}

function doSearch() {
  const q = els.input.value.trim();
  state.query = q;

  const exact = !!els.chkExact.checked;
  const confidentialOnly = !!els.chkConf.checked;
  const sortMode = els.selSort.value;

  // Filtrar por scope + query + conf
  const res = {};
  ["clients", "projects", "minutes", "people"].forEach((k) => {
    let items = MOCK_DB[k].filter(() => applyScopeToSearch(k));
    items = items.filter((it) => matchItem(it, q, exact));
    if (confidentialOnly) items = items.filter((it) => !!it.conf);
    items = sortItems(items, sortMode);
    res[k] = items;
  });

  // Render
  renderGroup("clients", res.clients);
  renderGroup("projects", res.projects);
  renderGroup("minutes", res.minutes);
  renderGroup("people", res.people);

  // Counts
  const counts = {
    clients: res.clients.length,
    projects: res.projects.length,
    minutes: res.minutes.length,
    people: res.people.length,
  };
  counts.total = counts.clients + counts.projects + counts.minutes + counts.people;
  setCounts(counts);

  // Info + empty state
  if (!q) {
    els.resultsInfo.innerHTML = `<i class="fa-solid fa-list-check"></i> Ingrese un término para buscar.`;
  } else {
    els.resultsInfo.innerHTML = `<i class="fa-solid fa-list-check"></i> Resultados para <strong>${escapeHtml(q)}</strong>: <strong>${counts.total}</strong>`;
  }

  const hasAny = counts.total > 0 && !!q;
  $("#resultsContainer").classList.toggle("hidden", !hasAny && !!q);
  els.emptyState.classList.toggle("hidden", hasAny || !q);

  // Tabs: mantener visibilidad coherente
  applyTabVisibility();

  // Ocultar grupos sin resultados (cuando hay query)
  if (q) {
    $$(".gs-group").forEach((group) => {
      const g = group.getAttribute("data-group");
      const n = counts[g];
      // si tab = "all", ocultar grupo vacío para reducir ruido
      if (state.tab === "all") {
        group.style.display = n > 0 ? "" : "none";
      }
    });
  } else {
    // sin query, no mostrar resultados ni empty; dejamos todo visible por defecto
    $$(".gs-group").forEach((group) => (group.style.display = ""));
  }
}

/* ---------- Events ---------- */

function setActiveTab(tabKey) {
  state.tab = tabKey;
  els.tabs.forEach((t) => {
    const is = t.dataset.tab === tabKey;
    t.classList.toggle("active", is);
    t.setAttribute("aria-selected", is ? "true" : "false");
  });
  applyTabVisibility();
  // si está en "all", re-aplicamos lógica de ocultar vacíos
  doSearch();
}

function setActiveScope(scopeKey) {
  state.scope = scopeKey;
  els.scopePills.forEach((p) => p.classList.toggle("active", p.dataset.scope === scopeKey));
  doSearch();
}

function collapseGroup(key, collapsed) {
  const group = document.querySelector(`.gs-group[data-group="${key}"]`);
  if (!group) return;

  group.classList.toggle("gs-collapsed", collapsed);

  const toggleBtn = group.querySelector(`[data-toggle="${key}"]`);
  const icon = toggleBtn?.querySelector("i");
  if (toggleBtn) toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  if (icon) icon.className = collapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-down";
}

function bindGroupToggles() {
  $$(".gs-group-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.toggle;
      const group = document.querySelector(`.gs-group[data-group="${key}"]`);
      const isCollapsed = group.classList.contains("gs-collapsed");
      collapseGroup(key, !isCollapsed);
    });
  });

  $$(".gs-group-more").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.more;
      // Placeholder: en producción, navega a vista del módulo con query aplicada
      alert(`Ver más en módulo: ${key} (query="${state.query || ""}")`);
    });
  });
}

function bindTabsAndScope() {
  els.tabs.forEach((t) => {
    t.addEventListener("click", () => setActiveTab(t.dataset.tab));
  });

  els.scopePills.forEach((p) => {
    p.addEventListener("click", () => setActiveScope(p.dataset.scope));
  });
}

function bindControls() {
  els.btnSearch.addEventListener("click", doSearch);

  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
    if (e.key === "Escape") {
      els.input.value = "";
      doSearch();
    }
  });

  els.btnClear.addEventListener("click", () => {
    els.input.value = "";
    els.input.focus();
    doSearch();
  });

  els.btnReset.addEventListener("click", () => {
    els.chkExact.checked = false;
    els.chkConf.checked = false;
    els.selSort.value = "relevance";
    setActiveScope("all");
    setActiveTab("all");
    els.input.value = "";
    doSearch();
  });

  els.chkExact.addEventListener("change", doSearch);
  els.chkConf.addEventListener("change", doSearch);
  els.selSort.addEventListener("change", doSearch);

  els.btnCollapseAll.addEventListener("click", () => {
    ["clients", "projects", "minutes", "people"].forEach((k) => collapseGroup(k, true));
  });

  els.btnExpandAll.addEventListener("click", () => {
    ["clients", "projects", "minutes", "people"].forEach((k) => collapseGroup(k, false));
  });

  // Atajos globales
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      els.input.focus();
    }
  });

  // Delegación de acciones en cards
  $("#resultsContainer").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    const open = e.target.closest("[data-open]");
    if (!btn && !open) return;

    const card = e.target.closest(".gs-card");
    const moduleKey = card?.dataset?.module;
    const id = card?.dataset?.id;

    if (open) {
      e.preventDefault();
      alert(`Abrir ${moduleKey}:${id}`);
      return;
    }

    const action = btn.dataset.action;
    alert(`Acción="${action}" en ${moduleKey}:${id}`);
  });
}

/* ---------- Init ---------- */

(function init() {
  bindTabsAndScope();
  bindControls();
  bindGroupToggles();
  doSearch(); // estado inicial
})();
