import { CONFIG } from "../config.js";

/**
 * Configura el canvas para que ocupe toda la pantalla
 */
export function setupCanvas(canvas) {
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Configuración inicial
  resizeCanvas();

  // Actualizar al redimensionar ventana
  window.addEventListener("resize", resizeCanvas);

  console.log("✅ Canvas configurado:", canvas.width, "x", canvas.height);
}

/**
 * Limpia completamente el canvas
 */
export function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Aplica el modo espejo al canvas (útil para cámara frontal)
 */
export function applyMirror(ctx, canvas, mirror = CONFIG.MIRROR) {
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
}

/**
 * Dibuja un punto en el canvas
 */
export function drawPoint(ctx, x, y, radius = 5, color = "white") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

/**
 * Dibuja una línea en el canvas
 */
export function drawLine(ctx, x1, y1, x2, y2, color = "white", width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Dibuja un círculo en el canvas
 */
export function drawCircle(
  ctx,
  x,
  y,
  radius,
  strokeColor = "white",
  fillColor = null,
  lineWidth = 2,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Dibuja texto en el canvas
 */
export function drawText(
  ctx,
  text,
  x,
  y,
  color = "white",
  font = "16px system-ui",
  align = "left",
) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

/**
 * Dibuja un rectángulo en el canvas
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D
 * @param {number} x - Coordenada X (esquina superior izquierda)
 * @param {number} y - Coordenada Y (esquina superior izquierda)
 * @param {number} width - Ancho
 * @param {number} height - Alto
 * @param {string} fillColor - Color de relleno
 * @param {string} strokeColor - Color del borde (opcional)
 * @param {number} lineWidth - Grosor del borde
 */
export function drawRect(
  ctx,
  x,
  y,
  width,
  height,
  fillColor = "white",
  strokeColor = null,
  lineWidth = 2,
) {
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, width, height);

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, width, height);
  }
}
