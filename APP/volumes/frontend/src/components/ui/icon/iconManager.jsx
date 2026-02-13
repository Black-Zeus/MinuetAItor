// src/components/ui/icon/iconManager.jsx
import React from "react";
import {
  // ====================================
  // ESTADOS VACÍOS / LISTADOS
  // ====================================
  FaInbox,
  FaUsers,

  // ====================================
  // ACCIONES GENÉRICAS
  // ====================================
  FaPlus,
  FaUserPlus,
  FaPenToSquare,
  FaPen,
  FaTrash,
  FaKey,
  FaFloppyDisk,
  FaFilter,
  FaLayerGroup,

  // ====================================
  // ESTADO / TOGGLES
  // ====================================
  FaBan,
  FaCircleCheck,
  FaCircleXmark,
  FaCheck,
  FaXmark,

  // ====================================
  // CONECTIVIDAD / SEGURIDAD / INFRAESTRUCTURA
  // ====================================
  FaWifi,
  FaUserShield,
  FaWarehouse,
  FaLocationDot,
  FaShieldHalved,
  FaGlobe,

  // ====================================
  // NAVEGACIÓN / BÚSQUEDA / CIERRE
  // ====================================
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,
  FaMagnifyingGlass,
  FaAngleUp,
  FaAngleDown,
  FaAnglesUp,
  FaAnglesDown,
  FaArrowRotateLeft,
  FaArrowRotateRight,
  FaArrowLeft,
  FaArrowRight,
  FaEllipsisVertical,

  // ====================================
  // VISIBILIDAD / CAMPOS DE CONTRASEÑA
  // ====================================
  FaEye,
  FaEyeSlash,

  // ====================================
  // FINANCIERO / DINERO
  // ====================================
  FaMoneyBill,
  FaCreditCard,
  FaDollarSign,
  FaCashRegister,
  FaMoneyBillWave,

  // ====================================
  // DOCUMENTOS / ARCHIVOS
  // ====================================
  FaFolder,
  FaFolderOpen,
  FaRegFileLines,
  FaRegFile, // ✅ NUEVO
  FaFileLines,
  FaFile,
  FaPrint,
  FaReceipt,
  FaUpload,
  FaFileExport, // ✅ NUEVO

  // ====================================
  // GRÁFICOS / ESTADÍSTICAS
  // ====================================
  FaChartLine,
  FaChartSimple,
  FaChartBar,
  FaChartPie, // ✅ NUEVO
  FaGaugeHigh, // ✅ NUEVO

  // ====================================
  // INFORMACIÓN / ALERTAS
  // ====================================
  FaCircleInfo,
  FaCircleQuestion, // ✅ NUEVO
  FaTriangleExclamation,
  FaBug, // ✅ NUEVO

  // ====================================
  // SISTEMA / SEGURIDAD
  // ====================================
  FaList,
  FaLock,
  FaLockOpen,
  FaClockRotateLeft,
  FaGears, // ✅ NUEVO (equivalente “settings” estilo múltiple)

  // ====================================
  // COMERCIO / VENTAS
  // ====================================
  FaCartShopping,
  FaPerson,
  FaBuilding,
  FaTag,
  FaTags,
  FaBriefcase, // ✅ YA AGREGADO

  // ====================================
  // FLECHAS DIRECCIONALES
  // ====================================
  FaArrowUp,
  FaArrowDown,

  // ====================================
  // SÍMBOLOS MATEMÁTICOS
  // ====================================
  FaMinus,
  FaEquals,

  // ====================================
  // MOVIMIENTOS / COMERCIO
  // ====================================
  FaCalculator,
  FaDoorOpen,
  FaArrowsRotate,
  FaArrowTrendUp,

  // ====================================
  // NOTIFICACIONES Y TEMA
  // ====================================
  FaBell,
  FaEnvelope,
  FaComment,
  FaComments,
  FaSun,
  FaMoon,

  // ====================================
  // NAVEGACIÓN PRINCIPAL
  // ====================================
  FaHouse,
  FaGear,
  FaCircleUser,

  // ====================================
  // ICONOS PARA MINUTAS (FA6)
  // ====================================
  FaCalendar,
  FaCalendarPlus,
  FaCalendarDays,
  FaCalendarCheck,
  FaClock,
  FaSpinner,
  FaDownload,
  FaFilterCircleXmark,
  FaSliders,
  FaListCheck,

  // ====================================
  // COMPAT / ICONOS FALTANTES (FA6)
  // ====================================
  FaUser,
  FaUserSlash,
  FaPhone,
  FaIndustry,
  FaStar,
  FaAddressCard,
  FaNoteSticky,
  FaCirclePause,
  FaClipboardCheck,
  FaUserCheck,

  // ====================================
  // ADICIÓN: ICONOS FALTANTES (LOGS/UI)
  // ====================================
  FaToggleOn,
  FaAlignLeft,

  // ====================================
  // NUEVOS (UI / VENTANAS / PROYECTOS / DEV)
  // ====================================
  FaRegWindowRestore, // ✅ NUEVO
  FaDiagramProject, // ✅ NUEVO
  FaCodeBranch, // ✅ NUEVO
  FaFlask, // ✅ NUEVO
} from "react-icons/fa6";

const kebabToCamel = (str) =>
  str.replace(/-([a-z])/g, (_, c) => (c ? c.toUpperCase() : ""));

const normalizeName = (name) => {
  if (typeof name !== "string") return name;
  const raw = name.trim();
  if (!raw) return raw;

  // Si viene en kebab-case, intentamos camelCase para buscar en el registry
  if (raw.includes("-")) return kebabToCamel(raw);

  return raw;
};

const ICON_REGISTRY = {
  // ====================================
  // ESTADOS VACÍOS / LISTADOS
  // ====================================
  FaInbox,
  inbox: FaInbox,

  FaUsers,
  usersEmpty: FaUsers,
  users: FaUsers,

  // ====================================
  // ACCIONES GENÉRICAS
  // ====================================
  FaPlus,
  plus: FaPlus,
  add: FaPlus,

  FaUserPlus,
  addUser: FaUserPlus,
  addUsers: FaUserPlus,
  userPlus: FaUserPlus,

  FaPenToSquare,
  edit: FaPenToSquare,
  penToSquare: FaPenToSquare,

  // ✅ NUEVO: FaPen
  FaPen,
  pen: FaPen,
  pencil: FaPen,
  write: FaPen,

  FaTrash,
  delete: FaTrash,
  trash: FaTrash,

  FaKey,
  password: FaKey,
  key: FaKey,

  FaFloppyDisk,
  save: FaFloppyDisk,

  FaFilter,
  filter: FaFilter,

  FaLayerGroup,
  zones: FaLayerGroup,

  FaArrowRotateLeft,
  return: FaArrowRotateLeft,
  undo: FaArrowRotateLeft,
  refund: FaArrowRotateLeft,

  FaArrowRotateRight,
  refresh: FaArrowRotateRight,

  // ====================================
  // ESTADO / TOGGLES
  // ====================================
  FaBan,
  ban: FaBan,

  FaCircleCheck,
  checkCircle: FaCircleCheck,
  success: FaCircleCheck,
  FaCheckCircle: FaCircleCheck, // Alias FA5
  check_circle: FaCircleCheck,

  FaCircleXmark,
  error: FaCircleXmark,
  timesCircle: FaCircleXmark,

  FaCheck,
  check: FaCheck,

  FaXmark,
  cancel: FaXmark,
  close: FaXmark,
  FaTimes: FaXmark, // Alias FA5
  x: FaXmark,

  // ====================================
  // CONECTIVIDAD / SEGURIDAD / INFRAESTRUCTURA
  // ====================================
  FaWifi,
  wifi: FaWifi,

  FaUserShield,
  security: FaUserShield,

  FaWarehouse,
  warehouse: FaWarehouse,

  FaLocationDot,
  location: FaLocationDot,

  FaShieldHalved,
  shield: FaShieldHalved,

  FaGlobe,
  globe: FaGlobe,

  // ====================================
  // NAVEGACIÓN / BÚSQUEDA / CIERRE
  // ====================================
  FaChevronLeft,
  "chevron-left": FaChevronLeft,
  chevronLeft: FaChevronLeft,

  FaChevronRight,
  "chevron-right": FaChevronRight,
  chevronRight: FaChevronRight,

  FaChevronDown,
  "chevron-down": FaChevronDown,
  chevronDown: FaChevronDown,

  FaChevronUp,
  "chevron-up": FaChevronUp,
  chevronUp: FaChevronUp,

  FaMagnifyingGlass,
  search: FaMagnifyingGlass,
  FaSearch: FaMagnifyingGlass, // Alias FA5
  searchIcon: FaMagnifyingGlass,

  FaAngleUp,
  angleUp: FaAngleUp,

  FaAngleDown,
  angleDown: FaAngleDown,

  FaAnglesUp,
  anglesUp: FaAnglesUp,

  FaAnglesDown,
  anglesDown: FaAnglesDown,

  FaArrowLeft,
  arrowLeft: FaArrowLeft,
  "arrow-left": FaArrowLeft,

  FaArrowRight,
  arrowRight: FaArrowRight,
  "arrow-right": FaArrowRight,

  FaEllipsisVertical,
  ellipsisVertical: FaEllipsisVertical,
  "ellipsis-vertical": FaEllipsisVertical,
  menu: FaEllipsisVertical,
  more: FaEllipsisVertical,

  // ====================================
  // VISIBILIDAD / CONTRASEÑAS
  // ====================================
  FaEye,
  eye: FaEye,

  FaEyeSlash,
  eyeSlash: FaEyeSlash,

  // ====================================
  // FINANCIERO / DINERO
  // ====================================
  FaMoneyBill,
  money: FaMoneyBill,

  FaCreditCard,
  creditCard: FaCreditCard,

  FaDollarSign,
  dollar: FaDollarSign,

  FaCashRegister,
  cashRegister: FaCashRegister,

  FaMoneyBillWave,
  cash: FaMoneyBillWave,

  // ====================================
  // DOCUMENTOS / ARCHIVOS
  // ====================================
  FaFolder,
  folder: FaFolder,

  FaFolderOpen,
  folderOpen: FaFolderOpen,
  "folder-open": FaFolderOpen,

  FaRegFileLines,
  file: FaRegFileLines,

  // ✅ NUEVO: FaRegFile (alias típico “file” legacy)
  FaRegFile,
  regFile: FaRegFile,
  FaFileRegular: FaRegFile, // alias semántico si se usara externamente
  "reg-file": FaRegFile,

  FaFileLines,
  fileLines: FaFileLines,

  FaFile,
  fileSolid: FaFile,

  FaFileExport,
  fileExport: FaFileExport,
  exportFile: FaFileExport,
  "file-export": FaFileExport,

  FaPrint,
  print: FaPrint,

  FaReceipt,
  receipt: FaReceipt,

  FaUpload,
  upload: FaUpload,

  // ====================================
  // GRÁFICOS / ESTADÍSTICAS
  // ====================================
  FaChartLine,
  chartLine: FaChartLine,

  FaChartSimple,
  chartSimple: FaChartSimple,

  FaChartBar,
  chartBar: FaChartBar,

  FaChartPie,
  chartPie: FaChartPie,
  "chart-pie": FaChartPie,
  pie: FaChartPie,

  FaGaugeHigh,
  gaugeHigh: FaGaugeHigh,
  "gauge-high": FaGaugeHigh,
  speed: FaGaugeHigh,
  performance: FaGaugeHigh,

  // ====================================
  // INFORMACIÓN / ALERTAS
  // ====================================
  FaCircleInfo,
  info: FaCircleInfo,
  FaInfoCircle: FaCircleInfo, // Alias FA5
  infoCircle: FaCircleInfo,
  "info-circle": FaCircleInfo,

  FaCircleQuestion,
  circleQuestion: FaCircleQuestion,
  question: FaCircleQuestion,
  help: FaCircleQuestion,
  FaQuestionCircle: FaCircleQuestion, // Alias FA5
  "question-circle": FaCircleQuestion,

  FaTriangleExclamation,
  warning: FaTriangleExclamation,
  exclamationTriangle: FaTriangleExclamation,
  "exclamation-triangle": FaTriangleExclamation,

  FaBug,
  bug: FaBug,
  issue: FaBug,

  // ====================================
  // SISTEMA / SEGURIDAD
  // ====================================
  FaList,
  list: FaList,

  FaLock,
  lock: FaLock,

  FaClockRotateLeft,
  history: FaClockRotateLeft,

  FaLockOpen,
  lockOpen: FaLockOpen,
  "lock-open": FaLockOpen,

  // ✅ NUEVO: FaGears
  FaGears,
  gears: FaGears,
  settingsAlt: FaGears,

  // ====================================
  // COMERCIO / VENTAS / CLIENTES
  // ====================================
  FaCartShopping,
  cart: FaCartShopping,
  shoppingCart: FaCartShopping,
  FaShoppingCart: FaCartShopping, // Alias FA5

  FaPerson,
  person: FaPerson,

  FaBuilding,
  business: FaBuilding,
  building: FaBuilding,

  FaTag,
  tag: FaTag,

  FaTags,
  discount: FaTags,
  tags: FaTags,

  FaBriefcase,
  briefcase: FaBriefcase,
  work: FaBriefcase,
  job: FaBriefcase,

  // ====================================
  // FLECHAS DIRECCIONALES
  // ====================================
  FaArrowUp,
  arrowUp: FaArrowUp,

  FaArrowDown,
  arrowDown: FaArrowDown,

  // ====================================
  // SÍMBOLOS MATEMÁTICOS
  // ====================================
  FaMinus,
  minus: FaMinus,

  FaEquals,
  equals: FaEquals,

  // ====================================
  // MOVIMIENTOS / COMERCIO
  // ====================================
  FaCalculator,
  calculator: FaCalculator,

  FaDoorOpen,
  doorOpen: FaDoorOpen,
  opening: FaDoorOpen,

  FaArrowsRotate,
  exchange: FaArrowsRotate,
  FaExchangeAlt: FaArrowsRotate, // Alias FA5

  FaArrowTrendUp,
  trendingUp: FaArrowTrendUp,
  "trending-up": FaArrowTrendUp,

  // ====================================
  // NOTIFICACIONES / MENSAJES
  // ====================================
  FaBell,
  bell: FaBell,
  notification: FaBell,
  notifications: FaBell,

  FaEnvelope,
  envelope: FaEnvelope,
  email: FaEnvelope,
  mail: FaEnvelope,
  message: FaEnvelope,
  messages: FaEnvelope,

  FaComment,
  comment: FaComment,
  chat: FaComment,

  FaComments,
  comments: FaComments,
  chatBubbles: FaComments,

  // ====================================
  // TEMA (DARK/LIGHT MODE)
  // ====================================
  FaSun,
  sun: FaSun,
  lightMode: FaSun,
  light: FaSun,

  FaMoon,
  moon: FaMoon,
  darkMode: FaMoon,
  dark: FaMoon,

  // ====================================
  // NAVEGACIÓN PRINCIPAL
  // ====================================
  FaHouse,
  house: FaHouse,
  home: FaHouse,
  FaHome: FaHouse,
  inicio: FaHouse,
  dashboard: FaHouse,

  FaGear,
  gear: FaGear,
  cog: FaGear,
  FaCog: FaGear,
  settings: FaGear,
  config: FaGear,
  configuracion: FaGear,
  sistema: FaGear,

  FaCircleUser,
  circleUser: FaCircleUser,
  userCircle: FaCircleUser,
  FaUserCircle: FaCircleUser,
  profile: FaCircleUser,
  account: FaCircleUser,
  miCuenta: FaCircleUser,
  "mi-cuenta": FaCircleUser,

  // ====================================
  // ICONOS PARA MINUTAS (FA6)
  // ====================================
  FaCalendar,
  calendar: FaCalendar,

  FaCalendarPlus,
  calendarPlus: FaCalendarPlus,
  "calendar-plus": FaCalendarPlus,

  FaCalendarDays,
  calendarDays: FaCalendarDays,

  FaCalendarCheck,
  calendarCheck: FaCalendarCheck,

  FaClock,
  clock: FaClock,

  FaSpinner,
  spinner: FaSpinner,
  loading: FaSpinner,

  FaDownload,
  download: FaDownload,

  FaFilterCircleXmark,
  filterClear: FaFilterCircleXmark,
  clearFilter: FaFilterCircleXmark,

  FaSliders,
  sliders: FaSliders,

  FaListCheck,
  listCheck: FaListCheck,

  // ====================================
  // ADICIÓN: ICONOS FALTANTES (LOGS/UI)
  // ====================================
  FaToggleOn,
  toggleOn: FaToggleOn,
  "toggle-on": FaToggleOn,

  FaAlignLeft,
  alignLeft: FaAlignLeft,
  "align-left": FaAlignLeft,

  // Alias literal solicitado por tu app (FA5 legacy)
  FaTimesCircle: FaCircleXmark,

  // ====================================
  // COMPATIBILIDAD (FA5 -> FA6)
  // ====================================
  FaUser,
  user: FaUser,

  FaUserSlash,
  userSlash: FaUserSlash,
  "user-slash": FaUserSlash,

  FaPhone,
  phone: FaPhone,

  FaIndustry,
  industry: FaIndustry,

  FaStar,
  star: FaStar,
  favorite: FaStar,

  FaAddressCard,
  addressCard: FaAddressCard,

  // FA5: FaMapMarkerAlt -> FA6: usar FaLocationDot
  FaMapMarkerAlt: FaLocationDot,
  mapMarkerAlt: FaLocationDot,
  marker: FaLocationDot,

  // FA5: FaStickyNote -> FA6: FaNoteSticky
  FaNoteSticky,
  noteSticky: FaNoteSticky,
  stickyNote: FaNoteSticky,
  FaStickyNote: FaNoteSticky,

  // FA5: FaEdit -> FA6: FaPenToSquare
  FaEdit: FaPenToSquare,

  // FA5: FaPauseCircle -> FA6: FaCirclePause
  FaCirclePause,
  pauseCircle: FaCirclePause,
  FaPauseCircle: FaCirclePause,

  // Checklist/validación
  FaClipboardCheck,
  clipboardCheck: FaClipboardCheck,
  "clipboard-check": FaClipboardCheck,

  FaUserCheck,
  userCheck: FaUserCheck,
  "user-check": FaUserCheck,

  // FA5/uso externo: FaEraser -> FA6: equivalente semántico
  FaEraser: FaXmark,
  eraser: FaXmark,

  // ====================================
  // NUEVOS: UI / VENTANAS / PROYECTOS / DEV
  // ====================================
  FaRegWindowRestore,
  regWindowRestore: FaRegWindowRestore,
  windowRestore: FaRegWindowRestore,
  FaWindowRestore: FaRegWindowRestore, // alias FA5

  FaDiagramProject,
  diagramProject: FaDiagramProject,
  projectDiagram: FaDiagramProject,
  "diagram-project": FaDiagramProject,

  FaCodeBranch,
  codeBranch: FaCodeBranch,
  "code-branch": FaCodeBranch,
  branch: FaCodeBranch,

  FaFlask,
  flask: FaFlask,
  lab: FaFlask,
  "test-lab": FaFlask,
};

/**
 * Icon genérico centralizado.
 */
export const Icon = ({ name, className = "", ...rest }) => {
  // 1) lookup directo
  let IconComponent = ICON_REGISTRY[name];

  // 2) lookup por normalización (kebab-case -> camelCase)
  if (!IconComponent) {
    const normalizedKey = normalizeName(name);
    IconComponent = ICON_REGISTRY[normalizedKey];
  }

  // 3) lookup por trim directo (por si viene con espacios)
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
