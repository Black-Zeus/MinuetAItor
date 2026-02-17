// src/components/ui/icon/iconManager.jsx
import React from "react";
import {
  // =========================
  // BASE / UI
  // =========================
  FaBuilding,
  FaCalendar,
  FaCalendarPlus,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,            // ✅ NUEVO
  FaClock,
  FaDownload,
  FaEye,
  FaBrain,
  FaCircleInfo,
  FaCircleQuestion,       // ✅ NUEVO
  FaDoorOpen,
  FaEnvelope,
  FaEraser,
  FaFilter,
  FaFolder,
  FaFolderOpen,
  FaInbox,
  FaIndustry,
  FaLayerGroup,
  FaLock,
  FaPen,
  FaPenToSquare,
  FaPhone,
  FaPowerOff,
  FaMagnifyingGlass,
  FaSliders,
  FaTag,
  FaTags,
  FaTrash,
  FaUser,
  FaUsers,
  FaFileLines,
  FaClockRotateLeft,
  FaListCheck,
  FaFilterCircleXmark,
  FaCircleCheck,
  FaCircleXmark,

  // =========================
  // PREVIOS (tu set actual)
  // =========================
  FaBan,
  FaCode,
  FaTerminal,
  FaHouse,
  FaRegFileLines,
  FaRegWindowRestore,     // ✅ NUEVO
  FaChartLine,
  FaClipboardCheck,
  FaRegFile,
  FaGears,
  FaFlask,
  FaBell,
  FaBug,                  // ✅ NUEVO

  // =========================
  // TOGGLES / SORT (warnings actuales)
  // =========================
  FaToggleOn,             // ✅ NUEVO
  FaArrowDownAZ,          // ✅ NUEVO

  // =========================
  // NUEVOS (ya tenías)
  // =========================
  FaSpinner,
  FaStar,
  FaCirclePause,
  FaUserCheck,
  FaUserSlash,
  FaUserShield,

  // =========================
  // NUEVOS (warnings previos)
  // =========================
  FaDiagramProject,
  FaChartPie,
  FaFileExport,
  FaGaugeHigh,
  FaCodeBranch,
  FaTriangleExclamation,
} from "react-icons/fa6";

const kebabToCamel = (str) =>
  str.replace(/-([a-z])/g, (_, c) => (c ? c.toUpperCase() : ""));

const normalizeName = (name) => {
  if (typeof name !== "string") return name;
  const raw = name.trim();
  if (!raw) return raw;
  if (raw.includes("-")) return kebabToCamel(raw);
  return raw;
};

const ICON_REGISTRY = {
  // =========================
  // Claves simples (tu app)
  // =========================
  business: FaBuilding,
  calendar: FaCalendar,
  chevronLeft: FaChevronLeft,
  chevronRight: FaChevronRight,
  chevronDown: FaChevronDown,
  chevronUp: FaChevronUp,
  clock: FaClock,
  delete: FaTrash,
  download: FaDownload,
  edit: FaPenToSquare,
  eye: FaEye,

  fileLines: FaFileLines,
  filter: FaFilter,
  filterClear: FaFilterCircleXmark,
  folder: FaFolder,
  folderOpen: FaFolderOpen,
  history: FaClockRotateLeft,
  listCheck: FaListCheck,
  search: FaMagnifyingGlass,
  sliders: FaSliders,
  users: FaUsers,

  ban: FaBan,
  checkCircle: FaCircleCheck,
  xCircle: FaCircleXmark,
  info: FaCircleInfo,
  question: FaCircleQuestion,
  spinner: FaSpinner,

  toggleOn: FaToggleOn,
  sortAZ: FaArrowDownAZ,

  // (aliases simples opcionales útiles)
  home: FaHouse,
  bell: FaBell,
  star: FaStar,
  project: FaDiagramProject,
  chartPie: FaChartPie,
  export: FaFileExport,
  gauge: FaGaugeHigh,
  branch: FaCodeBranch,
  warning: FaTriangleExclamation,
  bug: FaBug,
  restore: FaRegWindowRestore,

  // =========================
  // Claves "Fa..." (compat)
  // =========================
  FaBrain: FaBrain,
  FaBuilding: FaBuilding,
  FaCalendarPlus: FaCalendarPlus,

  // FA5 -> FA6 (aliases típicos)
  FaCheckCircle: FaCircleCheck,
  FaEdit: FaPenToSquare,
  FaFileAlt: FaFileLines,
  FaSearch: FaMagnifyingGlass,
  FaTimesCircle: FaCircleXmark,
  FaPauseCircle: FaCirclePause,

  // =========================
  // Existentes (mapeo directo)
  // =========================
  FaCircleInfo: FaCircleInfo,
  FaCircleQuestion: FaCircleQuestion,
  FaDoorOpen: FaDoorOpen,
  FaEnvelope: FaEnvelope,
  FaEraser: FaEraser,
  FaEye: FaEye,
  FaFilter: FaFilter,
  FaFilterCircleXmark: FaFilterCircleXmark,
  FaFolder: FaFolder,
  FaFolderOpen: FaFolderOpen,
  FaInbox: FaInbox,
  FaIndustry: FaIndustry,
  FaLayerGroup: FaLayerGroup,
  FaLock: FaLock,
  FaPen: FaPen,
  FaPenToSquare: FaPenToSquare,
  FaPhone: FaPhone,
  FaPowerOff: FaPowerOff,
  FaSliders: FaSliders,
  FaTag: FaTag,
  FaTags: FaTags,
  FaTrash: FaTrash,
  FaUser: FaUser,
  FaUsers: FaUsers,
  FaMagnifyingGlass: FaMagnifyingGlass,
  FaChevronDown: FaChevronDown,
  FaChevronUp: FaChevronUp,
  FaChevronLeft: FaChevronLeft,
  FaChevronRight: FaChevronRight,
  FaClock: FaClock,
  FaDownload: FaDownload,
  FaFileLines: FaFileLines,
  FaClockRotateLeft: FaClockRotateLeft,
  FaListCheck: FaListCheck,
  FaCircleCheck: FaCircleCheck,
  FaCircleXmark: FaCircleXmark,

  // previos
  FaBan: FaBan,
  FaCode: FaCode,
  FaTerminal: FaTerminal,
  FaHouse: FaHouse,
  FaRegFileLines: FaRegFileLines,
  FaRegWindowRestore: FaRegWindowRestore,
  FaChartLine: FaChartLine,
  FaClipboardCheck: FaClipboardCheck,
  FaRegFile: FaRegFile,
  FaGears: FaGears,
  FaFlask: FaFlask,
  FaBell: FaBell,
  FaBug: FaBug,

  // toggles / sort
  FaToggleOn: FaToggleOn,
  FaArrowDownAZ: FaArrowDownAZ,

  // ✅ NUEVOS (ya tenías)
  FaSpinner: FaSpinner,
  FaStar: FaStar,
  FaCirclePause: FaCirclePause,
  FaUserCheck: FaUserCheck,
  FaUserSlash: FaUserSlash,
  FaUserShield: FaUserShield,

  // ✅ NUEVOS (warnings previos)
  FaDiagramProject: FaDiagramProject,
  FaChartPie: FaChartPie,
  FaFileExport: FaFileExport,
  FaGaugeHigh: FaGaugeHigh,
  FaCodeBranch: FaCodeBranch,
  FaTriangleExclamation: FaTriangleExclamation,
};

export const Icon = ({ name, className = "", ...rest }) => {
  let IconComponent = ICON_REGISTRY[name];

  if (!IconComponent) {
    const normalizedKey = normalizeName(name);
    IconComponent = ICON_REGISTRY[normalizedKey];
  }

  if (!IconComponent && typeof name === "string") {
    IconComponent = ICON_REGISTRY[name.trim()];
  }

  if (!IconComponent) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[IconManager] Icon "${name}" no está registrado.`);
    }
    return null;
  }

  return <IconComponent className={className} {...rest} />;
};

export const ICONS = ICON_REGISTRY;

export default Icon;