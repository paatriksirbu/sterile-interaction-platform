/**
 * @fileoverview Funciones de transformación de coordenadas para renderizado.
 *
 * Este módulo contiene las funciones de conversión entre sistemas de coordenadas
 * usadas principalmente para renderizado en canvas.
 *
 * Ver interactions/coordinates.js para documentación completa del sistema de coordenadas.
 *
 * @module utils/transforms
 */

/**
 * Convierte coordenadas normalizadas (0..1) a píxeles del canvas.
 * @param {number} nx - Coordenada X normalizada (0..1)
 * @param {number} ny - Coordenada Y normalizada (0..1)
 * @param {HTMLCanvasElement} canvas - Canvas de referencia
 * @returns {Object} Coordenadas {x, y} en píxeles
 */
export function normToPx(nx, ny, canvas) {
  return {
    x: nx * canvas.width,
    y: ny * canvas.height,
  };
}

export function pxToNorm(px, py, canvas) {
  return {
    x: px / canvas.width,
    y: py / canvas.height,
  };
}

export function landmarkToPx(landmark, canvas) {
  const pos = normToPx(landmark.x, landmark.y, canvas);
  let x = pos.x;
  const y = pos.y;
  const z = landmark.z || 0;

  return { x, y, z };
}

/**
 * Calcula el punto medio entre dos puntos.
 * @param {Object} a - Primer punto {x, y}
 * @param {Object} b - Segundo punto {x, y}
 * @returns {Object} Punto medio {x, y}
 */
export function midPoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
