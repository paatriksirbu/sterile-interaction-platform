import { CONFIG } from "../config.js";
import { videoState } from "./videoState.js";
import { gestureDetector } from "../gestures/detector.js";
import { clearCanvas, applyMirror } from "../utils/canvas.js";
import { drawAllHands } from "../rendering/hands.js";
import { getThumbIndexPinchPositions } from "../gestures/pinch.js";
import { processVideoGestures, processButtonHover } from "./videoGestures.js";
import { isLockGestureActive } from "../gestures/lockGesture.js";
import { interactionState } from "../interactions/state.js";
import {
  updateHandTrackingHUD,
  processGestureFeedback,
} from "../rendering/handTrackingHUD.js";

/**
 * Callback principal de MediaPipe para el visor de video
 */
export function onVideoResults(results) {
  const { canvas, ctx } = videoState;
  if (!canvas || !ctx) return;

  // Reset transformación
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Limpiar canvas
  clearCanvas(ctx, canvas);

  // Mirror para manos/overlays
  ctx.save();
  applyMirror(ctx, canvas, CONFIG.MIRROR);

  // Manos detectadas
  const hands = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];

  // Dibujar esqueleto de manos
  drawAllHands(ctx, hands, handedness, canvas);

  // Procesar gestos si hay manos
  let gestureState = null;
  if (hands.length > 0) {
    gestureState = gestureDetector.detectAll(hands, handedness);

    // Update hand tracking HUD visualization
    updateHandTrackingHUD(hands, handedness, gestureState);

    // Process gesture feedback badges
    processGestureFeedback(gestureState);

    // Procesar gesto de LOCK antes que el resto de gestos específicos
    processLockGesture(gestureState);

    // Procesar gestos específicos del video SOLO si no está bloqueado
    if (!interactionState.lockActive) {
      processVideoGestures(hands, gestureState, canvas);

      // Procesar hover sobre elementos interactivos (botones, video items, etc.)
      processButtonHover(hands, gestureState);
    }
  } else {
    gestureDetector.reset();
    videoState.updateGestureIndicator("-", "-");
    updateHandTrackingHUD([], [], null);
  }

  ctx.restore();

  // Dibujar cursor de pinch si está activo
  if (hands.length > 0 && gestureState) {
    const prioritizedLandmarks = gestureState.prioritizedLandmarks || hands;
    drawPinchCursor(ctx, prioritizedLandmarks, canvas);
  }

  // Dibujar indicador de LOCK/ACTIVE en overlay superior
  drawLockOverlay(ctx, canvas);
}

/**
 * Dibuja un cursor visual donde está el pinch
 */
function drawPinchCursor(ctx, hands, canvas) {
  for (const landmarks of hands) {
    const pinchPos = getThumbIndexPinchPositions(landmarks);
    if (pinchPos) {
      // Convertir a píxeles (sin espejo, aplicar manualmente)
      let x = pinchPos.x * canvas.width;
      let y = pinchPos.y * canvas.height;

      // Aplicar espejo si está configurado
      if (CONFIG.MIRROR) {
        x = canvas.width - x;
      }

      // Dibujar cursor
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(76, 175, 80, 0.6)";
      ctx.fill();
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Punto central
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * Procesa el gesto de bloqueo/desbloqueo global basado en un gesto mantenido.
 */
function processLockGesture(gestureState) {
  if (!gestureState || !CONFIG.INTERACTIONS.LOCK?.ENABLED) return;

  const now = Date.now();

  const gestureActive = isLockGestureActive(gestureState);
  const wasGestureActive = interactionState.lockLastGestureActive;

  // Inicio de gesto
  if (gestureActive && !wasGestureActive) {
    interactionState.lockGestureStartTs = now;
  }

  // Gesto mantenido el tiempo suficiente y respetando cooldown
  if (
    gestureActive &&
    interactionState.lockGestureStartTs != null &&
    now - interactionState.lockGestureStartTs >=
      CONFIG.INTERACTIONS.LOCK.HOLD_MS &&
    now - interactionState.lastLockToggleTs >=
      CONFIG.INTERACTIONS.LOCK.COOLDOWN_MS
  ) {
    interactionState.lockActive = !interactionState.lockActive;
    interactionState.lastLockToggleTs = now;
    // Evitar múltiples toggles mientras se mantiene el gesto
    interactionState.lockGestureStartTs = null;
  }

  // Reset si el gesto deja de estar activo
  if (!gestureActive) {
    interactionState.lockGestureStartTs = null;
  }

  interactionState.lockLastGestureActive = gestureActive;
}

/**
 * Dibuja un pequeño overlay superior centrado indicando LOCKED / ACTIVE.
 */
function drawLockOverlay(ctx, canvas) {
  const paddingX = 16;

  const isLocked = interactionState.lockActive;
  const text = isLocked ? "🔒 LOCKED" : "🟢 ACTIVE";

  ctx.save();

  ctx.font = "16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "middle";

  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 28;

  const x = (canvas.width - boxWidth) / 2;
  const y = 10; // margen superior

  // Fondo
  ctx.fillStyle = isLocked
    ? "rgba(220, 53, 69, 0.85)" // rojo
    : "rgba(40, 167, 69, 0.7)"; // verde
  ctx.beginPath();
  const radius = 6;
  roundRect(ctx, x, y, boxWidth, boxHeight, radius);
  ctx.fill();

  // Texto
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + paddingX, y + boxHeight / 2);

  ctx.restore();
}

// Dibuja un rectángulo redondeado sencillo
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
