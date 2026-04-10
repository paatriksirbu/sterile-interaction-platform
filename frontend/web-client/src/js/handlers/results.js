import { CONFIG } from "../config.js";
import { appState } from "../state/state.js";
import { gestureDetector } from "../gestures/detector.js";
import { isLockGestureActive } from "../gestures/lockGesture.js";
import { pdfManager } from "../objects/pdfManager.js";
import { annotationManager } from "../objects/annotationManager.js";

import { clearCanvas, applyMirror } from "../utils/canvas.js";
import { normToPx } from "../utils/transforms.js";
import { getThumbIndexPinchPositions } from "../gestures/pinch.js";
import { processDashboardGestures } from "../Dashboard/dashboard_gestures.js";

import { drawAllHands } from "../rendering/hands.js";
import { drawProgressArc } from "../rendering/progress.js";
import {
  generateLandmarksPanel,
  updateInfoElement,
  updateGestureBadges,
} from "../rendering/ui.js";
import {
  updateHandTrackingHUD,
  processGestureFeedback,
} from "../rendering/handTrackingHUD.js";

// Módulos de interacción
import { interactionState, resetFrameFlags } from "../interactions/state.js";
import {
  processPagerInteraction,
  processOpenHandScroll,
} from "../interactions/zones.js";
import {
  processPdfInteractions,
  processZoomGestures,
  processUiPinchClicks,
  processClosedFistMaximize,
} from "../interactions/pdfZoom.js";
import {
  processAnnotationPointing,
  processCanvasAnnotationPanel,
  initCanvasClickListeners,
} from "../interactions/annotations.js";
import { processCursor, resetCursorSmoothing } from "../interactions/cursor.js";

export { initCanvasClickListeners };

// Hands overlay canvas (drawn on top of all UI elements)
let handsCanvas = null;
let handsCtx = null;

function getHandsCanvas() {
  if (!handsCanvas) {
    handsCanvas = document.getElementById("hands-overlay");
    if (handsCanvas) {
      handsCtx = handsCanvas.getContext("2d");
      // Set initial size
      handsCanvas.width = window.innerWidth;
      handsCanvas.height = window.innerHeight;
      // Listen for resize
      window.addEventListener("resize", () => {
        if (handsCanvas) {
          handsCanvas.width = window.innerWidth;
          handsCanvas.height = window.innerHeight;
        }
      });
    }
  }
  return { canvas: handsCanvas, ctx: handsCtx };
}

export function onResults(results) {
  const { canvas, ctx } = appState;
  if (!canvas || !ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  clearCanvas(ctx, canvas);

  pdfManager.render(ctx, canvas);

  if (CONFIG.ANNOTATIONS?.ENABLED !== false) {
    annotationManager.render(ctx, canvas);
  }

  const hands = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];

  let gestureState = null;
  // Variable para usar manos priorizadas en todas las interacciones
  let prioritizedHands = hands;

  if (hands.length > 0) {
    // Pasar handedness para usar confianza de detección en la priorización
    gestureState = gestureDetector.detectAll(hands, handedness);
    // Usar las manos más prioritarias para las interacciones
    prioritizedHands = gestureState.prioritizedLandmarks || hands;

    // Update hand tracking HUD visualization
    updateHandTrackingHUD(hands, handedness, gestureState);

    // Process gesture feedback badges
    processGestureFeedback(gestureState);

    processDashboardGestures(prioritizedHands, gestureState);
    // Procesar gesto de bloqueo/desbloqueo global
    processLockGesture(gestureState);
  } else {
    gestureDetector.reset();
    appState.resetInteractionStates();
    resetCursorSmoothing();
    updateHandTrackingHUD([], [], null);
  }

  if (!interactionState.lockActive) {
    processZoomGestures(prioritizedHands, gestureState);

    processUiPinchClicks(prioritizedHands, gestureState);

    processCursor(prioritizedHands, gestureState);

    processPagerInteraction(prioritizedHands);
    processOpenHandScroll(prioritizedHands, gestureState);

    if (!interactionState.blockPdfDragThisFrame) {
      processPdfInteractions(prioritizedHands);
    }

    if (CONFIG.ANNOTATIONS?.ENABLED !== false) {
      processAnnotationPointing(prioritizedHands, gestureState, ctx, canvas);
    }

    processClosedFistMaximize(gestureState);
  }

  if (CONFIG.ANNOTATIONS?.ENABLED !== false) {
    processCanvasAnnotationPanel(prioritizedHands, ctx, canvas);
  }

  // Draw hands on separate overlay canvas (sits on top of all HTML elements)
  const handsOverlay = getHandsCanvas();
  if (handsOverlay.canvas && handsOverlay.ctx) {
    handsOverlay.ctx.setTransform(1, 0, 0, 1, 0, 0);
    handsOverlay.ctx.clearRect(
      0,
      0,
      handsOverlay.canvas.width,
      handsOverlay.canvas.height,
    );
    handsOverlay.ctx.save();
    applyMirror(handsOverlay.ctx, handsOverlay.canvas, CONFIG.MIRROR);
    drawAllHands(handsOverlay.ctx, hands, handedness, handsOverlay.canvas);
    handsOverlay.ctx.restore();
  }

  updateUI(hands, handedness, gestureState);

  if (CONFIG.INTERACTIONS.LOCK?.ENABLED) {
    drawLockOverlay(ctx, canvas);
  }

  resetFrameFlags();
}

// Procesa el gesto de bloqueo para alternar entre estados
function processLockGesture(gestureState) {
  if (!gestureState || !CONFIG.INTERACTIONS.LOCK?.ENABLED) return;

  const now = Date.now();
  const { HOLD_MS, COOLDOWN_MS } = CONFIG.INTERACTIONS.LOCK;

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
    now - interactionState.lockGestureStartTs >= HOLD_MS &&
    now - interactionState.lastLockToggleTs >= COOLDOWN_MS
  ) {
    interactionState.lockActive = !interactionState.lockActive;
    interactionState.lastLockToggleTs = now;
    console.log(
      `🔒 Lock toggled: ${interactionState.lockActive ? "LOCKED" : "ACTIVE"}`,
    );
    // Evitar múltiples toggles mientras se mantiene el gesto
    interactionState.lockGestureStartTs = null;
  }

  if (!gestureActive) {
    interactionState.lockGestureStartTs = null;
  }

  interactionState.lockLastGestureActive = gestureActive;
}

// Dibuja un overlay indicando el estado de bloqueo
function drawLockOverlay(ctx, canvas) {
  const paddingX = 16;
  const isLocked = interactionState.lockActive;
  const text = isLocked ? "🔒 LOCKED" : "🟢 ACTIVE";

  ctx.save();
  ctx.font =
    "bold 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "middle";

  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 32;

  const x = (canvas.width - boxWidth) / 2;
  const y = 10;

  ctx.fillStyle = isLocked
    ? "rgba(220, 53, 69, 0.9)"
    : "rgba(40, 167, 69, 0.8)";
  ctx.beginPath();
  const radius = 8;
  ctx.roundRect(x, y, boxWidth, boxHeight, radius);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + paddingX, y + boxHeight / 2);
  ctx.restore();
}

function updateUI(hands, handedness, gestureState) {
  // Panel de landmarks
  const landmarksText = generateLandmarksPanel(hands, handedness);
  updateInfoElement(appState.valuesElement, landmarksText);

  if (gestureState) {
    updateGestureBadges(gestureState);
  }

  // Indicador de progreso directamente SOBRE EL PINCH
  const { canvas, ctx } = appState;
  if (!gestureState || !canvas || !ctx) return;

  for (let i = 0; i < (hands?.length || 0); i++) {
    const handState = gestureState.hands[i];
    const handLm = hands[i];
    if (!handState || !handLm) continue;

    const pinchState = handState.pinch;
    if (
      !(
        pinchState?.detected &&
        !pinchState?.confirmed &&
        pinchState?.frameCount > 0
      )
    ) {
      continue;
    }

    // Posición del pinch
    const pp = getThumbIndexPinchPositions(handLm);
    if (!pp) continue;

    const pinchPx = normToPx(pp.x, pp.y, canvas);
    const arcX = CONFIG.MIRROR ? canvas.width - pinchPx.x : pinchPx.x;
    const arcY = pinchPx.y;

    const progress = pinchState.frameCount / CONFIG.FRAMES.PINCH;
    const radius = 40;

    drawProgressArc(ctx, arcX, arcY, radius, progress, "#00FF00");
    return;
  }
}
