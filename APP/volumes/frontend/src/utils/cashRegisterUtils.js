v/**
 * Utilidades para gestión de sesiones de caja registradora
 * Incluye funciones de formateo, cálculos y validaciones
 */

/**
 * Formatea un monto en pesos chilenos (CLP)
 * @param {number} amount - Monto a formatear
 * @returns {string} Monto formateado
 */
export const formatCLP = (amount) => {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(amount);
};

/**
 * Formatea fecha y hora en formato chileno
 * @param {string|Date} datetime - Fecha a formatear
 * @param {object} options - Opciones de formato
 * @returns {string} Fecha formateada
 */
export const formatDateTime = (datetime, options = {}) => {
  if (!datetime) return "-";
  
  const defaultOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };

  return new Date(datetime).toLocaleString("es-CL", {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Calcula el monto teórico de efectivo en una sesión
 * @param {number} openingAmount - Monto de apertura
 * @param {Array} movements - Array de movimientos de caja
 * @returns {number} Monto teórico calculado
 */
export const calculateTheoreticalCash = (openingAmount, movements) => {
  const cashMovements = movements.filter((m) => m.payment_method_id === 1);
  
  const cashIncome = cashMovements
    .filter((m) => m.amount > 0)
    .reduce((sum, m) => sum + m.amount, 0);
  
  const cashExpenses = cashMovements
    .filter((m) => m.amount < 0)
    .reduce((sum, m) => sum + Math.abs(m.amount), 0);

  return openingAmount + cashIncome - cashExpenses;
};

/**
 * Calcula totales de movimientos por tipo
 * @param {Array} movements - Array de movimientos
 * @returns {object} Objeto con totales por categoría
 */
export const calculateMovementTotals = (movements) => {
  const totals = {
    totalIncome: 0,
    totalExpenses: 0,
    cashIncome: 0,
    cashExpenses: 0,
    salesCount: 0,
    movementsCount: movements.length,
  };

  movements.forEach((movement) => {
    if (movement.amount > 0) {
      totals.totalIncome += movement.amount;
      if (movement.payment_method_id === 1) {
        totals.cashIncome += movement.amount;
      }
    } else {
      totals.totalExpenses += Math.abs(movement.amount);
      if (movement.payment_method_id === 1) {
        totals.cashExpenses += Math.abs(movement.amount);
      }
    }

    if (movement.movement_type === "SALE") {
      totals.salesCount++;
    }
  });

  return totals;
};

/**
 * Valida que una sesión pueda ser cerrada
 * @param {object} session - Objeto de sesión
 * @returns {object} Resultado de validación con mensaje
 */
export const validateSessionClosure = (session) => {
  if (session.status_code !== "OPEN") {
    return {
      valid: false,
      message: "Solo se pueden cerrar sesiones abiertas",
    };
  }

  return {
    valid: true,
    message: "Sesión válida para cierre",
  };
};

/**
 * Calcula total físico basado en denominaciones contadas
 * @param {object} denominations - Objeto con cantidades por denominación
 * @returns {number} Total físico calculado
 */
export const calculatePhysicalTotal = (denominations) => {
  return Object.entries(denominations).reduce(
    (total, [value, quantity]) => total + parseInt(value) * parseInt(quantity || 0),
    0
  );
};

/**
 * Genera un código de sesión único
 * @param {Date} date - Fecha de la sesión
 * @param {number} sequence - Número de secuencia
 * @returns {string} Código generado
 */
export const generateSessionCode = (date = new Date(), sequence = 1) => {
  const dateStr = date.toISOString().split("T")[0];
  const seqStr = String(sequence).padStart(4, "0");
  return `SES-${dateStr}-${seqStr}`;
};

/**
 * Obtiene el color de badge según el estado de la sesión
 * @param {string} statusCode - Código del estado
 * @returns {string} Clase CSS del badge
 */
export const getStatusBadgeClass = (statusCode) => {
  const classes = {
    OPEN: "badge-open",
    CLOSED: "badge-closed",
    RECONCILED: "badge-reconciled",
  };
  return classes[statusCode] || "badge-default";
};

/**
 * Obtiene el color para el tipo de movimiento
 * @param {string} movementType - Tipo de movimiento
 * @returns {string} Clase CSS de color
 */
export const getMovementTypeColor = (movementType) => {
  const colors = {
    OPENING: "text-blue-400",
    SALE: "text-green-400",
    REFUND: "text-orange-400",
    PETTY_CASH: "text-red-400",
    WITHDRAWAL: "text-red-400",
    DEPOSIT: "text-green-400",
  };
  return colors[movementType] || "text-gray-400";
};

/**
 * Valida que el monto de apertura sea válido
 * @param {number} amount - Monto a validar
 * @returns {object} Resultado de validación
 */
export const validateOpeningAmount = (amount) => {
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return {
      valid: false,
      message: "El monto debe ser un número válido",
    };
  }

  if (numAmount <= 0) {
    return {
      valid: false,
      message: "El monto debe ser mayor a cero",
    };
  }

  if (numAmount > 10000000) {
    return {
      valid: false,
      message: "El monto excede el límite permitido",
    };
  }

  return {
    valid: true,
    message: "Monto válido",
  };
};

/**
 * Calcula estadísticas de diferencias en sesiones
 * @param {Array} sessions - Array de sesiones
 * @returns {object} Objeto con estadísticas
 */
export const calculateDifferenceStats = (sessions) => {
  const sessionsWithDifferences = sessions.filter(
    (s) => s.difference_amount !== null && s.difference_amount !== 0
  );

  const totalDifference = sessions
    .filter((s) => s.difference_amount !== null)
    .reduce((sum, s) => sum + s.difference_amount, 0);

  const averageDifference =
    sessionsWithDifferences.length > 0
      ? totalDifference / sessionsWithDifferences.length
      : 0;

  return {
    sessionsWithDifferences: sessionsWithDifferences.length,
    totalDifference,
    averageDifference,
    sessionsWithSurplus: sessions.filter(
      (s) => s.difference_amount !== null && s.difference_amount > 0
    ).length,
    sessionsWithShortage: sessions.filter(
      (s) => s.difference_amount !== null && s.difference_amount < 0
    ).length,
    perfectSessions: sessions.filter(
      (s) => s.difference_amount !== null && s.difference_amount === 0
    ).length,
  };
};

/**
 * Obtiene resumen de una sesión para mostrar
 * @param {object} session - Objeto de sesión
 * @param {Array} movements - Movimientos de la sesión
 * @returns {object} Resumen completo
 */
export const getSessionSummary = (session, movements = []) => {
  const movementTotals = calculateMovementTotals(movements);
  const theoreticalCash = calculateTheoreticalCash(
    session.opening_amount,
    movements
  );

  return {
    session,
    movements: movementTotals,
    theoreticalCash,
    physicalCash: session.physical_amount,
    difference: session.difference_amount,
    isBalanced: session.difference_amount === 0,
    hasShortage: session.difference_amount !== null && session.difference_amount < 0,
    hasSurplus: session.difference_amount !== null && session.difference_amount > 0,
  };
};

export default {
  formatCLP,
  formatDateTime,
  calculateTheoreticalCash,
  calculateMovementTotals,
  validateSessionClosure,
  calculatePhysicalTotal,
  generateSessionCode,
  getStatusBadgeClass,
  getMovementTypeColor,
  validateOpeningAmount,
  calculateDifferenceStats,
  getSessionSummary,
};