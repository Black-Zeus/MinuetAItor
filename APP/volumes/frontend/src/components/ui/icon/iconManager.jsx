// src/components/icons/iconManager.jsx
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
  FaLockOpen,     // lock-open
  FaArrowTrendUp, // trending-up
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

  FaTrash,
  delete: FaTrash,

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

  // Compat FA5 -> FA6
  FaCheckCircle: FaCircleCheck, // "FaCheckCircle" solicitado en logs
  check_circle: FaCircleCheck,  // opcional

  FaCircleXmark,
  error: FaCircleXmark,
  timesCircle: FaCircleXmark,

  FaCheck,
  check: FaCheck,

  FaXmark,
  cancel: FaXmark,
  close: FaXmark,

  // Compat FA5 -> FA6
  FaTimes: FaXmark, // "FaTimes" solicitado en logs
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
  // NAVEGACIÓN / BÚSQUEDA
  // ====================================
  FaChevronLeft,
  chevronLeft: FaChevronLeft,

  FaChevronRight,
  chevronRight: FaChevronRight,

  FaChevronDown,
  chevronDown: FaChevronDown,

  FaChevronUp,
  chevronUp: FaChevronUp,
  "chevron-up": FaChevronUp, // si lo usas en kebab-case explícito

  FaMagnifyingGlass,
  search: FaMagnifyingGlass,

  FaAngleUp,
  expandLess: FaAngleUp,

  FaAngleDown,
  expandMore: FaAngleDown,

  FaAnglesUp,
  unfoldLess: FaAnglesUp,

  FaAnglesDown,
  unfoldMore: FaAnglesDown,

  // ====================================
  // VISIBILIDAD / CAMPOS DE CONTRASEÑA
  // ====================================
  FaEye,
  eye: FaEye,

  FaEyeSlash,
  eyeSlash: FaEyeSlash,

  // ====================================
  // FINANCIERO / DINERO
  // ====================================
  FaMoneyBill,
  cash: FaMoneyBill,
  money: FaMoneyBill,

  FaDollarSign,
  dollar: FaDollarSign,
  dollarSign: FaDollarSign,
  "dollar-sign": FaDollarSign, // solicitado en logs

  FaCreditCard,
  payments: FaCreditCard,
  creditCard: FaCreditCard,
  "credit-card": FaCreditCard,

  FaMoneyBillWave,
  moneyWave: FaMoneyBillWave,

  FaCashRegister,
  cashRegister: FaCashRegister,

  // ====================================
  // DOCUMENTOS / ARCHIVOS
  // ====================================
  FaFolder,
  folder: FaFolder,

  FaRegFileLines,
  document: FaRegFileLines,

  FaFileLines,
  fileAlt: FaFileLines,
  fileLines: FaFileLines,

  "file-text": FaFileLines, // solicitado en logs (equivalente razonable)
  fileText: FaFileLines,

  FaPrint,
  print: FaPrint,

  FaReceipt,
  receipt: FaReceipt,

  // ====================================
  // GRÁFICOS / ESTADÍSTICAS
  // ====================================
  FaChartSimple,
  chart: FaChartSimple,

  FaChartLine,
  activity: FaChartLine,

  FaChartBar,
  chartBar: FaChartBar,

  // ====================================
  // INFORMACIÓN / ALERTAS
  // ====================================
  FaCircleInfo,
  info: FaCircleInfo,

  // Compat FA5 -> FA6
  FaInfoCircle: FaCircleInfo, // solicitado en logs

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

  // ====================================
  // COMERCIO / VENTAS / CLIENTES
  // ====================================
  FaCartShopping,
  cart: FaCartShopping,
  shoppingCart: FaCartShopping,
  FaShoppingCart: FaCartShopping, // compat

  FaPerson,
  person: FaPerson,

  FaBuilding,
  business: FaBuilding,

  users: FaUsers,

  FaTag,
  tag: FaTag,

  FaTags,
  discount: FaTags,

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
  FaExchangeAlt: FaArrowsRotate, // compat

  // ====================================
  // NUEVOS - PARA WARNINGS (FA6)
  // ====================================
  FaLockOpen,
  lockOpen: FaLockOpen,
  "lock-open": FaLockOpen, // solicitado anteriormente

  FaArrowTrendUp,
  trendingUp: FaArrowTrendUp,
  "trending-up": FaArrowTrendUp, // solicitado anteriormente
};

/**
 * Icon genérico centralizado.
 *
 * Uso:
 *   <Icon name="edit" className="w-4 h-4" />
 *   <Icon name="FaUsers" className="text-2xl" />
 *   <Icon name="check-circle" />
 *   <Icon name="FaTimes" />
 *   <Icon name="FaInfoCircle" />
 *   <Icon name="dollar-sign" />
 *   <Icon name="file-text" />
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
