import { CONFIG } from "../config.js";
import { drawLine, drawCircle, drawText, drawPoint } from "../utils/canvas.js";
import { landmarkToPx } from "../utils/transforms.js";
import { getLandmarks } from "../gestures/base.js";
import { getPointingDirection } from "../gestures/pointing.js";

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

/**
 * Dibuja la visualización del gesto Pointing
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D
 * @param {Array} landmarks - Landmarks de la mano
 * @param {HTMLCanvasElement} canvas - Canvas de referencia
 */
export function drawPointingGesture(ctx, landmarks, canvas) {
  const l = getLandmarks(landmarks);
  if (!l) return;

  const direction = getPointingDirection(landmarks);
  if (!direction) return;

  const base = landmarkToPx(l.indexMCP, canvas);
  const tip = landmarkToPx(l.indexTip, canvas);

  // Línea del dedo índice más gruesa
  drawLine(ctx, base.x, base.y, tip.x, tip.y, "#FFD700", 4);

  // Flecha en la punta
  const arrowSize = 20;
  const angle = direction.angle;

  // Punta de la flecha
  const arrow1X = tip.x - arrowSize * Math.cos(angle - Math.PI / 6);
  const arrow1Y = tip.y - arrowSize * Math.sin(angle - Math.PI / 6);
  const arrow2X = tip.x - arrowSize * Math.cos(angle + Math.PI / 6);
  const arrow2Y = tip.y - arrowSize * Math.sin(angle + Math.PI / 6);

  drawLine(ctx, tip.x, tip.y, arrow1X, arrow1Y, "#FFD700", 4);
  drawLine(ctx, tip.x, tip.y, arrow2X, arrow2Y, "#FFD700", 4);

  // Círculo en la punta
  drawCircle(ctx, tip.x, tip.y, 10, "#FFD700", "rgba(255, 215, 0, 0.3)", 3);

  // Línea de extensión (opcional, para mostrar dirección)
  const extLength = 100;
  const extX = tip.x + extLength * Math.cos(angle);
  const extY = tip.y + extLength * Math.sin(angle);
  drawLine(ctx, tip.x, tip.y, extX, extY, "rgba(255, 215, 0, 0.3)", 2);
}

/**
 * Dibuja la visualización del agarre esférico
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D
 * @param {Array} landmarks - Landmarks de la mano
 * @param {HTMLCanvasElement} canvas - Canvas de referencia
 */
export function drawSphericalGesture(ctx, landmarks, canvas) {
  const l = getLandmarks(landmarks);
  if (!l) return;

  // Convertir puntas de dedos a píxeles
  const fingers = [
    landmarkToPx(l.indexTip, canvas),
    landmarkToPx(l.middleTip, canvas),
    landmarkToPx(l.ringTip, canvas),
    landmarkToPx(l.pinkyTip, canvas),
  ];

  // Círculos en las puntas
  fingers.forEach((finger) => {
    drawCircle(
      ctx,
      finger.x,
      finger.y,
      8,
      "#FF8C00",
      "rgba(255, 140, 0, 0.3)",
      3,
    );
  });

  // Centro aproximado de la esfera
  const centerX = fingers.reduce((sum, f) => sum + f.x, 0) / fingers.length;
  const centerY = fingers.reduce((sum, f) => sum + f.y, 0) / fingers.length;

  // Radio promedio
  const avgRadius =
    fingers.reduce((sum, f) => {
      const dist = Math.sqrt(
        Math.pow(f.x - centerX, 2) + Math.pow(f.y - centerY, 2),
      );
      return sum + dist;
    }, 0) / fingers.length;

  // Círculo de la esfera (con efecto de transparencia)
  drawCircle(
    ctx,
    centerX,
    centerY,
    avgRadius,
    "#FF8C00",
    "rgba(255, 140, 0, 0.1)",
    2,
  );

  // Arco que representa la curvatura
  ctx.beginPath();
  ctx.arc(centerX, centerY, avgRadius * 1.2, 0, Math.PI);
  ctx.strokeStyle = "rgba(255, 140, 0, 0.5)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pulgar
  const thumb = landmarkToPx(l.thumbTip, canvas);
  drawCircle(ctx, thumb.x, thumb.y, 10, "#FF4500", "rgba(255, 69, 0, 0.3)", 3);
}

/**
 * Dibuja la visualización del puño cerrado
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D
 * @param {Array} landmarks - Landmarks de la mano
 * @param {HTMLCanvasElement} canvas - Canvas de referencia
 */
export function drawClosedFistGesture(ctx, landmarks, canvas) {
  const l = getLandmarks(landmarks);
  if (!l) return;

  // Centro del puño (muñeca)
  const wrist = landmarkToPx(l.wrist, canvas);

  // Puntas de los dedos
  const fingers = [
    landmarkToPx(l.indexTip, canvas),
    landmarkToPx(l.middleTip, canvas),
    landmarkToPx(l.ringTip, canvas),
    landmarkToPx(l.pinkyTip, canvas),
    landmarkToPx(l.thumbTip, canvas),
  ];

  // Centro aproximado del puño
  const centerX = fingers.reduce((sum, f) => sum + f.x, 0) / fingers.length;
  const centerY = fingers.reduce((sum, f) => sum + f.y, 0) / fingers.length;

  // Círculo rojo alrededor del puño
  const radius = Math.max(
    ...fingers.map((f) =>
      Math.sqrt(Math.pow(f.x - centerX, 2) + Math.pow(f.y - centerY, 2)),
    ),
  );

  drawCircle(
    ctx,
    centerX,
    centerY,
    radius + 10,
    "#FF0000",
    "rgba(255, 0, 0, 0.1)",
    4,
  );

  // Puntos en cada dedo
  fingers.forEach((finger) => {
    drawPoint(ctx, finger.x, finger.y, 6, "#FF0000");
  });

  // Líneas desde el centro a cada dedo
  fingers.forEach((finger) => {
    drawLine(
      ctx,
      centerX,
      centerY,
      finger.x,
      finger.y,
      "rgba(255, 0, 0, 0.3)",
      2,
    );
  });
}

/**
 * Dibuja el mensaje de confirmación de gesto en el centro de la pantalla
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D
 * @param {HTMLCanvasElement} canvas - Canvas de referencia
 * @param {string} gestureName - Nombre del gesto
 * @param {string} emoji - Emoji del gesto
 * @param {string} color - Color del texto
 */
export function drawGestureConfirmation(
  ctx,
  canvas,
  gestureName,
  emoji,
  color = "white",
) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Fondo semi-transparente
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(centerX - 200, centerY - 60, 400, 120);

  // Emoji grande
  drawText(
    ctx,
    emoji,
    centerX,
    centerY - 30,
    color,
    "bold 60px system-ui",
    "center",
  );

  // Nombre del gesto
  drawText(
    ctx,
    gestureName,
    centerX,
    centerY + 40,
    color,
    "bold 28px system-ui",
    "center",
  );
}
