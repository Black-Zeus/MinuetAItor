/**
 * store/minuteEditorStore.js
 * Store dedicado para el editor de minutas (previsualización previa a PDF).
 * + Snapshot baseline (rollback) + Diff de cambios
 *
 * No persiste en localStorage (datos temporales de sesión de edición).
 */

import { create } from "zustand";

// ============================================================
// HELPERS
// ============================================================

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

// deepClone robusto
const deepClone = (obj) => {
  // structuredClone (moderno) + fallback
  try {
    // eslint-disable-next-line no-undef
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
};

const safeStr = (v) => (v ?? "").toString();

// Normalizadores (evitan ruido por uid() en diff)
const normalizeMeetingInfo = (mi = {}) => ({
  client: safeStr(mi.client),
  subject: safeStr(mi.subject),
  meetingDate: safeStr(mi.meetingDate),
  location: safeStr(mi.location),
  preparedBy: safeStr(mi.preparedBy),
});

const normalizeMeetingTimes = (mt = {}) => ({
  scheduledStart: safeStr(mt.scheduledStart),
  actualStart: safeStr(mt.actualStart),
  scheduledEnd: safeStr(mt.scheduledEnd),
  actualEnd: safeStr(mt.actualEnd),
});

// Participantes: clave estable por fullName+type
const normParticipants = (arr = []) =>
  (arr ?? [])
    .map((p) => ({
      key: `${safeStr(p.fullName).trim().toLowerCase()}|${safeStr(p.type)}`,
      fullName: safeStr(p.fullName),
      initials: safeStr(p.initials),
      type: safeStr(p.type),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

// Scope: clave por sectionId, topics/details por contenido
const normScope = (arr = []) =>
  (arr ?? [])
    .map((s) => ({
      id: safeStr(s.id),
      title: safeStr(s.title),
      type: safeStr(s.type),
      summary: safeStr(s.summary),
      topicsList: (s.topicsList ?? []).map((t) => safeStr(t.text)).sort((a, b) => a.localeCompare(b)),
      details: (s.details ?? [])
        .map((d) => ({ label: safeStr(d.label), description: safeStr(d.description) }))
        .sort((a, b) => (a.label + a.description).localeCompare(b.label + b.description)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

const normAgreements = (arr = []) =>
  (arr ?? [])
    .map((a) => ({
      agreementId: safeStr(a.agreementId),
      subject: safeStr(a.subject),
      body: safeStr(a.body),
      responsible: safeStr(a.responsible),
      dueDate: safeStr(a.dueDate),
      status: safeStr(a.status),
    }))
    .sort((a, b) => a.agreementId.localeCompare(b.agreementId));

const normRequirements = (arr = []) =>
  (arr ?? [])
    .map((r) => ({
      requirementId: safeStr(r.requirementId),
      entity: safeStr(r.entity),
      body: safeStr(r.body),
      responsible: safeStr(r.responsible),
      priority: safeStr(r.priority),
      status: safeStr(r.status),
    }))
    .sort((a, b) => a.requirementId.localeCompare(b.requirementId));

const normUserTags = (arr = []) =>
  (arr ?? [])
    .map((t) => safeStr(t.name).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const normUpcoming = (arr = []) =>
  (arr ?? [])
    .map((m) => ({
      meetingId: safeStr(m.meetingId),
      scheduledDate: safeStr(m.scheduledDate),
      agenda: safeStr(m.agenda),
      attendees: (m.attendees ?? []).map((a) => safeStr(a)).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.meetingId.localeCompare(b.meetingId));

/**
 * Construye estado comparable (sin ruido por ids uid()).
 */
const buildComparableState = (s) => ({
  meetingInfo: normalizeMeetingInfo(s.meetingInfo),
  meetingTimes: normalizeMeetingTimes(s.meetingTimes),
  participants: normParticipants(s.participants),
  scopeSections: normScope(s.scopeSections),
  agreements: normAgreements(s.agreements),
  requirements: normRequirements(s.requirements),
  userTags: normUserTags(s.userTags),
  upcomingMeetings: normUpcoming(s.upcomingMeetings),
  pdfFormat: s.pdfFormat ? deepClone(s.pdfFormat) : null,
});

/**
 * Diff UI-friendly: { section, field, before, after }
 */
const diffComparable = (base, curr) => {
  const changes = [];

  const push = (section, field, before, after) => {
    const b = safeStr(before);
    const a = safeStr(after);
    if (b !== a) changes.push({ section, field, before, after });
  };

  // meetingInfo
  Object.keys(base.meetingInfo).forEach((k) =>
    push("Información de la reunión", k, base.meetingInfo[k], curr.meetingInfo[k])
  );

  // meetingTimes
  Object.keys(base.meetingTimes).forEach((k) => push("Horarios", k, base.meetingTimes[k], curr.meetingTimes[k]));

  // participants
  const bP = new Map(base.participants.map((p) => [p.key, p]));
  const cP = new Map(curr.participants.map((p) => [p.key, p]));
  for (const k of bP.keys()) {
    if (!cP.has(k)) changes.push({ section: "Participantes", field: "Eliminado", before: bP.get(k).fullName, after: "" });
  }
  for (const k of cP.keys()) {
    if (!bP.has(k)) changes.push({ section: "Participantes", field: "Agregado", before: "", after: cP.get(k).fullName });
  }

  // scopeSections
  const bS = new Map(base.scopeSections.map((x) => [x.id, x]));
  const cS = new Map(curr.scopeSections.map((x) => [x.id, x]));
  for (const id of bS.keys()) if (!cS.has(id)) changes.push({ section: "Alcance", field: "Sección eliminada", before: id, after: "" });
  for (const id of cS.keys()) if (!bS.has(id)) changes.push({ section: "Alcance", field: "Sección agregada", before: "", after: id });
  for (const [id, bs] of bS.entries()) {
    const cs = cS.get(id);
    if (!cs) continue;
    push(`Alcance > ${bs.title || id}`, "summary", bs.summary, cs.summary);
    push(`Alcance > ${bs.title || id}`, "topicsList", (bs.topicsList ?? []).join(" | "), (cs.topicsList ?? []).join(" | "));
    push(
      `Alcance > ${bs.title || id}`,
      "details",
      (bs.details ?? []).map((d) => `${d.label}: ${d.description}`).join(" | "),
      (cs.details ?? []).map((d) => `${d.label}: ${d.description}`).join(" | ")
    );
  }

  // agreements
  const bA = new Map(base.agreements.map((x) => [x.agreementId, x]));
  const cA = new Map(curr.agreements.map((x) => [x.agreementId, x]));
  for (const id of bA.keys()) if (!cA.has(id)) changes.push({ section: "Acuerdos", field: "Eliminado", before: id, after: "" });
  for (const id of cA.keys()) if (!bA.has(id)) changes.push({ section: "Acuerdos", field: "Agregado", before: "", after: id });
  for (const [id, ba] of bA.entries()) {
    const ca = cA.get(id);
    if (!ca) continue;
    push(`Acuerdos > ${id}`, "subject", ba.subject, ca.subject);
    push(`Acuerdos > ${id}`, "body", ba.body, ca.body);
    push(`Acuerdos > ${id}`, "responsible", ba.responsible, ca.responsible);
    push(`Acuerdos > ${id}`, "dueDate", ba.dueDate, ca.dueDate);
    push(`Acuerdos > ${id}`, "status", ba.status, ca.status);
  }

  // requirements
  const bR = new Map(base.requirements.map((x) => [x.requirementId, x]));
  const cR = new Map(curr.requirements.map((x) => [x.requirementId, x]));
  for (const id of bR.keys()) if (!cR.has(id)) changes.push({ section: "Requerimientos", field: "Eliminado", before: id, after: "" });
  for (const id of cR.keys()) if (!bR.has(id)) changes.push({ section: "Requerimientos", field: "Agregado", before: "", after: id });
  for (const [id, br] of bR.entries()) {
    const cr = cR.get(id);
    if (!cr) continue;
    push(`Requerimientos > ${id}`, "entity", br.entity, cr.entity);
    push(`Requerimientos > ${id}`, "body", br.body, cr.body);
    push(`Requerimientos > ${id}`, "responsible", br.responsible, cr.responsible);
    push(`Requerimientos > ${id}`, "priority", br.priority, cr.priority);
    push(`Requerimientos > ${id}`, "status", br.status, cr.status);
  }

  // userTags
  push("Tags de usuario", "list", base.userTags.join(" | "), curr.userTags.join(" | "));

  // upcoming
  const bU = new Map(base.upcomingMeetings.map((x) => [x.meetingId, x]));
  const cU = new Map(curr.upcomingMeetings.map((x) => [x.meetingId, x]));
  for (const id of bU.keys()) if (!cU.has(id)) changes.push({ section: "Próximas reuniones", field: "Eliminado", before: id, after: "" });
  for (const id of cU.keys()) if (!bU.has(id)) changes.push({ section: "Próximas reuniones", field: "Agregado", before: "", after: id });
  for (const [id, bu] of bU.entries()) {
    const cu = cU.get(id);
    if (!cu) continue;
    push(`Próximas reuniones > ${id}`, "scheduledDate", bu.scheduledDate, cu.scheduledDate);
    push(`Próximas reuniones > ${id}`, "agenda", bu.agenda, cu.agenda);
  }

  // pdfFormat toggles + coverPage
  if (base.pdfFormat && curr.pdfFormat) {
    const sheets = ["coverPage", "summarySheet", "versionControl", "signaturePage"];
    for (const sh of sheets) {
      push("Formato PDF", `${sh}.enabled`, base.pdfFormat?.[sh]?.enabled ? "true" : "false", curr.pdfFormat?.[sh]?.enabled ? "true" : "false");
    }
    const cpFields = ["projectName", "minuteTitle", "preparedBy", "footerNote"];
    for (const f of cpFields) {
      push("Formato PDF > Portada", f, safeStr(base.pdfFormat?.coverPage?.[f]), safeStr(curr.pdfFormat?.coverPage?.[f]));
    }
  }

  return changes;
};

// ============================================================
// MAPPER IA -> STATE
// ============================================================

/**
 * Transforma la respuesta cruda de la IA al estado interno del store.
 * @param {Object} iaResponse - Objeto JSON de la IA
 * @returns {Object} Estado inicial del editor
 */
export const mapIAResponseToEditorState = (iaResponse) => {
  const { generalInfo, participants, scope, agreements, requirements, inputInfo, upcomingMeetings, metadata } = iaResponse;

  // --- Información de la reunión ---
  const meetingInfo = {
    client: generalInfo?.client ?? "",
    subject: generalInfo?.subject ?? "",
    meetingDate: generalInfo?.meetingDate ?? "",
    location: generalInfo?.location ?? "",
    preparedBy: generalInfo?.preparedBy ?? "",
  };

  // --- Horarios ---
  const meetingTimes = {
    scheduledStart: generalInfo?.scheduledStartTime ?? "",
    actualStart: generalInfo?.actualStartTime ?? "",
    scheduledEnd: generalInfo?.scheduledEndTime ?? "",
    actualEnd: generalInfo?.actualEndTime ?? "",
  };

  // --- Participantes: unificar listas con tipo + id ---
  const mapParticipantList = (list, type) =>
    (list ?? []).map((p) => ({
      id: uid(),
      fullName: p.fullName,
      initials: p.initials ?? p.fullName.slice(0, 2).toUpperCase(),
      type, // invited | attendee | copy
      role: "",
      email: "",
    }));

  // evitar duplicados invited vs attendees
  const invitedNames = new Set((participants?.invited ?? []).map((p) => p.fullName));
  const participantList = [
    ...mapParticipantList(participants?.invited ?? [], "invited"),
    ...(participants?.attendees ?? [])
      .filter((p) => !invitedNames.has(p.fullName))
      .map((p) => ({
        id: uid(),
        fullName: p.fullName,
        initials: p.initials ?? "",
        type: "attendee",
        role: "",
        email: "",
      })),
    ...mapParticipantList(participants?.copyRecipients ?? [], "copy"),
  ];

  // --- Alcance: secciones ---
  const scopeSections = (scope?.sections ?? []).map((s) => ({
    id: s.sectionId,
    title: s.sectionTitle,
    type: s.sectionType, // introduction | topic
    summary: s.content?.summary ?? "",
    topicsList: (s.content?.topicsList ?? []).map((t) => ({ id: uid(), text: t })),
    details: (s.content?.details ?? []).map((d) => ({
      id: uid(),
      label: d.label,
      description: d.description,
    })),
  }));

  // --- Acuerdos ---
  const agreementList = (agreements?.items ?? []).map((a) => ({
    id: uid(),
    agreementId: a.agreementId,
    subject: a.subject,
    body: a.body,
    responsible: a.responsible,
    dueDate: a.dueDate ?? "",
    status: a.status ?? "pending",
  }));

  // --- Requerimientos ---
  const requirementList = (requirements?.items ?? []).map((r) => ({
    id: uid(),
    requirementId: r.requirementId,
    entity: r.entity,
    body: r.body,
    responsible: r.responsible,
    priority: r.priority ?? "medium",
    status: r.status ?? "open",
  }));

  // --- Tags IA (solo eliminar) ---
  const aiTags = (iaResponse?.aiSuggestedTags ?? []).map((t) => ({
    id: uid(),
    name: t.name,
    description: t.description,
    origin: "ai",
  }));

  // --- Tags usuario (desde inputInfo.userProvidedTags) ---
  const userTags = (inputInfo?.userProvidedTags ?? []).map((t) => ({
    id: uid(),
    name: t,
    origin: "user",
  }));

  // --- Próximas reuniones ---
  const upcomingList = (upcomingMeetings?.items ?? []).map((m) => ({
    id: uid(),
    meetingId: m.meetingId,
    scheduledDate: m.scheduledDate,
    agenda: m.agenda,
    attendees: m.attendees ?? [],
  }));

  // --- Metadata (bloqueada) ---
  const metadataLocked = {
    transactionId: metadata?.transactionId ?? "",
    generatedAt: metadata?.generatedAt ?? "",
    generatedBy: metadata?.generatedBy ?? "",
    version: metadata?.version ?? "",
    profileId: inputInfo?.profileInfo?.profileId ?? "",
    profileName: inputInfo?.profileInfo?.profileName ?? "",
    attachments: inputInfo?.attachments ?? [],
  };

  // --- Nota adicional (IA, bloqueada) ---
  const additionalNote = inputInfo?.additionalNotes ?? "";

  // --- Timeline demo ---
  const timeline = [
    {
      id: uid(),
      version: "v1.0",
      publishedAt: "2026-02-12T23:18:00-03:00",
      publishedBy: generalInfo?.preparedBy ?? "Sistema",
      observation: "Publicación inicial generada desde IA.",
      changesSummary: "Versión original sin modificaciones.",
    },
  ];

  // --- PDF format defaults ---
  const pdfFormat = {
    coverPage: {
      enabled: false,
      projectName: inputInfo?.projectInfo?.project ?? "",
      minuteTitle: generalInfo?.subject ?? "",
      preparedBy: generalInfo?.preparedBy ?? "",
      footerNote: "",
    },
    summarySheet: { enabled: false },
    versionControl: { enabled: false },
    signaturePage: { enabled: false, signatories: [] },
  };

  return {
    meetingInfo,
    meetingTimes,
    participants: participantList,
    scopeSections,
    agreements: agreementList,
    requirements: requirementList,
    aiTags,
    userTags,
    upcomingMeetings: upcomingList,
    metadataLocked,
    additionalNote,
    timeline,
    pdfFormat,
  };
};

// ============================================================
// INITIAL STATE (vacío)
// ============================================================

const EMPTY_STATE = {
  isLoaded: false,

  meetingInfo: {
    client: "",
    subject: "",
    meetingDate: "",
    location: "",
    preparedBy: "",
  },

  meetingTimes: {
    scheduledStart: "",
    actualStart: "",
    scheduledEnd: "",
    actualEnd: "",
  },

  participants: [],
  scopeSections: [],
  agreements: [],
  requirements: [],
  aiTags: [],
  userTags: [],
  upcomingMeetings: [],

  metadataLocked: {},
  additionalNote: "",

  activeTab: "info",
  findQuery: "",
  replaceQuery: "",

  isDirty: false,
  lastPublishedAt: null,

  timeline: [],

  pdfFormat: {
    coverPage: { enabled: false, projectName: "", minuteTitle: "", preparedBy: "", footerNote: "" },
    summarySheet: { enabled: false },
    versionControl: { enabled: false },
    signaturePage: { enabled: false, signatories: [] },
  },

  // ----------------------------------------------------------
  // SNAPSHOT BASELINE
  // ----------------------------------------------------------
  baselineSnapshot: null,
  snapshotAt: null,

  // Para forzar remount del editor si quieres usar key en el contenedor
  editorRevisionKey: 0,
};

// ============================================================
// STORE
// ============================================================

const useMinuteEditorStore = create((set, get) => ({
  ...EMPTY_STATE,

  // ----------------------------------------------------------
  // INICIALIZACIÓN
  // ----------------------------------------------------------

  loadFromIAResponse: (iaResponse) => {
    const mapped = mapIAResponseToEditorState(iaResponse);

    const baseline = deepClone({
      meetingInfo: mapped.meetingInfo,
      meetingTimes: mapped.meetingTimes,
      participants: mapped.participants,
      scopeSections: mapped.scopeSections,
      agreements: mapped.agreements,
      requirements: mapped.requirements,
      aiTags: mapped.aiTags,
      userTags: mapped.userTags,
      upcomingMeetings: mapped.upcomingMeetings,
      metadataLocked: mapped.metadataLocked,
      additionalNote: mapped.additionalNote,
      timeline: mapped.timeline,
      pdfFormat: mapped.pdfFormat,
    });

    set({
      ...mapped,
      isLoaded: true,
      activeTab: "info",
      isDirty: false,
      lastPublishedAt: null,

      baselineSnapshot: baseline,
      snapshotAt: new Date().toISOString(),
    });
  },

  reset: () => set({ ...EMPTY_STATE }),

  markDirty: () => set({ isDirty: true }),

  markClean: (publishedAt) => set({ isDirty: false, lastPublishedAt: publishedAt }),

  // ----------------------------------------------------------
  // SNAPSHOT / ROLLBACK
  // ----------------------------------------------------------

  takeSnapshot: () => {
    const s = get();
    const baseline = deepClone({
      meetingInfo: s.meetingInfo,
      meetingTimes: s.meetingTimes,
      participants: s.participants,
      scopeSections: s.scopeSections,
      agreements: s.agreements,
      requirements: s.requirements,
      aiTags: s.aiTags,
      userTags: s.userTags,
      upcomingMeetings: s.upcomingMeetings,
      metadataLocked: s.metadataLocked,
      additionalNote: s.additionalNote,
      timeline: s.timeline,
      pdfFormat: s.pdfFormat,
    });

    set({
      baselineSnapshot: baseline,
      snapshotAt: new Date().toISOString(),
    });
  },

  getChangesSinceSnapshot: () => {
    const s = get();
    if (!s.baselineSnapshot) return [];

    const baseComparable = buildComparableState(s.baselineSnapshot);
    const currComparable = buildComparableState(s);

    return diffComparable(baseComparable, currComparable);
  },

  rollbackToSnapshot: () => {
    const s = get();
    if (!s.baselineSnapshot) return;

    const b = deepClone(s.baselineSnapshot);

    set((prev) => ({
      meetingInfo: b.meetingInfo,
      meetingTimes: b.meetingTimes,
      participants: b.participants,
      scopeSections: b.scopeSections,
      agreements: b.agreements,
      requirements: b.requirements,
      aiTags: b.aiTags,
      userTags: b.userTags,
      upcomingMeetings: b.upcomingMeetings,
      metadataLocked: b.metadataLocked,
      additionalNote: b.additionalNote,
      timeline: b.timeline,
      pdfFormat: b.pdfFormat,

      isDirty: false,

      // fuerza remount si el contenedor usa key={editorRevisionKey}
      editorRevisionKey: (prev.editorRevisionKey ?? 0) + 1,
    }));
  },

  // ----------------------------------------------------------
  // NAVEGACIÓN DE TABS
  // ----------------------------------------------------------

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ----------------------------------------------------------
  // INFORMACIÓN DE LA REUNIÓN
  // ----------------------------------------------------------

  updateMeetingInfo: (field, value) =>
    set((s) => ({ meetingInfo: { ...s.meetingInfo, [field]: value }, isDirty: true })),

  // ----------------------------------------------------------
  // HORARIOS
  // ----------------------------------------------------------

  updateMeetingTimes: (field, value) =>
    set((s) => ({ meetingTimes: { ...s.meetingTimes, [field]: value }, isDirty: true })),

  // ----------------------------------------------------------
  // PARTICIPANTES
  // ----------------------------------------------------------

  addParticipant: (participantData) =>
    set((s) => ({
      participants: [...s.participants, { id: uid(), ...participantData }],
      isDirty: true,
    })),

  updateParticipant: (id, data) =>
    set((s) => ({
      participants: s.participants.map((p) => (p.id === id ? { ...p, ...data } : p)),
      isDirty: true,
    })),

  deleteParticipant: (id) =>
    set((s) => ({ participants: s.participants.filter((p) => p.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // ALCANCE — SECCIONES
  // ----------------------------------------------------------

  updateSectionSummary: (sectionId, summary) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) => (sec.id === sectionId ? { ...sec, summary } : sec)),
      isDirty: true,
    })),

  addSectionTopic: (sectionId) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId ? { ...sec, topicsList: [...sec.topicsList, { id: uid(), text: "Nuevo tema" }] } : sec
      ),
      isDirty: true,
    })),

  updateSectionTopic: (sectionId, topicId, text) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId
          ? { ...sec, topicsList: sec.topicsList.map((t) => (t.id === topicId ? { ...t, text } : t)) }
          : sec
      ),
      isDirty: true,
    })),

  deleteSectionTopic: (sectionId, topicId) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId ? { ...sec, topicsList: sec.topicsList.filter((t) => t.id !== topicId) } : sec
      ),
      isDirty: true,
    })),

  addSectionDetail: (sectionId) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId ? { ...sec, details: [...sec.details, { id: uid(), label: "Nuevo detalle", description: "" }] } : sec
      ),
      isDirty: true,
    })),

  updateSectionDetail: (sectionId, detailId, field, value) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId
          ? { ...sec, details: sec.details.map((d) => (d.id === detailId ? { ...d, [field]: value } : d)) }
          : sec
      ),
      isDirty: true,
    })),

  deleteSectionDetail: (sectionId, detailId) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId ? { ...sec, details: sec.details.filter((d) => d.id !== detailId) } : sec
      ),
      isDirty: true,
    })),

  // ----------------------------------------------------------
  // ACUERDOS
  // ----------------------------------------------------------

  addAgreement: (data) =>
    set((s) => ({
      agreements: [
        ...s.agreements,
        {
          id: uid(),
          agreementId: `AGR-${String(s.agreements.length + 1).padStart(3, "0")}`,
          subject: "Nuevo acuerdo",
          body: "",
          responsible: "",
          dueDate: "",
          status: "pending",
          ...data,
        },
      ],
      isDirty: true,
    })),

  updateAgreement: (id, data) =>
    set((s) => ({
      agreements: s.agreements.map((a) => (a.id === id ? { ...a, ...data } : a)),
      isDirty: true,
    })),

  deleteAgreement: (id) =>
    set((s) => ({ agreements: s.agreements.filter((a) => a.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // REQUERIMIENTOS
  // ----------------------------------------------------------

  addRequirement: (data) =>
    set((s) => ({
      requirements: [
        ...s.requirements,
        {
          id: uid(),
          requirementId: `REQ-${String(s.requirements.length + 1).padStart(3, "0")}`,
          entity: "",
          body: "Nuevo requerimiento",
          responsible: "",
          priority: "medium",
          status: "open",
          ...data,
        },
      ],
      isDirty: true,
    })),

  updateRequirement: (id, data) =>
    set((s) => ({
      requirements: s.requirements.map((r) => (r.id === id ? { ...r, ...data } : r)),
      isDirty: true,
    })),

  deleteRequirement: (id) =>
    set((s) => ({ requirements: s.requirements.filter((r) => r.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // TAGS IA (solo eliminar)
  // ----------------------------------------------------------

  deleteAiTag: (id) => set((s) => ({ aiTags: s.aiTags.filter((t) => t.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // TAGS USUARIO (agregar / eliminar)
  // ----------------------------------------------------------

  addUserTag: (name) => {
    const trimmed = (name ?? "").toString().trim();
    if (!trimmed) return;
    set((s) => ({
      userTags: [...s.userTags, { id: uid(), name: trimmed, origin: "user" }],
      isDirty: true,
    }));
  },

  deleteUserTag: (id) => set((s) => ({ userTags: s.userTags.filter((t) => t.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // PRÓXIMAS REUNIONES
  // ----------------------------------------------------------

  addUpcomingMeeting: (data) =>
    set((s) => ({
      upcomingMeetings: [
        ...s.upcomingMeetings,
        {
          id: uid(),
          meetingId: `MEET-${String(s.upcomingMeetings.length + 1).padStart(3, "0")}`,
          scheduledDate: "Por definir",
          agenda: "",
          attendees: [],
          ...data,
        },
      ],
      isDirty: true,
    })),

  updateUpcomingMeeting: (id, data) =>
    set((s) => ({
      upcomingMeetings: s.upcomingMeetings.map((m) => (m.id === id ? { ...m, ...data } : m)),
      isDirty: true,
    })),

  deleteUpcomingMeeting: (id) =>
    set((s) => ({ upcomingMeetings: s.upcomingMeetings.filter((m) => m.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // FIND / REPLACE
  // ----------------------------------------------------------

  setFindQuery: (q) => set({ findQuery: q }),
  setReplaceQuery: (q) => set({ replaceQuery: q }),

  countMatches: () => {
    const { findQuery, meetingInfo, meetingTimes, scopeSections, agreements, requirements, userTags, upcomingMeetings } = get();
    if (!findQuery) return 0;

    const re = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    const corpus = [
      ...Object.values(meetingInfo),
      ...Object.values(meetingTimes),
      ...scopeSections.flatMap((s) => [
        s.summary,
        ...(s.topicsList ?? []).map((t) => t.text),
        ...(s.details ?? []).flatMap((d) => [d.label, d.description]),
      ]),
      ...agreements.flatMap((a) => [a.subject, a.body, a.responsible, a.dueDate, a.status]),
      ...requirements.flatMap((r) => [r.entity, r.body, r.responsible, r.priority, r.status]),
      ...userTags.map((t) => t.name),
      ...upcomingMeetings.flatMap((m) => [m.scheduledDate, m.agenda]),
    ].join("\n");

    return (corpus.match(re) ?? []).length;
  },

  applyReplace: (replaceAll = true) => {
    const { findQuery, replaceQuery } = get();
    if (!findQuery) return;

    const flags = replaceAll ? "gi" : "i";
    const re = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
    const rep = (str) => (str ?? "").replace(re, replaceQuery);

    set((s) => ({
      meetingInfo: {
        client: rep(s.meetingInfo.client),
        subject: rep(s.meetingInfo.subject),
        meetingDate: rep(s.meetingInfo.meetingDate),
        location: rep(s.meetingInfo.location),
        preparedBy: rep(s.meetingInfo.preparedBy),
      },
      meetingTimes: {
        scheduledStart: rep(s.meetingTimes.scheduledStart),
        actualStart: rep(s.meetingTimes.actualStart),
        scheduledEnd: rep(s.meetingTimes.scheduledEnd),
        actualEnd: rep(s.meetingTimes.actualEnd),
      },
      scopeSections: s.scopeSections.map((sec) => ({
        ...sec,
        summary: rep(sec.summary),
        topicsList: (sec.topicsList ?? []).map((t) => ({ ...t, text: rep(t.text) })),
        details: (sec.details ?? []).map((d) => ({ ...d, label: rep(d.label), description: rep(d.description) })),
      })),
      agreements: s.agreements.map((a) => ({
        ...a,
        subject: rep(a.subject),
        body: rep(a.body),
        responsible: rep(a.responsible),
        status: rep(a.status),
      })),
      requirements: s.requirements.map((r) => ({
        ...r,
        entity: rep(r.entity),
        body: rep(r.body),
        responsible: rep(r.responsible),
      })),
      userTags: s.userTags.map((t) => ({ ...t, name: rep(t.name) })),
      upcomingMeetings: s.upcomingMeetings.map((m) => ({
        ...m,
        scheduledDate: rep(m.scheduledDate),
        agenda: rep(m.agenda),
      })),
      isDirty: true,
    }));
  },

  // ----------------------------------------------------------
  // EXPORT PAYLOAD
  // ----------------------------------------------------------

  getExportPayload: () => {
    const s = get();
    return {
      meetingInfo: s.meetingInfo,
      meetingTimes: s.meetingTimes,
      participants: s.participants,
      scopeSections: s.scopeSections,
      agreements: s.agreements,
      requirements: s.requirements,
      aiTags: s.aiTags,
      userTags: s.userTags,
      upcomingMeetings: s.upcomingMeetings,
      metadataLocked: s.metadataLocked,
      additionalNote: s.additionalNote,
      timeline: s.timeline,
      pdfFormat: s.pdfFormat,
    };
  },

  // ----------------------------------------------------------
  // TIMELINE
  // ----------------------------------------------------------

  addTimelineEntry: (entry) =>
    set((s) => {
      const nextVersion = `v${s.timeline.length + 1}.0`;
      return {
        timeline: [
          ...s.timeline,
          {
            id: uid(),
            version: nextVersion,
            publishedAt: new Date().toISOString(),
            publishedBy: entry.publishedBy ?? s.meetingInfo.preparedBy ?? "Sistema",
            observation: entry.observation ?? "",
            changesSummary: entry.changesSummary ?? "",
          },
        ],
      };
    }),

  // ----------------------------------------------------------
  // FORMATO PDF
  // ----------------------------------------------------------

  togglePdfSheet: (sheet) =>
    set((s) => ({
      pdfFormat: {
        ...s.pdfFormat,
        [sheet]: { ...s.pdfFormat[sheet], enabled: !s.pdfFormat[sheet].enabled },
      },
      isDirty: true,
    })),

  updateCoverPage: (field, value) =>
    set((s) => ({
      pdfFormat: {
        ...s.pdfFormat,
        coverPage: { ...s.pdfFormat.coverPage, [field]: value },
      },
      isDirty: true,
    })),

  addSignatory: (data) =>
    set((s) => ({
      pdfFormat: {
        ...s.pdfFormat,
        signaturePage: {
          ...s.pdfFormat.signaturePage,
          signatories: [...s.pdfFormat.signaturePage.signatories, { id: uid(), fullName: "", role: "", area: "", ...data }],
        },
      },
      isDirty: true,
    })),

  updateSignatory: (id, data) =>
    set((s) => ({
      pdfFormat: {
        ...s.pdfFormat,
        signaturePage: {
          ...s.pdfFormat.signaturePage,
          signatories: s.pdfFormat.signaturePage.signatories.map((sig) => (sig.id === id ? { ...sig, ...data } : sig)),
        },
      },
      isDirty: true,
    })),

  deleteSignatory: (id) =>
    set((s) => ({
      pdfFormat: {
        ...s.pdfFormat,
        signaturePage: {
          ...s.pdfFormat.signaturePage,
          signatories: s.pdfFormat.signaturePage.signatories.filter((sig) => sig.id !== id),
        },
      },
      isDirty: true,
    })),

  // ----------------------------------------------------------
  // SELECTORES DERIVADOS
  // ----------------------------------------------------------

  getParticipationSummary: () => {
    const { participants } = get();
    return {
      invited: participants.filter((p) => p.type === "invited").length,
      attendees: participants.filter((p) => p.type === "attendee").length,
      copy: participants.filter((p) => p.type === "copy").length,
      total: participants.length,
    };
  },
}));

export default useMinuteEditorStore;