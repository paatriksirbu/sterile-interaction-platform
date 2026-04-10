import { CONFIG } from "../config.js";
import { appState } from "../state/state.js";

/* ============================================================
    SMOOTHING (anti-jitter)
    ============================================================ */
const SMOOTH_ALPHA = 0.22;
let smoothX = null;
let smoothY = null;

function smooth(x, y) {
  if (smoothX === null || smoothY === null) {
    smoothX = x;
    smoothY = y;
    return { x, y };
  }
  smoothX = smoothX + SMOOTH_ALPHA * (x - smoothX);
  smoothY = smoothY + SMOOTH_ALPHA * (y - smoothY);
  return { x: smoothX, y: smoothY };
}

export function resetCursorSmoothing() {
  smoothX = null;
  smoothY = null;
}

/* ============================================================
    CURSOR DOM HELPERS
    ============================================================ */

// Crea elemento del cursor si no existe
export function ensureCursorElement() {
  if (document.getElementById("pinch-cursor")) return;

  const cursor = document.createElement("div");
  cursor.id = "pinch-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = `
    <div class="ring"></div>
    <div class="fill"></div>
    <div class="dot"></div>
  `;
  document.body.appendChild(cursor);
}

export function showCursor(
  x,
  y,
  { arming = false, progress = 0, confirmed = false } = {},
) {
  const cursor = document.getElementById("pinch-cursor");
  if (!cursor) return;

  cursor.style.opacity = "";
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

  cursor.classList.add("show");

  // Progreso 0..1 para el conic-gradient
  cursor.style.setProperty("--p", String(progress));

  // Clases de estado
  cursor.classList.toggle("arming", arming);
  cursor.classList.toggle("confirmed", confirmed);
}

/**
 * Oculta el cursor.
 */
export function hideCursor() {
  const cursor = document.getElementById("pinch-cursor");
  if (!cursor) return;

  cursor.classList.remove("show", "arming", "confirmed");
  cursor.style.left = "-9999px";
  cursor.style.top = "-9999px";
  cursor.style.opacity = "";
  cursor.style.setProperty("--p", "0");
}

/* ============================================================
    PUNTO MEDIO PULGAR-ÍNDICE
    ============================================================ */

/**
 * Obtiene el punto medio entre pulgar e índice.
 */
export function getThumbIndexMidpoint(handLandmarks) {
  const thumb = handLandmarks?.[4]; // thumb tip
  const index = handLandmarks?.[8]; // index tip
  if (!thumb || !index) return null;
  return {
    x: (thumb.x + index.x) * 0.5,
    y: (thumb.y + index.y) * 0.5,
    z: (thumb.z + index.z) * 0.5,
  };
}

/* ============================================================
    PROCESAMIENTO PRINCIPAL DEL CURSOR
    ============================================================ */

/**
 * Convierte posición normalizada a coordenadas de pantalla usando el canvas.
 */
function normToScreen(posNorm, canvas, mirror) {
  const rect = canvas.getBoundingClientRect();
  const xPx = posNorm.x * rect.width;
  const yPx = posNorm.y * rect.height;

  const clientX = rect.left + (mirror ? rect.width - xPx : xPx);
  const clientY = rect.top + yPx;

  return { clientX, clientY };
}

/**
 * Procesa y actualiza el cursor basado en el estado de las manos.
 * Debe llamarse en cada frame del loop de renderizado.
 */
export function processCursor(hands, gestureState) {
  // Asegurar que existe el elemento
  ensureCursorElement();

  // Obtener canvas de appState
  const { canvas } = appState;

  if (!hands?.length || !canvas) {
    hideCursor();
    resetCursorSmoothing();
    return;
  }

  // Buscar mano con pinch activo (priorizar confirmed, luego detected)
  let handIdx = 0;
  if (gestureState?.hands?.length) {
    const confirmedIdx = gestureState.hands.findIndex(
      (h) => h?.pinch?.confirmed,
    );
    if (confirmedIdx >= 0 && hands[confirmedIdx]) {
      handIdx = confirmedIdx;
    } else {
      const detectedIdx = gestureState.hands.findIndex(
        (h) => h?.pinch?.detected,
      );
      if (detectedIdx >= 0 && hands[detectedIdx]) {
        handIdx = detectedIdx;
      }
    }
  }

  const pinchState = gestureState?.hands?.[handIdx]?.pinch ?? {
    detected: false,
    confirmed: false,
  };
  const detected = !!pinchState.detected;
  const confirmed = !!pinchState.confirmed;

  // Solo mostrar cursor cuando hay pinch detectado (no en pointing u otros gestos)
  if (!detected && !confirmed) {
    hideCursor();
    resetCursorSmoothing();
    return;
  }

  // Obtener posición del cursor (punto medio pulgar-índice)
  const mid = getThumbIndexMidpoint(hands[handIdx]);
  if (!mid) {
    hideCursor();
    resetCursorSmoothing();
    return;
  }

  // Convertir a coordenadas de pantalla usando el canvas como referencia
  const { clientX, clientY } = normToScreen(mid, canvas, CONFIG.MIRROR);
  const smoothed = smooth(clientX, clientY);

  // Calcular progreso basado en frameCount del detector
  let progress = 0;
  if (detected && !confirmed && pinchState.frameCount > 0) {
    progress = Math.min(pinchState.frameCount / CONFIG.FRAMES.PINCH, 1);
  } else if (confirmed) {
    progress = 1;
  }

  // Mostrar cursor
  showCursor(smoothed.x, smoothed.y, {
    arming: detected && !confirmed,
    progress,
    confirmed,
  });
}
