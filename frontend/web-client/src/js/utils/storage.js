/**
 * Guarda un valor en localStorage
 * @param {string} key - Clave del valor
 * @param {any} value - Valor a guardar (se convertirá a string)
 * @returns {boolean} true si se guardó correctamente
 */
export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.warn("Error al guardar en localStorage:", error);
    return false;
  }
}

/**
 * Obtiene un valor de localStorage
 * @param {string} key - Clave del valor
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {string|null} Valor almacenado o defaultValue
 */
export function loadFromStorage(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.warn("Error al leer de localStorage:", error);
    return defaultValue;
  }
}

/**
 * Obtiene un número de localStorage
 * @param {string} key - Clave del valor
 * @param {number} defaultValue - Valor por defecto si no existe o no es un número
 * @returns {number} Número almacenado o defaultValue
 */
export function loadNumberFromStorage(key, defaultValue = 0) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;

    const num = Number(raw);
    return Number.isFinite(num) ? num : defaultValue;
  } catch (error) {
    console.warn("Error al leer número de localStorage:", error);
    return defaultValue;
  }
}

/**
 * Obtiene un booleano de localStorage
 * @param {string} key - Clave del valor
 * @param {boolean} defaultValue - Valor por defecto
 * @returns {boolean} Booleano almacenado o defaultValue
 */
export function loadBooleanFromStorage(key, defaultValue = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;

    return raw === "true";
  } catch (error) {
    console.warn("Error al leer booleano de localStorage:", error);
    return defaultValue;
  }
}

/**
 * Guarda un objeto JSON en localStorage
 * @param {string} key - Clave del valor
 * @param {Object} obj - Objeto a guardar
 * @returns {boolean} true si se guardó correctamente
 */
export function saveObjectToStorage(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
    return true;
  } catch (error) {
    console.warn("Error al guardar objeto en localStorage:", error);
    return false;
  }
}

/**
 * Obtiene un objeto JSON de localStorage
 * @param {string} key - Clave del valor
 * @param {Object} defaultValue - Valor por defecto
 * @returns {Object} Objeto almacenado o defaultValue
 */
export function loadObjectFromStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;

    return JSON.parse(raw);
  } catch (error) {
    console.warn("Error al leer objeto de localStorage:", error);
    return defaultValue;
  }
}

/**
 * Elimina un valor de localStorage
 * @param {string} key - Clave del valor a eliminar
 * @returns {boolean} true si se eliminó correctamente
 */
export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn("Error al eliminar de localStorage:", error);
    return false;
  }
}

/**
 * Limpia todo el localStorage
 * @returns {boolean} true si se limpió correctamente
 */
export function clearStorage() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.warn("Error al limpiar localStorage:", error);
    return false;
  }
}

/**
 * Verifica si una clave existe en localStorage
 * @param {string} key - Clave a verificar
 * @returns {boolean} true si existe
 */
export function hasInStorage(key) {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.warn("Error al verificar localStorage:", error);
    return false;
  }
}

/**
 * Obtiene todas las claves almacenadas
 * @returns {Array<string>} Array de claves
 */
export function getAllKeys() {
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.warn("Error al obtener claves de localStorage:", error);
    return [];
  }
}
