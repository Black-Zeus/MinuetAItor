// src/components/ui/icon/iconManager.jsx
import React from "react";
import {
  // Estados vacíos / listados
  FaInbox,
  FaUsers,

  // Acciones genéricas
  FaPlus,
  FaUserPlus,
  FaPenToSquare,
  FaTrash,
  FaKey,
  FaFloppyDisk,
  FaFilter,
  FaLayerGroup,

  // Estado / toggles
  FaBan,
  FaCircleCheck,
  FaCircleXmark,
  FaCheck,
  FaXmark,

  // Conectividad / seguridad / infraestructura
  FaWifi,
  FaUserShield,
  FaWarehouse,
  FaLocationDot,
  FaShieldHalved,

  // Navegación / búsqueda / cierre
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

  // Visibilidad / campos de contraseña
  FaEye,
  FaEyeSlash,

  // Financiero / Dinero
  FaMoneyBill,
  FaCreditCard,
  FaDollarSign,

  // Documentos / Archivos
  FaFolder,
  FaRegFileLines,
  FaPrint,
  FaReceipt,
  FaFileLines,

  // Gráficos / Estadísticas
  FaChartLine,
  FaChartSimple,
  FaChartBar,

  // Información / Alertas
  FaCircleInfo,
  FaTriangleExclamation,

  // Sistema / Seguridad
  FaList,
  FaLock,
  FaClockRotateLeft,

  // Comercio / Ventas
  FaCartShopping,
  FaPerson,
  FaBuilding,
  FaTag,
  FaTags,

  // Caja / Finanzas adicionales
  FaCashRegister,
  FaMoneyBillWave,

  // Flechas direccionales
  FaArrowUp,
  FaArrowDown,

  // Símbolos matemáticos
  FaMinus,
  FaEquals,

  // Movimientos / Comercio
  FaCalculator,
  FaDoorOpen,
  FaArrowsRotate,

  // Compat / errores reportados
  FaLockOpen,
  FaArrowTrendUp,

  // Notificaciones y Tema
  FaBell,
  FaEnvelope,
  FaComment,
  FaComments,
  FaSun,
  FaMoon,

  // Navegación Principal
  FaHouse,
  FaGear,
  FaCircleUser,
  FaFile,

  // ====================================
  // NUEVOS ICONOS PARA MINUTAS (FA6)
  // ====================================
  FaCalendar,
  FaCalendarDays,
  FaCalendarCheck,
  FaClock,
  FaSpinner,
  FaDownload,
  FaFilterCircleXmark,
  FaSliders,
  FaListCheck,

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

  FaPenToSquare,
  edit: FaPenToSquare,
  pen: FaPenToSquare,

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

  FaAngleUp,
  angleUp: FaAngleUp,

  FaAngleDown,
  angleDown: FaAngleDown,

  FaAnglesUp,
  anglesUp: FaAnglesUp,

  FaAnglesDown,
  anglesDown: FaAnglesDown,

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

  FaRegFileLines,
  file: FaRegFileLines,

  FaPrint,
  print: FaPrint,

  FaReceipt,
  receipt: FaReceipt,

  FaFileLines,
  fileLines: FaFileLines,

  // ====================================
  // GRÁFICOS / ESTADÍSTICAS
  // ====================================
  FaChartLine,
  chartLine: FaChartLine,

  FaChartSimple,
  chartSimple: FaChartSimple,

  FaChartBar,
  chartBar: FaChartBar,

  // ====================================
  // INFORMACIÓN / ALERTAS
  // ====================================
  FaCircleInfo,
  info: FaCircleInfo,
  FaInfoCircle: FaCircleInfo, // Alias FA5

  FaTriangleExclamation,
  warning: FaTriangleExclamation,

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
  home: FaHouse,           // Alias para compatibilidad
  FaHome: FaHouse,         // Alias para compatibilidad con FA5
  inicio: FaHouse,
  dashboard: FaHouse,

  // ====================================
  // DOCUMENTOS Y REPORTES
  // ====================================
  FaFile,
  // file: FaFile, // Ya está asignado arriba a FaRegFileLines
  fileAlt: FaFile,         // Alias para compatibilidad con FA5
  FaFileAlt: FaFile,       // Alias para compatibilidad con FA5
  report: FaFile,
  reports: FaFile,
  reportes: FaFile,

  // ====================================
  // CONFIGURACIÓN Y SISTEMA
  // ====================================
  FaGear,
  gear: FaGear,
  cog: FaGear,             // Alias para compatibilidad
  FaCog: FaGear,           // Alias para compatibilidad con FA5
  settings: FaGear,
  config: FaGear,
  configuracion: FaGear,
  sistema: FaGear,

  FaCircleUser,
  circleUser: FaCircleUser,
  userCircle: FaCircleUser,  // Alias para compatibilidad
  FaUserCircle: FaCircleUser, // Alias para compatibilidad con FA5
  profile: FaCircleUser,
  account: FaCircleUser,
  miCuenta: FaCircleUser,
  "mi-cuenta": FaCircleUser,

  // ====================================
  // ICONOS PARA MINUTAS (FA6)
  // ====================================
  FaCalendar,
  calendar: FaCalendar,

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
};

/**
 * Icon genérico centralizado.
 *
 * Uso:
 *   <Icon name="bell" className="w-4 h-4" />
 *   <Icon name="FaBell" className="text-2xl" />
 *   <Icon name="sun" />
 *   <Icon name="moon" />
 *   <Icon name="envelope" />
 *   <Icon name="calendar" />
 *   <Icon name="clock" />
 *   <Icon name="spinner" />
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