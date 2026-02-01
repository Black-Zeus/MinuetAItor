/**
 * Utilidades para manejo de RUT chileno
 */

/**
 * Limpia el RUT de puntos y guión
 */
export const cleanRut = (rut) => {
  return rut.replace(/[.-]/g, "");
};

/**
 * Formatea el RUT con puntos y guión (xx.xxx.xxx-x)
 */
export const formatRut = (rut) => {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return cleaned;

  const dv = cleaned.slice(-1);
  let number = cleaned.slice(0, -1);

  // Agregar puntos cada 3 dígitos desde la derecha
  number = number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${number}-${dv}`;
};

/**
 * Valida el dígito verificador del RUT
 */
export const validateRut = (rut) => {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const dv = cleaned.slice(-1).toLowerCase();
  const number = cleaned.slice(0, -1);

  // Validar que el número sea numérico
  if (!/^\d+$/.test(number)) return false;

  // Calcular dígito verificador
  let suma = 0;
  let multiplo = 2;

  for (let i = number.length - 1; i >= 0; i--) {
    suma += parseInt(number.charAt(i)) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = suma % 11;
  const dvCalculado = 11 - resto;

  let dvEsperado;
  if (dvCalculado === 11) {
    dvEsperado = "0";
  } else if (dvCalculado === 10) {
    dvEsperado = "k";
  } else {
    dvEsperado = dvCalculado.toString();
  }

  return dv === dvEsperado;
};

/**
 * Formatea y valida RUT
 * Retorna objeto con RUT formateado y validez
 */
export const processRut = (rut) => {
  const cleaned = cleanRut(rut);
  const formatted = formatRut(cleaned);
  const isValid = validateRut(cleaned);

  return {
    original: rut,
    cleaned,
    formatted,
    isValid,
  };
};