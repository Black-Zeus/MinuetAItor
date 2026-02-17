/**
 * store/minuteEditorStore.js
 * Store dedicado para el editor de minutas (previsualización previa a PDF).
 * Maneja todo el estado editable: info general, participantes, alcance,
 * acuerdos, requerimientos, tags y próximas reuniones.
 *
 * No persiste en localStorage (datos temporales de sesión de edición).
 */

import { create } from 'zustand';

// ============================================================
// HELPERS
// ============================================================

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

/**
 * Transforma la respuesta cruda de la IA al estado interno del store.
 * Mapea los keys del JSON al esquema descriptivo del editor.
 * @param {Object} iaResponse - Objeto JSON de la IA
 * @returns {Object} Estado inicial del editor
 */
export const mapIAResponseToEditorState = (iaResponse) => {
  const { generalInfo, participants, scope, agreements, requirements, aiSuggestedTags, inputInfo, upcomingMeetings, metadata } = iaResponse;

  // --- Información de la reunión ---
  const meetingInfo = {
    client:     generalInfo?.client     ?? '',
    subject:    generalInfo?.subject    ?? '',
    meetingDate: generalInfo?.meetingDate ?? '',
    location:   generalInfo?.location   ?? '',
    preparedBy: generalInfo?.preparedBy ?? '',
  };

  // --- Horarios ---
  const meetingTimes = {
    scheduledStart: generalInfo?.scheduledStartTime ?? '',
    actualStart:    generalInfo?.actualStartTime    ?? '',
    scheduledEnd:   generalInfo?.scheduledEndTime   ?? '',
    actualEnd:      generalInfo?.actualEndTime      ?? '',
  };

  // --- Participantes: unificar las 3 listas con un tipo y un id ---
  const mapParticipantList = (list, type) =>
    (list ?? []).map(p => ({
      id:    uid(),
      fullName: p.fullName,
      initials: p.initials ?? p.fullName.slice(0, 2).toUpperCase(),
      type,  // 'invited' | 'attendee' | 'copy'
      role:  '',
      email: '',
    }));

  // Construir lista unificada evitando duplicados entre invited y attendees
  const invitedNames  = new Set((participants?.invited ?? []).map(p => p.fullName));
  const attendeeNames = new Set((participants?.attendees ?? []).map(p => p.fullName));

  const participantList = [
    ...mapParticipantList(participants?.invited ?? [], 'invited'),
    // Solo agregar attendees que no estén ya en invited
    ...(participants?.attendees ?? [])
      .filter(p => !invitedNames.has(p.fullName))
      .map(p => ({ id: uid(), fullName: p.fullName, initials: p.initials ?? '', type: 'attendee', role: '', email: '' })),
    ...mapParticipantList(participants?.copyRecipients ?? [], 'copy'),
  ];

  // --- Alcance: secciones ---
  const scopeSections = (scope?.sections ?? []).map(s => ({
    id:          s.sectionId,
    title:       s.sectionTitle,
    type:        s.sectionType, // 'introduction' | 'topic'
    summary:     s.content?.summary ?? '',
    topicsList:  (s.content?.topicsList ?? []).map(t => ({ id: uid(), text: t })),
    details:     (s.content?.details ?? []).map(d => ({
      id:          uid(),
      label:       d.label,
      description: d.description,
    })),
  }));

  // --- Acuerdos ---
  const agreementList = (agreements?.items ?? []).map(a => ({
    id:          uid(),
    agreementId: a.agreementId,
    subject:     a.subject,
    body:        a.body,
    responsible: a.responsible,
    dueDate:     a.dueDate ?? '',
    status:      a.status ?? 'pending',
  }));

  // --- Requerimientos ---
  const requirementList = (requirements?.items ?? []).map(r => ({
    id:            uid(),
    requirementId: r.requirementId,
    entity:        r.entity,
    body:          r.body,
    responsible:   r.responsible,
    priority:      r.priority ?? 'medium',
    status:        r.status ?? 'open',
  }));

  // --- Tags IA (controlados: solo eliminar) ---
  const aiTags = (iaResponse?.aiSuggestedTags ?? []).map(t => ({
    id:          uid(),
    name:        t.name,
    description: t.description,
    origin:      'ai',
  }));

  // --- Tags usuario (desde inputInfo.userProvidedTags) ---
  const userTags = (inputInfo?.userProvidedTags ?? []).map(t => ({
    id:     uid(),
    name:   t,
    origin: 'user',
  }));

  // --- Próximas reuniones ---
  const upcomingList = (upcomingMeetings?.items ?? []).map(m => ({
    id:            uid(),
    meetingId:     m.meetingId,
    scheduledDate: m.scheduledDate,
    agenda:        m.agenda,
    attendees:     m.attendees ?? [],
  }));

  // --- Metadata (bloqueada, solo lectura) ---
  const metadataLocked = {
    transactionId: metadata?.transactionId ?? '',
    generatedAt:   metadata?.generatedAt   ?? '',
    generatedBy:   metadata?.generatedBy   ?? '',
    version:       metadata?.version       ?? '',
    // Campos de inputInfo para auditoria
    profileId:     inputInfo?.profileInfo?.profileId   ?? '',
    profileName:   inputInfo?.profileInfo?.profileName ?? '',
    attachments:   inputInfo?.attachments ?? [],
  };

  // --- Nota adicional (IA, bloqueada) ---
  const additionalNote = inputInfo?.additionalNotes ?? '';

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
  };
};

// ============================================================
// INITIAL STATE (vacío, se puebla con loadFromIAResponse)
// ============================================================

const EMPTY_STATE = {
  // Control de carga
  isLoaded: false,

  // Información de la reunión (editable)
  meetingInfo: {
    client:      '',
    subject:     '',
    meetingDate: '',
    location:    '',
    preparedBy:  '',
  },

  // Horarios (editable)
  meetingTimes: {
    scheduledStart: '',
    actualStart:    '',
    scheduledEnd:   '',
    actualEnd:      '',
  },

  // Participantes [ { id, fullName, initials, type, role, email } ]
  participants: [],

  // Alcance [ { id, title, type, summary, topicsList, details } ]
  scopeSections: [],

  // Acuerdos [ { id, agreementId, subject, body, responsible, dueDate, status } ]
  agreements: [],

  // Requerimientos [ { id, requirementId, entity, body, responsible, priority, status } ]
  requirements: [],

  // Tags IA [ { id, name, description, origin } ]
  aiTags: [],

  // Tags usuario [ { id, name, origin } ]
  userTags: [],

  // Próximas reuniones [ { id, meetingId, scheduledDate, agenda, attendees } ]
  upcomingMeetings: [],

  // Metadata bloqueada (solo lectura)
  metadataLocked: {},

  // Nota adicional de la IA (bloqueada)
  additionalNote: '',

  // Tab activo
  activeTab: 'info',

  // Find/Replace
  findQuery:   '',
  replaceQuery: '',
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
   * Carga el estado desde la respuesta de la IA.
   * Llamar una sola vez al montar MinuteEditor.
   */
  loadFromIAResponse: (iaResponse) => {
    const mapped = mapIAResponseToEditorState(iaResponse);
    set({ ...mapped, isLoaded: true, activeTab: 'info' });
  },

  /**
   * Reinicia al estado vacío (ej: al desmontar la vista).
   */
  reset: () => set({ ...EMPTY_STATE }),

  // ----------------------------------------------------------
  // NAVEGACIÓN DE TABS
  // ----------------------------------------------------------

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ----------------------------------------------------------
  // INFORMACIÓN DE LA REUNIÓN
  // ----------------------------------------------------------

  updateMeetingInfo: (field, value) =>
    set(s => ({ meetingInfo: { ...s.meetingInfo, [field]: value } })),

  // ----------------------------------------------------------
  // HORARIOS
  // ----------------------------------------------------------

  updateMeetingTimes: (field, value) =>
    set(s => ({ meetingTimes: { ...s.meetingTimes, [field]: value } })),

  // ----------------------------------------------------------
  // PARTICIPANTES
  // ----------------------------------------------------------

  addParticipant: (participantData) =>
    set(s => ({
      participants: [...s.participants, { id: uid(), ...participantData }],
    })),

  updateParticipant: (id, data) =>
    set(s => ({
      participants: s.participants.map(p => p.id === id ? { ...p, ...data } : p),
    })),

  deleteParticipant: (id) =>
    set(s => ({ participants: s.participants.filter(p => p.id !== id) })),

  // ----------------------------------------------------------
  // ALCANCE — SECCIONES
  // ----------------------------------------------------------

  updateSectionSummary: (sectionId, summary) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId ? { ...sec, summary } : sec
      ),
    })),

  // Topics (solo en secciones de tipo 'introduction')
  addSectionTopic: (sectionId) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId
          ? { ...sec, topicsList: [...sec.topicsList, { id: uid(), text: 'Nuevo tema' }] }
          : sec
      ),
    })),

  updateSectionTopic: (sectionId, topicId, text) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId
          ? { ...sec, topicsList: sec.topicsList.map(t => t.id === topicId ? { ...t, text } : t) }
          : sec
      ),
    })),

  deleteSectionTopic: (sectionId, topicId) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId
          ? { ...sec, topicsList: sec.topicsList.filter(t => t.id !== topicId) }
          : sec
      ),
    })),

  // Details (en secciones de tipo 'topic')
  addSectionDetail: (sectionId) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId
          ? { ...sec, details: [...sec.details, { id: uid(), label: 'Nuevo detalle', description: '' }] }
          : sec
      ),
    })),

  updateSectionDetail: (sectionId, detailId, field, value) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId
          ? { ...sec, details: sec.details.map(d => d.id === detailId ? { ...d, [field]: value } : d) }
          : sec
      ),
    })),

  deleteSectionDetail: (sectionId, detailId) =>
    set(s => ({
      scopeSections: s.scopeSections.map(sec =>
        sec.id === sectionId
          ? { ...sec, details: sec.details.filter(d => d.id !== detailId) }
          : sec
      ),
    })),

  // ----------------------------------------------------------
  // ACUERDOS
  // ----------------------------------------------------------

  addAgreement: (data) =>
    set(s => ({
      agreements: [...s.agreements, {
        id: uid(), agreementId: `AGR-${String(s.agreements.length + 1).padStart(3, '0')}`,
        subject: 'Nuevo acuerdo', body: '', responsible: '', dueDate: '', status: 'pending',
        ...data,
      }],
    })),

  updateAgreement: (id, data) =>
    set(s => ({
      agreements: s.agreements.map(a => a.id === id ? { ...a, ...data } : a),
    })),

  deleteAgreement: (id) =>
    set(s => ({ agreements: s.agreements.filter(a => a.id !== id) })),

  // ----------------------------------------------------------
  // REQUERIMIENTOS
  // ----------------------------------------------------------

  addRequirement: (data) =>
    set(s => ({
      requirements: [...s.requirements, {
        id: uid(), requirementId: `REQ-${String(s.requirements.length + 1).padStart(3, '0')}`,
        entity: '', body: 'Nuevo requerimiento', responsible: '', priority: 'medium', status: 'open',
        ...data,
      }],
    })),

  updateRequirement: (id, data) =>
    set(s => ({
      requirements: s.requirements.map(r => r.id === id ? { ...r, ...data } : r),
    })),

  deleteRequirement: (id) =>
    set(s => ({ requirements: s.requirements.filter(r => r.id !== id) })),

  // ----------------------------------------------------------
  // TAGS IA (solo eliminar)
  // ----------------------------------------------------------

  deleteAiTag: (id) =>
    set(s => ({ aiTags: s.aiTags.filter(t => t.id !== id) })),

  // ----------------------------------------------------------
  // TAGS USUARIO (agregar / eliminar)
  // ----------------------------------------------------------

  addUserTag: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set(s => ({
      userTags: [...s.userTags, { id: uid(), name: trimmed, origin: 'user' }],
    }));
  },

  deleteUserTag: (id) =>
    set(s => ({ userTags: s.userTags.filter(t => t.id !== id) })),

  // ----------------------------------------------------------
  // PRÓXIMAS REUNIONES
  // ----------------------------------------------------------

  addUpcomingMeeting: (data) =>
    set(s => ({
      upcomingMeetings: [...s.upcomingMeetings, {
        id: uid(), meetingId: `MEET-${String(s.upcomingMeetings.length + 1).padStart(3, '0')}`,
        scheduledDate: 'Por definir', agenda: '', attendees: [],
        ...data,
      }],
    })),

  updateUpcomingMeeting: (id, data) =>
    set(s => ({
      upcomingMeetings: s.upcomingMeetings.map(m => m.id === id ? { ...m, ...data } : m),
    })),

  deleteUpcomingMeeting: (id) =>
    set(s => ({ upcomingMeetings: s.upcomingMeetings.filter(m => m.id !== id) })),

  // ----------------------------------------------------------
  // FIND / REPLACE
  // ----------------------------------------------------------

  setFindQuery:    (q) => set({ findQuery: q }),
  setReplaceQuery: (q) => set({ replaceQuery: q }),

  /**
   * Cuenta coincidencias en todo el contenido editable.
   * @returns {number}
   */
  countMatches: () => {
    const { findQuery, meetingInfo, meetingTimes, scopeSections, agreements, requirements, userTags, upcomingMeetings } = get();
    if (!findQuery) return 0;
    const re = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const corpus = [
      ...Object.values(meetingInfo),
      ...Object.values(meetingTimes),
      ...scopeSections.flatMap(s => [s.summary, ...s.topicsList.map(t => t.text), ...s.details.flatMap(d => [d.label, d.description])]),
      ...agreements.flatMap(a => [a.subject, a.body, a.responsible, a.dueDate, a.status]),
      ...requirements.flatMap(r => [r.entity, r.body, r.responsible, r.priority, r.status]),
      ...userTags.map(t => t.name),
      ...upcomingMeetings.flatMap(m => [m.scheduledDate, m.agenda]),
    ].join('\n');
    return (corpus.match(re) ?? []).length;
  },

  /**
   * Aplica reemplazos en todos los campos de texto editables.
   * @param {boolean} replaceAll - Si es false, reemplaza solo la primera ocurrencia.
   */
  applyReplace: (replaceAll = true) => {
    const { findQuery, replaceQuery } = get();
    if (!findQuery) return;
    const flags = replaceAll ? 'gi' : 'i';
    const re = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const rep = (str) => (str ?? '').replace(re, replaceQuery);

    set(s => ({
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
      scopeSections: s.scopeSections.map(sec => ({
        ...sec,
        summary:     rep(sec.summary),
        topicsList:  sec.topicsList.map(t => ({ ...t, text: rep(t.text) })),
        details:     sec.details.map(d => ({ ...d, label: rep(d.label), description: rep(d.description) })),
      })),
      agreements: s.agreements.map(a => ({
        ...a,
        subject:     rep(a.subject),
        body:        rep(a.body),
        responsible: rep(a.responsible),
        status:      rep(a.status),
      })),
      requirements: s.requirements.map(r => ({
        ...r,
        entity:      rep(r.entity),
        body:        rep(r.body),
        responsible: rep(r.responsible),
      })),
      userTags:       s.userTags.map(t => ({ ...t, name: rep(t.name) })),
      upcomingMeetings: s.upcomingMeetings.map(m => ({
        ...m,
        scheduledDate: rep(m.scheduledDate),
        agenda:        rep(m.agenda),
      })),
    }));
  },

  // ----------------------------------------------------------
  // EXPORT PAYLOAD (para generación de PDF)
  // ----------------------------------------------------------

  getExportPayload: () => {
    const s = get();
    return {
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
    };
  },

  // ----------------------------------------------------------
  // SELECTORES DERIVADOS (participación)
  // ----------------------------------------------------------

  getParticipationSummary: () => {
    const { participants } = get();
    return {
      invited:   participants.filter(p => p.type === 'invited').length,
      attendees: participants.filter(p => p.type === 'attendee').length,
      copy:      participants.filter(p => p.type === 'copy').length,
      total:     participants.length,
    };
  },
}));

export default useMinuteEditorStore;