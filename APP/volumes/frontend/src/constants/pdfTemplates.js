export const DEFAULT_PDF_TEMPLATE = "opc_01";

export const PDF_TEMPLATE_OPTIONS = [
  {
    id: "opc_01",
    name: "Corporativa Completa",
    description:
      "Documento formal multipágina con portada, ficha técnica y estructura completa para minutas de seguimiento.",
    thumb: "layout",
  },
  {
    id: "opc_02",
    name: "Ejecutiva Moderna",
    description:
      "Diseño compacto y contemporáneo, ideal para revisiones ejecutivas y comités de seguimiento breves.",
    thumb: "briefcase",
  },
  {
    id: "opc_03",
    name: "Técnica Detallada",
    description:
      "Formato orientado a contenido técnico y trazabilidad, útil cuando la minuta necesita más densidad documental.",
    thumb: "layout",
  },
  {
    id: "opc_04",
    name: "Gobernanza / Comité",
    description:
      "Acta institucional con fuerte énfasis en resoluciones, acuerdos formales y cierre de aprobación.",
    thumb: "building",
  },
];

export const getPdfTemplateMeta = (templateId) =>
  PDF_TEMPLATE_OPTIONS.find((item) => item.id === templateId) ?? PDF_TEMPLATE_OPTIONS[0];

export const getPdfTemplateLabel = (templateId, fallback = "Corporativa Completa") =>
  getPdfTemplateMeta(templateId)?.name ?? fallback;
