import { drawLine, drawCircle } from "../utils/canvas.js";
import { landmarkToPx } from "../utils/transforms.js";
import { getLandmarks } from "../gestures/base.js";

/**
 * Dibuja la visualización del gesto Pinch
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D
 * @param {Array} landmarks - Landmarks de la mano
 * @param {HTMLCanvasElement} canvas - Canvas de referencia
 */
export function drawPinchGesture(ctx, landmarks, canvas) {
  const l = getLandmarks(landmarks);
  if (!l) return;

  const thumb = landmarkToPx(l.thumbTip, canvas);
  const index = landmarkToPx(l.indexTip, canvas);

  // Línea entre pulgar e índice
  drawLine(ctx, thumb.x, thumb.y, index.x, index.y, "#00FF00", 3);

  // Círculos en las puntas
  drawCircle(ctx, thumb.x, thumb.y, 8, "#00FF00", null, 3);
  drawCircle(ctx, index.x, index.y, 8, "#00FF00", null, 3);

  // Punto medio con efecto de brillo
  const midX = (thumb.x + index.x) / 2;
  const midY = (thumb.y + index.y) / 2;
  drawCircle(ctx, midX, midY, 12, "#00FF00", "rgba(0, 255, 0, 0.3)", 2);
}
