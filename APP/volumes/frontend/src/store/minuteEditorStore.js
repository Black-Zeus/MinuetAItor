/**
 * store/minuteEditorStore.js
 *
 * Store Zustand del editor de minutas.
 *
 * FORMATOS DE CONTENIDO
 * ─────────────────────
 * El backend puede entregar el contenido en dos formatos distintos según el estado:
 *
 *   content_type = "ai_output"
 *     Formato original de la IA (schema_output_v1.json).
 *     Claves: generalInfo, participants{invited/attendees/copyRecipients},
 *             scope.sections, agreements.items, requirements.items, etc.
 *     Mapper: mapIAResponseToEditorState() → transforma al estado interno del store.
 *     Cuándo: ready-for-edit, o pending antes del primer autosave.
 *
 *   content_type = "draft" | "snapshot"
 *     Formato editor (draft_current.json o schema_output_vN.json post-edición).
 *     Claves idénticas al estado interno del store: meetingInfo, participants[],
 *     scopeSections[], agreements[], requirements[], etc.
 *     Mapper: mapDraftToEditorState() → asignación directa con fallbacks defensivos.
 *     Cuándo: pending (post-primer autosave), preview, completed.
 *
 * FLUJO DE DATOS
 * ──────────────
 *   GET /minutes/{id} → { content, contentType }
 *     → MinuteEditor.jsx decide qué loader usar
 *     → loadFromIAResponse(content)  si contentType === "ai_output"
 *     → loadFromDraft(content)       si contentType === "draft" | "snapshot"
 *
 *   Editor edita → store (isDirty = true)
 *     → autosave: PUT /minutes/{id}/save { content: getExportPayload() }
 *     → persiste draft_current.json en formato editor
 *
 *   Transición pending → preview:
 *     → backend lee draft_current.json y lo snapshot como schema_output_vN.json
 *     → encola job PDF con watermark="BORRADOR"
 *
 *   Transición preview → completed:
 *     → backend encola job PDF sin watermark (versión final)
 */

import { create } from "zustand";

// ============================================================
// HELPERS
// ============================================================

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// ============================================================
// DIFF / SNAPSHOT UTILITIES
// ============================================================

/**
 * Construye un objeto comparable aplanado para diff.
 */
const buildComparableState = (s) => ({
  // Info general
  client:      s.meetingInfo?.client      ?? "",
  subject:     s.meetingInfo?.subject     ?? "",
  meetingDate: s.meetingInfo?.meetingDate ?? "",
  location:    s.meetingInfo?.location    ?? "",
  preparedBy:  s.meetingInfo?.preparedBy  ?? "",

  // Horarios
  scheduledStart: s.meetingTimes?.scheduledStart ?? "",
  actualStart:    s.meetingTimes?.actualStart    ?? "",
  scheduledEnd:   s.meetingTimes?.scheduledEnd   ?? "",
  actualEnd:      s.meetingTimes?.actualEnd      ?? "",

  // Participantes
  participants:    (s.participants ?? []).map((p) => `${p.fullName}|${p.type}|${p.email ?? ""}|${p.participantId ?? ""}`),
  agreements:      s.agreements ?? [],
  requirements:    s.requirements ?? [],
  userTags:        (s.userTags ?? []).map((t) => t.name),
  upcomingMeetings: s.upcomingMeetings ?? [],

  // Alcance
  scopeSections: (s.scopeSections ?? []).map((sec) => ({
    id:        sec.id,
    title:     sec.title,
    summary:   sec.summary,
    topicsList: (sec.topicsList ?? []).map((t) => t.text),
    details:    sec.details ?? [],
  })),

  // PDF format
  pdfFormat: s.pdfFormat ?? {},
});

/**
 * Genera lista de cambios entre dos estados comparables.
 */
const diffComparable = (base, curr) => {
  const changes = [];

  const push = (section, field, before, after) => {
    const b = String(before ?? "").trim();
    const a = String(after  ?? "").trim();
    if (b !== a) changes.push({ section, field, before: b, after: a });
  };

  const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

  // Info general y horarios
  const simpleFields = [
    ["Información", "client"],
    ["Información", "subject"],
    ["Información", "meetingDate"],
    ["Información", "location"],
    ["Información", "preparedBy"],
    ["Horarios", "scheduledStart"],
    ["Horarios", "actualStart"],
    ["Horarios", "scheduledEnd"],
    ["Horarios", "actualEnd"],
  ];
  for (const [sec, f] of simpleFields) push(sec, f, base[f], curr[f]);

  // Participantes
  push("Participantes", "lista",
    base.participants.join(" | "),
    curr.participants.join(" | "),
  );

  // Alcance
  const bSec = new Map((base.scopeSections ?? []).map((x) => [x.id, x]));
  const cSec = new Map((curr.scopeSections ?? []).map((x) => [x.id, x]));
  for (const [id, bs] of bSec.entries()) {
    const cs = cSec.get(id);
    if (!cs) { changes.push({ section: "Alcance", field: "Sección eliminada", before: bs.title, after: "" }); continue; }
    push(`Alcance > ${bs.title || id}`, "summary", bs.summary, cs.summary);
    push(`Alcance > ${bs.title || id}`, "topicsList",
      (bs.topicsList ?? []).join(" | "),
      (cs.topicsList ?? []).join(" | "),
    );
    push(`Alcance > ${bs.title || id}`, "details",
      (bs.details ?? []).map((d) => `${d.label}: ${d.description}`).join(" | "),
      (cs.details ?? []).map((d) => `${d.label}: ${d.description}`).join(" | "),
    );
  }

  // Acuerdos
  const bA = new Map((base.agreements ?? []).map((x) => [x.agreementId, x]));
  const cA = new Map((curr.agreements ?? []).map((x) => [x.agreementId, x]));
  for (const id of bA.keys()) if (!cA.has(id)) changes.push({ section: "Acuerdos", field: "Eliminado", before: id, after: "" });
  for (const id of cA.keys()) if (!bA.has(id)) changes.push({ section: "Acuerdos", field: "Agregado",  before: "", after: id });
  for (const [id, ba] of bA.entries()) {
    const ca = cA.get(id);
    if (!ca) continue;
    push(`Acuerdos > ${id}`, "subject",     ba.subject,     ca.subject);
    push(`Acuerdos > ${id}`, "body",        ba.body,        ca.body);
    push(`Acuerdos > ${id}`, "responsible", ba.responsible, ca.responsible);
    push(`Acuerdos > ${id}`, "dueDate",     ba.dueDate,     ca.dueDate);
    push(`Acuerdos > ${id}`, "status",      ba.status,      ca.status);
  }

  // Requerimientos
  const bR = new Map((base.requirements ?? []).map((x) => [x.requirementId, x]));
  const cR = new Map((curr.requirements ?? []).map((x) => [x.requirementId, x]));
  for (const id of bR.keys()) if (!cR.has(id)) changes.push({ section: "Requerimientos", field: "Eliminado", before: id, after: "" });
  for (const id of cR.keys()) if (!bR.has(id)) changes.push({ section: "Requerimientos", field: "Agregado",  before: "", after: id });
  for (const [id, br] of bR.entries()) {
    const cr = cR.get(id);
    if (!cr) continue;
    push(`Requerimientos > ${id}`, "entity",      br.entity,      cr.entity);
    push(`Requerimientos > ${id}`, "body",        br.body,        cr.body);
    push(`Requerimientos > ${id}`, "responsible", br.responsible, cr.responsible);
    push(`Requerimientos > ${id}`, "priority",    br.priority,    cr.priority);
    push(`Requerimientos > ${id}`, "status",      br.status,      cr.status);
  }

  // Tags usuario
  push("Tags de usuario", "lista",
    (base.userTags ?? []).join(" | "),
    (curr.userTags ?? []).join(" | "),
  );

  // Próximas reuniones
  const bU = new Map((base.upcomingMeetings ?? []).map((x) => [x.meetingId, x]));
  const cU = new Map((curr.upcomingMeetings ?? []).map((x) => [x.meetingId, x]));
  for (const id of bU.keys()) if (!cU.has(id)) changes.push({ section: "Próximas reuniones", field: "Eliminado", before: id, after: "" });
  for (const id of cU.keys()) if (!bU.has(id)) changes.push({ section: "Próximas reuniones", field: "Agregado",  before: "", after: id });
  for (const [id, bu] of bU.entries()) {
    const cu = cU.get(id);
    if (!cu) continue;
    push(`Próximas reuniones > ${id}`, "scheduledDate", bu.scheduledDate, cu.scheduledDate);
    push(`Próximas reuniones > ${id}`, "agenda",        bu.agenda,        cu.agenda);
  }

  // PDF format
  if (base.pdfFormat && curr.pdfFormat) {
    const sheets = ["coverPage", "summarySheet", "versionControl", "signaturePage"];
    for (const sh of sheets) {
      push("Formato PDF", `${sh}.enabled`,
        base.pdfFormat?.[sh]?.enabled ? "true" : "false",
        curr.pdfFormat?.[sh]?.enabled ? "true" : "false",
      );
    }
    for (const f of ["projectName", "minuteTitle", "preparedBy", "footerNote"]) {
      push("Formato PDF > Portada", f,
        safeStr(base.pdfFormat?.coverPage?.[f]),
        safeStr(curr.pdfFormat?.coverPage?.[f]),
      );
    }
  }

  return changes;
};

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findMatchIndexes = (text, query) => {
  if (!query) return [];
  const source = String(text ?? "");
  if (!source) return [];
  const re = new RegExp(escapeRegExp(query), "gi");
  const matches = [];
  let match;
  while ((match = re.exec(source)) !== null) {
    matches.push({ start: match.index, length: match[0].length });
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return matches;
};

const buildSearchPreview = (text, start, length) => {
  const source = String(text ?? "");
  if (!source) return "—";
  const from = Math.max(0, start - 28);
  const to = Math.min(source.length, start + length + 28);
  const prefix = from > 0 ? "..." : "";
  const suffix = to < source.length ? "..." : "";
  return `${prefix}${source.slice(from, to)}${suffix}`;
};

const buildSearchResults = (state) => {
  const query = String(state?.findQuery ?? "").trim();
  if (!query) return [];

  const results = [];
  let ordinal = 0;

  const pushMatches = ({ tab, targetId, label, text, fieldKey }) => {
    const source = String(text ?? "");
    const matches = findMatchIndexes(source, query);
    matches.forEach((match, indexInField) => {
      ordinal += 1;
      results.push({
        id: `${targetId}:${fieldKey}:${ordinal}`,
        ordinal,
        tab,
        targetId,
        label,
        fieldKey,
        text: source,
        start: match.start,
        length: match.length,
        indexInField,
        preview: buildSearchPreview(source, match.start, match.length),
      });
    });
  };

  pushMatches({ tab: "info", targetId: "meeting-card", label: "Cliente", text: state.meetingInfo?.client, fieldKey: "meetingInfo.client" });
  pushMatches({ tab: "info", targetId: "meeting-card", label: "Asunto", text: state.meetingInfo?.subject, fieldKey: "meetingInfo.subject" });
  pushMatches({ tab: "info", targetId: "meeting-card", label: "Ubicación", text: state.meetingInfo?.location, fieldKey: "meetingInfo.location" });
  pushMatches({ tab: "info", targetId: "meeting-card", label: "Preparado por", text: state.meetingInfo?.preparedBy, fieldKey: "meetingInfo.preparedBy" });
  pushMatches({ tab: "info", targetId: "meeting-card", label: "Fecha", text: state.meetingInfo?.meetingDate, fieldKey: "meetingInfo.meetingDate" });

  pushMatches({ tab: "info", targetId: "times-card", label: "Inicio programado", text: state.meetingTimes?.scheduledStart, fieldKey: "meetingTimes.scheduledStart" });
  pushMatches({ tab: "info", targetId: "times-card", label: "Término programado", text: state.meetingTimes?.scheduledEnd, fieldKey: "meetingTimes.scheduledEnd" });
  pushMatches({ tab: "info", targetId: "times-card", label: "Inicio real", text: state.meetingTimes?.actualStart, fieldKey: "meetingTimes.actualStart" });
  pushMatches({ tab: "info", targetId: "times-card", label: "Término real", text: state.meetingTimes?.actualEnd, fieldKey: "meetingTimes.actualEnd" });

  (state.scopeSections ?? []).forEach((section) => {
    const targetId = `scope-${section.id}`;
    pushMatches({ tab: "scope", targetId, label: `${section.title} · Resumen`, text: section.summary, fieldKey: `scope.${section.id}.summary` });
    (section.topicsList ?? []).forEach((topic) => {
      pushMatches({ tab: "scope", targetId, label: `${section.title} · Tema`, text: topic.text, fieldKey: `scope.${section.id}.topic.${topic.id}` });
    });
    (section.details ?? []).forEach((detail) => {
      pushMatches({ tab: "scope", targetId, label: `${section.title} · Detalle`, text: detail.label, fieldKey: `scope.${section.id}.detail.${detail.id}.label` });
      pushMatches({ tab: "scope", targetId, label: `${section.title} · Descripción`, text: detail.description, fieldKey: `scope.${section.id}.detail.${detail.id}.description` });
    });
  });

  (state.agreements ?? []).forEach((agreement) => {
    const targetId = `agreement-${agreement.id}`;
    pushMatches({ tab: "agreements", targetId, label: `${agreement.agreementId || "Acuerdo"} · Asunto`, text: agreement.subject, fieldKey: `agreements.${agreement.id}.subject` });
    pushMatches({ tab: "agreements", targetId, label: `${agreement.agreementId || "Acuerdo"} · Detalle`, text: agreement.body, fieldKey: `agreements.${agreement.id}.body` });
    pushMatches({ tab: "agreements", targetId, label: `${agreement.agreementId || "Acuerdo"} · Responsable`, text: agreement.responsible, fieldKey: `agreements.${agreement.id}.responsible` });
  });

  (state.requirements ?? []).forEach((requirement) => {
    const targetId = `requirement-${requirement.id}`;
    pushMatches({ tab: "requirements", targetId, label: `${requirement.requirementId || "Requerimiento"} · Requerimiento`, text: requirement.body, fieldKey: `requirements.${requirement.id}.body` });
    pushMatches({ tab: "requirements", targetId, label: `${requirement.requirementId || "Requerimiento"} · Entidad`, text: requirement.entity, fieldKey: `requirements.${requirement.id}.entity` });
    pushMatches({ tab: "requirements", targetId, label: `${requirement.requirementId || "Requerimiento"} · Responsable`, text: requirement.responsible, fieldKey: `requirements.${requirement.id}.responsible` });
  });

  (state.userTags ?? []).forEach((tag) => {
    pushMatches({ tab: "tags", targetId: `user-tag-${tag.id}`, label: "Tag de usuario", text: tag.name, fieldKey: `userTags.${tag.id}.name` });
  });

  (state.upcomingMeetings ?? []).forEach((meeting) => {
    const targetId = `next-meeting-${meeting.id}`;
    pushMatches({ tab: "next", targetId, label: `${meeting.meetingId || "Próxima reunión"} · Fecha`, text: meeting.scheduledDate, fieldKey: `upcomingMeetings.${meeting.id}.scheduledDate` });
    pushMatches({ tab: "next", targetId, label: `${meeting.meetingId || "Próxima reunión"} · Agenda`, text: meeting.agenda, fieldKey: `upcomingMeetings.${meeting.id}.agenda` });
  });

  return results;
};


// ============================================================
// MAPPER: IA → STATE
// Úsalo cuando content_type === "ai_output"
// ============================================================

/**
 * Transforma el JSON original de la IA al estado interno del store.
 * @param {Object} iaResponse - JSON con claves: generalInfo, participants,
 *   scope, agreements, requirements, aiSuggestedTags, inputInfo,
 *   upcomingMeetings, metadata
 */
export const mapIAResponseToEditorState = (iaResponse) => {
  const {
    generalInfo, participants, scope, agreements, requirements,
    aiSuggestedTags, inputInfo, upcomingMeetings, metadata,
  } = iaResponse ?? {};

  const inputMeetingInfo = inputInfo?.meetingInfo ?? {};
  const fallbackPreparedBy =
    generalInfo?.preparedBy ??
    inputInfo?.preparedBy ??
    "";
  const fallbackLocation =
    generalInfo?.location ??
    inputMeetingInfo?.location ??
    "";

  // --- Información de la reunión ---
  const meetingInfo = {
    client:      generalInfo?.client ?? inputInfo?.projectInfo?.client ?? "",
    subject:     generalInfo?.subject ?? inputMeetingInfo?.title ?? "",
    meetingDate: generalInfo?.meetingDate ?? inputMeetingInfo?.scheduledDate ?? "",
    location:    fallbackLocation,
    preparedBy:  fallbackPreparedBy,
  };

  // --- Horarios ---
  const meetingTimes = {
    scheduledStart: generalInfo?.scheduledStartTime ?? inputMeetingInfo?.scheduledStartTime ?? "",
    actualStart:    generalInfo?.actualStartTime    ?? inputMeetingInfo?.actualStartTime    ?? "",
    scheduledEnd:   generalInfo?.scheduledEndTime   ?? inputMeetingInfo?.scheduledEndTime   ?? "",
    actualEnd:      generalInfo?.actualEndTime      ?? inputMeetingInfo?.actualEndTime      ?? "",
  };

  // --- Participantes: unificar las 3 listas con tipo + id ---
  const mapParticipantList = (list, type) =>
    (list ?? []).map((p) => ({
      id:       uid(),
      fullName: p.fullName,
      initials: p.initials ?? (p.fullName?.slice(0, 2).toUpperCase() ?? ""),
      type,
      role:     "",
      email:    "",
      participantId: null,
      participantEmailId: null,
      participantEmails: [],
    }));

  const invitedNames = new Set((participants?.invited ?? []).map((p) => p.fullName));
  const participantList = [
    ...mapParticipantList(participants?.invited ?? [], "invited"),
    ...(participants?.attendees ?? [])
      .filter((p) => !invitedNames.has(p.fullName))
      .map((p) => ({
        id:       uid(),
        fullName: p.fullName,
        initials: p.initials ?? "",
        type:     "attendee",
        role:     "",
        email:    "",
        participantId: null,
        participantEmailId: null,
        participantEmails: [],
      })),
    ...mapParticipantList(participants?.copyRecipients ?? [], "copy"),
  ];

  // --- Alcance ---
  const scopeSections = (scope?.sections ?? []).map((s) => ({
    id:        s.sectionId,
    title:     s.sectionTitle,
    type:      s.sectionType,
    summary:   s.content?.summary ?? "",
    topicsList: (s.content?.topicsList ?? []).map((t) => ({ id: uid(), text: t })),
    details:    (s.content?.details ?? []).map((d) => ({
      id:          uid(),
      label:       d.label,
      description: d.description,
    })),
  }));

  // --- Acuerdos ---
  const agreementList = (agreements?.items ?? []).map((a) => ({
    id:          uid(),
    agreementId: a.agreementId,
    subject:     a.subject,
    body:        a.body,
    responsible: a.responsible,
    dueDate:     a.dueDate ?? "",
    status:      a.status  ?? "pending",
  }));

  // --- Requerimientos ---
  const requirementList = (requirements?.items ?? []).map((r) => ({
    id:            uid(),
    requirementId: r.requirementId,
    entity:        r.entity,
    body:          r.body,
    responsible:   r.responsible,
    priority:      r.priority ?? "medium",
    status:        r.status   ?? "open",
  }));

  // --- Tags IA (solo eliminar) ---
  const aiTags = (aiSuggestedTags ?? []).map((t) => ({
    id:          uid(),
    name:        t.name,
    description: t.description,
    origin:      "ai",
  }));

  // --- Tags usuario ---
  // userProvidedTags puede ser array de strings O de objetos {code, name, description}
  const userTags = (inputInfo?.userProvidedTags ?? []).map((t) => ({
    id:     uid(),
    name:   typeof t === "object" ? (t?.name ?? t?.code ?? "") : String(t ?? ""),
    origin: "user",
  })).filter((t) => t.name.trim() !== "");

  // --- Próximas reuniones ---
  const upcomingList = (upcomingMeetings?.items ?? []).map((m) => ({
    id:            uid(),
    meetingId:     m.meetingId,
    scheduledDate: m.scheduledDate,
    agenda:        m.agenda,
    attendees:     m.attendees ?? [],
  }));

  // --- Metadata (bloqueada) ---
  const metadataLocked = {
    transactionId: metadata?.transactionId ?? "",
    generatedAt:   metadata?.generatedAt   ?? "",
    generatedBy:   metadata?.generatedBy   ?? "",
    version:       metadata?.version       ?? "",
    profileId:     inputInfo?.profileInfo?.profileId   ?? "",
    profileName:   inputInfo?.profileInfo?.profileName ?? "",
    attachments:   inputInfo?.attachments ?? [],
  };

  const additionalNote = inputInfo?.additionalNotes ?? "";

  // --- Timeline v1.0 inicial ---
  const timeline = [
    {
      id:             uid(),
      version:        "v1.0",
      publishedAt:    new Date().toISOString(),
      publishedBy:    fallbackPreparedBy || "Sistema",
      observation:    "Publicación inicial generada desde IA.",
      changesSummary: "Versión original sin modificaciones.",
    },
  ];

  // --- Defaults PDF format ---
  const pdfFormat = {
    template: "opc_01",
    coverPage: {
      enabled:     false,
      projectName: inputInfo?.projectInfo?.project ?? "",
      minuteTitle: generalInfo?.subject ?? inputMeetingInfo?.title ?? "",
      preparedBy:  fallbackPreparedBy,
      footerNote:  "",
    },
    summarySheet:   { enabled: false },
    versionControl: { enabled: false },
    signaturePage:  { enabled: false, signatories: [] },
  };

  return {
    meetingInfo,
    meetingTimes,
    participants:     participantList,
    scopeSections,
    agreements:       agreementList,
    requirements:     requirementList,
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
// MAPPER: DRAFT / SNAPSHOT → STATE
// Úsalo cuando content_type === "draft" | "snapshot"
// El draft ya usa las claves del store (formato editor).
// Solo asigna con fallbacks defensivos.
// ============================================================

/**
 * Carga un draft guardado (getExportPayload) de vuelta al store.
 * @param {Object} draft - Payload en formato editor
 */
export const mapDraftToEditorState = (draft) => {
  if (!draft || typeof draft !== "object") {
    console.warn("[minuteEditorStore] mapDraftToEditorState: draft inválido, usando estado vacío");
    return null;
  }

  // Asegurar que los ids de los items sean únicos en esta sesión.
  // Los ids del draft pueden ser strings de sesiones anteriores, lo reasignamos
  // para evitar colisiones en el reconciler de React.
  const reId = (list) => (list ?? []).map((item) => ({ ...item, id: uid() }));

  const meetingInfo = {
    client:      draft.meetingInfo?.client      ?? "",
    subject:     draft.meetingInfo?.subject     ?? "",
    meetingDate: draft.meetingInfo?.meetingDate ?? "",
    location:    draft.meetingInfo?.location    ?? "",
    preparedBy:  draft.meetingInfo?.preparedBy  ?? "",
  };

  const meetingTimes = {
    scheduledStart: draft.meetingTimes?.scheduledStart ?? "",
    actualStart:    draft.meetingTimes?.actualStart    ?? "",
    scheduledEnd:   draft.meetingTimes?.scheduledEnd   ?? "",
    actualEnd:      draft.meetingTimes?.actualEnd      ?? "",
  };

  const participants = reId(draft.participants).map((item) => ({
    ...item,
    participantId: item.participantId ?? null,
    participantEmailId: item.participantEmailId ?? null,
    participantEmails: Array.isArray(item.participantEmails) ? item.participantEmails : [],
    organization: item.organization ?? "",
    title: item.title ?? "",
  }));

  const scopeSections = (draft.scopeSections ?? []).map((sec) => ({
    ...sec,
    id:        sec.id    ?? uid(),
    topicsList: reId(sec.topicsList),
    details:    reId(sec.details),
  }));

  const agreements    = reId(draft.agreements);
  const requirements  = reId(draft.requirements);
  const aiTags        = reId(draft.aiTags);
  const userTags      = reId(draft.userTags);
  const upcomingMeetings = reId(draft.upcomingMeetings);

  const metadataLocked = draft.metadataLocked ?? {};
  const additionalNote = draft.additionalNote ?? "";

  const timeline = (draft.timeline ?? []).map((entry) => ({
    ...entry,
    id: entry.id ?? uid(),
  }));

  const pdfFormat = {
    template: draft.pdfFormat?.template ?? "opc_01",
    coverPage: {
      enabled:     draft.pdfFormat?.coverPage?.enabled     ?? false,
      projectName: draft.pdfFormat?.coverPage?.projectName ?? "",
      minuteTitle: draft.pdfFormat?.coverPage?.minuteTitle ?? "",
      preparedBy:  draft.pdfFormat?.coverPage?.preparedBy  ?? "",
      footerNote:  draft.pdfFormat?.coverPage?.footerNote  ?? "",
    },
    summarySheet:   { enabled: draft.pdfFormat?.summarySheet?.enabled   ?? false },
    versionControl: { enabled: draft.pdfFormat?.versionControl?.enabled ?? false },
    signaturePage: {
      enabled:     draft.pdfFormat?.signaturePage?.enabled ?? false,
      signatories: reId(draft.pdfFormat?.signaturePage?.signatories),
    },
  };

  return {
    meetingInfo,
    meetingTimes,
    participants,
    scopeSections,
    agreements,
    requirements,
    aiTags,
    userTags,
    upcomingMeetings,
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
    client:      "",
    subject:     "",
    meetingDate: "",
    location:    "",
    preparedBy:  "",
  },

  meetingTimes: {
    scheduledStart: "",
    actualStart:    "",
    scheduledEnd:   "",
    actualEnd:      "",
  },

  participants:     [],
  scopeSections:    [],
  agreements:       [],
  requirements:     [],
  aiTags:           [],
  userTags:         [],
  upcomingMeetings: [],

  metadataLocked: {},
  additionalNote: "",

  activeTab:    "info",
  findQuery:    "",
  replaceQuery: "",
  searchResults: [],
  activeSearchIndex: -1,
  activeSearchTargetId: null,
  pendingSearchResult: null,

  isDirty:        false,
  lastPublishedAt: null,

  timeline: [],

  pdfFormat: {
    template:       "opc_01",
    coverPage:      { enabled: false, projectName: "", minuteTitle: "", preparedBy: "", footerNote: "" },
    summarySheet:   { enabled: false },
    versionControl: { enabled: false },
    signaturePage:  { enabled: false, signatories: [] },
  },

  // Snapshot baseline para diff y rollback
  baselineSnapshot: null,
  snapshotAt:       null,

  // Fuerza remount del editor si el contenedor usa key={editorRevisionKey}
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

  /**
   * Carga desde JSON de la IA (content_type === "ai_output").
   * Aplica mapIAResponseToEditorState y establece el baseline de snapshot.
   */
  loadFromIAResponse: (iaResponse) => {
    const mapped   = mapIAResponseToEditorState(iaResponse);
    const baseline = deepClone(mapped);

    set({
      ...mapped,
      isLoaded:         true,
      activeTab:        "info",
      isDirty:          false,
      lastPublishedAt:  null,
      baselineSnapshot: baseline,
      snapshotAt:       new Date().toISOString(),
    });
  },

  /**
   * Carga desde draft guardado o snapshot (content_type === "draft" | "snapshot").
   * Aplica mapDraftToEditorState — asignación directa con fallbacks defensivos.
   */
  loadFromDraft: (draft) => {
    const mapped = mapDraftToEditorState(draft);
    if (!mapped) {
      // draft inválido: cargar estado vacío marcado con error
      set({ ...EMPTY_STATE, isLoaded: true });
      return;
    }
    const baseline = deepClone(mapped);

    set({
      ...mapped,
      isLoaded:         true,
      activeTab:        "info",
      isDirty:          false,
      lastPublishedAt:  null,
      baselineSnapshot: baseline,
      snapshotAt:       new Date().toISOString(),
    });
  },

  reset: () => set({ ...EMPTY_STATE }),

  markDirty:  ()            => set({ isDirty: true }),
  markClean:  (publishedAt) => set({ isDirty: false, lastPublishedAt: publishedAt }),

  // ----------------------------------------------------------
  // SNAPSHOT / ROLLBACK
  // ----------------------------------------------------------

  takeSnapshot: () => {
    const s = get();
    const baseline = deepClone({
      meetingInfo:      s.meetingInfo,
      meetingTimes:     s.meetingTimes,
      participants:     s.participants,
      scopeSections:    s.scopeSections,
      agreements:       s.agreements,
      requirements:     s.requirements,
      aiTags:           s.aiTags,
      userTags:         s.userTags,
      upcomingMeetings: s.upcomingMeetings,
      metadataLocked:   s.metadataLocked,
      additionalNote:   s.additionalNote,
      timeline:         s.timeline,
      pdfFormat:        s.pdfFormat,
    });
    set({ baselineSnapshot: baseline, snapshotAt: new Date().toISOString() });
  },

  getChangesSinceSnapshot: () => {
    const s = get();
    if (!s.baselineSnapshot) return [];
    return diffComparable(
      buildComparableState(s.baselineSnapshot),
      buildComparableState(s),
    );
  },

  rollbackToSnapshot: () => {
    const s = get();
    if (!s.baselineSnapshot) return;
    const b = deepClone(s.baselineSnapshot);
    set((prev) => ({
      meetingInfo:      b.meetingInfo,
      meetingTimes:     b.meetingTimes,
      participants:     b.participants,
      scopeSections:    b.scopeSections,
      agreements:       b.agreements,
      requirements:     b.requirements,
      aiTags:           b.aiTags,
      userTags:         b.userTags,
      upcomingMeetings: b.upcomingMeetings,
      metadataLocked:   b.metadataLocked,
      additionalNote:   b.additionalNote,
      timeline:         b.timeline,
      pdfFormat:        b.pdfFormat,
      isDirty:          false,
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
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId ? { ...sec, summary } : sec
      ),
      isDirty: true,
    })),

  addSectionTopic: (sectionId) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId
          ? { ...sec, topicsList: [...sec.topicsList, { id: uid(), text: "Nuevo tema" }] }
          : sec
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
        sec.id === sectionId
          ? { ...sec, topicsList: sec.topicsList.filter((t) => t.id !== topicId) }
          : sec
      ),
      isDirty: true,
    })),

  addSectionDetail: (sectionId) =>
    set((s) => ({
      scopeSections: s.scopeSections.map((sec) =>
        sec.id === sectionId
          ? { ...sec, details: [...sec.details, { id: uid(), label: "Nuevo detalle", description: "" }] }
          : sec
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
        sec.id === sectionId
          ? { ...sec, details: sec.details.filter((d) => d.id !== detailId) }
          : sec
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
          id:          uid(),
          agreementId: `AGR-${String(s.agreements.length + 1).padStart(3, "0")}`,
          subject:     "Nuevo acuerdo",
          body:        "",
          responsible: "",
          dueDate:     "",
          status:      "pending",
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
          id:            uid(),
          requirementId: `REQ-${String(s.requirements.length + 1).padStart(3, "0")}`,
          entity:        "",
          body:          "Nuevo requerimiento",
          responsible:   "",
          priority:      "medium",
          status:        "open",
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
  // TAGS
  // ----------------------------------------------------------

  deleteAiTag: (id) =>
    set((s) => ({ aiTags: s.aiTags.filter((t) => t.id !== id), isDirty: true })),

  addUserTag: (name) =>
    set((s) => ({
      userTags: [...s.userTags, { id: uid(), name: name.trim(), origin: "user" }],
      isDirty: true,
    })),

  deleteUserTag: (id) =>
    set((s) => ({ userTags: s.userTags.filter((t) => t.id !== id), isDirty: true })),

  // ----------------------------------------------------------
  // PRÓXIMAS REUNIONES
  // ----------------------------------------------------------

  addUpcomingMeeting: (data) =>
    set((s) => ({
      upcomingMeetings: [
        ...s.upcomingMeetings,
        {
          id:            uid(),
          meetingId:     `MEET-${String(s.upcomingMeetings.length + 1).padStart(3, "0")}`,
          scheduledDate: "",
          agenda:        "",
          attendees:     [],
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
    set((s) => ({
      upcomingMeetings: s.upcomingMeetings.filter((m) => m.id !== id),
      isDirty: true,
    })),

  // ----------------------------------------------------------
  // FIND / REPLACE
  // ----------------------------------------------------------

  setFindQuery: (q) =>
    set((s) => {
      const nextState = { ...s, findQuery: q };
      const searchResults = buildSearchResults(nextState);
      return {
        findQuery: q,
        searchResults,
        activeSearchIndex: searchResults.length > 0 ? 0 : -1,
        activeSearchTargetId: searchResults.length > 0 ? searchResults[0].targetId : null,
        pendingSearchResult: null,
      };
    }),
  setReplaceQuery: (q) => set({ replaceQuery: q }),

  refreshSearchResults: () =>
    set((s) => {
      const searchResults = buildSearchResults(s);
      const nextIndex = searchResults.length === 0
        ? -1
        : Math.min(Math.max(s.activeSearchIndex, 0), searchResults.length - 1);
      return {
        searchResults,
        activeSearchIndex: nextIndex,
        activeSearchTargetId: nextIndex >= 0 ? searchResults[nextIndex]?.targetId ?? null : null,
      };
    }),

  countMatches: () => {
    const { searchResults } = get();
    return searchResults.length;
  },

  goToSearchResult: (index) => {
    const { searchResults } = get();
    if (!searchResults.length) return;

    const normalizedIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
    const result = searchResults[normalizedIndex];

    set({
      activeSearchIndex: normalizedIndex,
      activeSearchTargetId: result.targetId,
      activeTab: result.tab,
      pendingSearchResult: result,
    });
  },

  goToNextSearchResult: () => {
    const { activeSearchIndex, goToSearchResult } = get();
    goToSearchResult(activeSearchIndex + 1);
  },

  goToPreviousSearchResult: () => {
    const { activeSearchIndex, goToSearchResult } = get();
    goToSearchResult(activeSearchIndex - 1);
  },

  clearPendingSearchResult: () => set({ pendingSearchResult: null }),

  applyReplace: (replaceAll = true) => {
    const { findQuery, replaceQuery } = get();
    if (!findQuery) return;
    const flags = replaceAll ? "gi" : "i";
    const re    = new RegExp(escapeRegExp(findQuery), flags);
    const rep   = (str) => (str ?? "").replace(re, replaceQuery);

    set((s) => {
      const nextState = {
        ...s,
        meetingInfo: {
        client:      rep(s.meetingInfo.client),
        subject:     rep(s.meetingInfo.subject),
        meetingDate: rep(s.meetingInfo.meetingDate),
        location:    rep(s.meetingInfo.location),
        preparedBy:  rep(s.meetingInfo.preparedBy),
        },
        meetingTimes: {
        scheduledStart: rep(s.meetingTimes.scheduledStart),
        actualStart:    rep(s.meetingTimes.actualStart),
        scheduledEnd:   rep(s.meetingTimes.scheduledEnd),
        actualEnd:      rep(s.meetingTimes.actualEnd),
        },
        scopeSections: s.scopeSections.map((sec) => ({
        ...sec,
        summary:    rep(sec.summary),
        topicsList: (sec.topicsList ?? []).map((t) => ({ ...t, text: rep(t.text) })),
        details:    (sec.details    ?? []).map((d) => ({ ...d, label: rep(d.label), description: rep(d.description) })),
        })),
        agreements: s.agreements.map((a) => ({
        ...a,
        subject:     rep(a.subject),
        body:        rep(a.body),
        responsible: rep(a.responsible),
        status:      rep(a.status),
        })),
        requirements: s.requirements.map((r) => ({
        ...r,
        entity:      rep(r.entity),
        body:        rep(r.body),
        responsible: rep(r.responsible),
        })),
        userTags:        s.userTags.map((t) => ({ ...t, name: rep(t.name) })),
        upcomingMeetings: s.upcomingMeetings.map((m) => ({
        ...m,
        scheduledDate: rep(m.scheduledDate),
        agenda:        rep(m.agenda),
        })),
        isDirty: true,
      };

      const searchResults = buildSearchResults(nextState);
      return {
        ...nextState,
        searchResults,
        activeSearchIndex: searchResults.length > 0 ? 0 : -1,
        activeSearchTargetId: searchResults.length > 0 ? searchResults[0].targetId : null,
        pendingSearchResult: null,
      };
    });
  },

  // ----------------------------------------------------------
  // EXPORT PAYLOAD
  // Produce el payload en formato editor para PUT /save.
  // Este es el contrato con el backend para draft_current.json.
  // ----------------------------------------------------------

  getExportPayload: () => {
    const s = get();
    const exportParticipants = (s.participants ?? []).map((participant) => ({
      id: participant.id,
      fullName: participant.fullName,
      initials: participant.initials ?? "",
      type: participant.type,
      role: participant.role ?? "",
      email: participant.email ?? "",
      participantEmails: Array.isArray(participant.participantEmails)
        ? participant.participantEmails.map((item) => ({
            email: item.email,
            isPrimary: Boolean(item.isPrimary ?? item.is_primary),
            isActive: item.isActive ?? item.is_active ?? true,
          }))
        : [],
      organization: participant.organization ?? "",
      title: participant.title ?? "",
    }));

    return {
      meetingInfo:      s.meetingInfo,
      meetingTimes:     s.meetingTimes,
      participants:     exportParticipants,
      scopeSections:    s.scopeSections,
      agreements:       s.agreements,
      requirements:     s.requirements,
      aiTags:           s.aiTags,
      userTags:         s.userTags,
      upcomingMeetings: s.upcomingMeetings,
      metadataLocked:   s.metadataLocked,
      additionalNote:   s.additionalNote,
      timeline:         s.timeline,
      pdfFormat:        s.pdfFormat,
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
            id:             uid(),
            version:        nextVersion,
            publishedAt:    new Date().toISOString(),
            publishedBy:    entry.publishedBy    ?? s.meetingInfo.preparedBy ?? "Sistema",
            observation:    entry.observation    ?? "",
            changesSummary: entry.changesSummary ?? "",
          },
        ],
      };
    }),

  // ----------------------------------------------------------
  // FORMATO PDF
  // ----------------------------------------------------------

  setPdfTemplate: (template) =>
    set((s) => ({
      pdfFormat: { ...s.pdfFormat, template },
      isDirty: true,
    })),

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
          signatories: [
            ...s.pdfFormat.signaturePage.signatories,
            { id: uid(), fullName: "", role: "", area: "", ...data },
          ],
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
          signatories: s.pdfFormat.signaturePage.signatories.map((sig) =>
            sig.id === id ? { ...sig, ...data } : sig
          ),
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
      invited:   participants.filter((p) => p.type === "invited").length,
      attendees: participants.filter((p) => p.type === "attendee").length,
      copy:      participants.filter((p) => p.type === "copy").length,
      total:     participants.length,
    };
  },
}));

export default useMinuteEditorStore;
