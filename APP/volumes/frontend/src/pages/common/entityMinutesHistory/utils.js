export const cn = (...classes) => classes.filter(Boolean).join(" ");

export const normalizeEntity = (type, data = {}) => {
  if (type === "all") {
    return {
      id: data.id ?? "all",
      name: data.name ?? "Historial",
      subtitle: data.subtitle ?? "Todas las minutas registradas",
      description: data.description ?? "Consulta transversal por cliente, proyecto, estado y fecha",
      logoUrl: "",
      icon: "history",
      badge: data.badge ?? "General",
    };
  }

  if (type === "project") {
    return {
      id: data.id ?? data.projectId ?? "",
      name: data.projectName ?? data.name ?? "Proyecto",
      subtitle: data.clientName ?? data.client_name ?? data.client?.name ?? "Sin cliente",
      description: data.projectDescription ?? data.description ?? "",
      logoUrl: data.logoUrl ?? data.logo_url ?? "",
      icon: "FaFolderOpen",
      badge: (data.projectStatus ?? data.status ?? "activo") === "inactivo" ? "Inactivo" : "Activo",
    };
  }

  if (type === "participant") {
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const primaryEmail = emails.find((item) => item.isPrimary || item.is_primary) ?? emails[0] ?? null;

    return {
      id: data.id ?? data.participantId ?? "",
      name: data.displayName ?? data.display_name ?? "Participante",
      subtitle: primaryEmail?.email ?? data.organization ?? "Sin correo principal",
      description: [data.title, data.organization].filter(Boolean).join(" · "),
      logoUrl: data.logoUrl ?? data.logo_url ?? data.avatarUrl ?? data.avatar_url ?? "",
      icon: "FaUser",
      badge: (data.isActive ?? data.is_active ?? true) ? "Activo" : "Inactivo",
    };
  }

  return {
    id: data.id ?? data.clientId ?? "",
    name: data.companyName ?? data.name ?? "Cliente",
    subtitle: data.industry ?? data.companyEmail ?? data.email ?? "Sin industria registrada",
    description: data.description ?? data.companyLegalName ?? data.legal_name ?? "",
    logoUrl: data.logoUrl ?? data.logo_url ?? "",
    icon: "FaBuilding",
    badge: (data.isActive ?? data.is_active ?? true) ? "Activo" : "Inactivo",
  };
};

export const getInitialVisibleFilters = (type) => ({
  search: true,
  status: true,
  project: type === "client" || type === "participant" || type === "all",
  client: type === "participant" || type === "all",
  dateFrom: true,
  dateTo: true,
});

export const filterText = (value) => String(value ?? "").trim().toLowerCase();

export const buildOptionCatalog = (items, valueKey, labelKey) => {
  const byValue = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const rawValue = item?.[valueKey] ?? item?.[labelKey];
    const rawLabel = item?.[labelKey] ?? item?.[valueKey];
    const value = String(rawValue ?? "").trim();
    const label = String(rawLabel ?? "").trim();
    if (value && label) byValue.set(value, label);
  });
  return [...byValue.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
};

export const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const subtractOneMonth = (date) => {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - 1);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};

export const getDefaultHistoryFilters = () => {
  const today = new Date();
  return {
    search: "",
    status: "",
    project: "",
    client: "",
    dateFrom: formatDateInputValue(subtractOneMonth(today)),
    dateTo: formatDateInputValue(today),
  };
};

export const getMinutePdfState = (minute) => {
  const status = String(minute?.status ?? "in-progress");
  const isCompleted = status === "completed";
  const disabledStatuses = ["cancelled", "deleted", "llm-failed", "processing-error", "in-progress"];

  return {
    disabled: disabledStatuses.includes(status),
    type: isCompleted ? "published" : "draft",
    label: isCompleted ? "PDF final" : "PDF borrador",
  };
};

export const applyHistoryFilters = (items, filters) => {
  const search = filterText(filters.search);
  const status = filterText(filters.status);
  const project = filterText(filters.project);
  const client = filterText(filters.client);
  const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
  const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;

  return (Array.isArray(items) ? items : []).filter((minute) => {
    if (search) {
      const haystack = [
        minute?.title,
        minute?.summary,
        minute?.preparedBy,
        minute?.client,
        minute?.project,
      ].map(filterText).join(" ");
      if (!haystack.includes(search)) return false;
    }

    if (status && filterText(minute?.status) !== status) return false;
    if (project && filterText(minute?.project) !== project) return false;
    if (client && filterText(minute?.client) !== client) return false;

    if (dateFrom || dateTo) {
      if (!minute?.date) return false;
      const minuteDate = new Date(minute.date);
      if (Number.isNaN(minuteDate.getTime())) return false;
      if (dateFrom && minuteDate < dateFrom) return false;
      if (dateTo && minuteDate > dateTo) return false;
    }

    return true;
  });
};
