// src/js/viewer3d/results3d.js
import { CONFIG } from "../config.js";
import { threeViewer } from "../rendering/threeViewer.js";
import { handCursor } from "./cursor3d.js";
import { createAirRuler } from "./airRuler.js";
import {
  updateHandTrackingHUD,
  processGestureFeedback,
} from "../rendering/handTrackingHUD.js";
import { gestureDetector } from "../gestures/detector.js";
import { sendGestureIfConfirmed } from "../services/gestureApiService.js";

let lastHands = [];
let lastHandedness = [];

export function getOverlayHands() {
  return { hands: lastHands, handedness: lastHandedness };
}

// ✅ límite de rotación por frame
const MAX_ROT_PX = 120;

// Air Ruler (anclada al modelo)
const airRuler = createAirRuler({ mirror: CONFIG.MIRROR });
export function getAirRuler() {
  return airRuler;
}

// Estado
const st = {
  hands: new Map(),

  zoom: {
    active: false,
    startDist: null,
    startValue: 1.0,
    value: 1.0,
    syncMs: 180,
    min: 0.5,
    max: 2.0,
  },

  leftFistNow: false,
  leftFistPrev: false,
  rightFistNow: false,
  rightFistPrev: false,
};

const pinchClick = {
  active: false,
  startT: 0,
  fired: false,
  target: null,
};

// --- suavizado de deltas (quita jitter sin lag fuerte) ---
function smoothDelta(prev, next, alpha = 0.35) {
  return prev + (next - prev) * alpha;
}
const filt = {
  moveDx: 0,
  moveDy: 0,
  rotDx: 0,
  rotDy: 0,
};

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midThumbIndex(lm) {
  const t = lm?.[4];
  const i = lm?.[8];
  if (!t || !i) return null;
  return { x: (t.x + i.x) * 0.5, y: (t.y + i.y) * 0.5 };
}

function getHandKey(handedness, i) {
  const label = handedness?.[i]?.label;
  if (label === "Left" || label === "Right") return label;
  return `Unknown-${i}`;
}

function getOrCreateHandState(key) {
  if (!st.hands.has(key)) {
    st.hands.set(key, {
      pinchActive: false,
      lastMid: null,
      pinchStartT: null,
    });
  }
  return st.hands.get(key);
}

function resetAll() {
  st.hands.clear();

  pinchClick.active = false;
  pinchClick.startT = 0;
  pinchClick.fired = false;
  pinchClick.target = null;

  st.zoom.active = false;
  st.zoom.startDist = null;

  st.leftFistNow = false;
  st.leftFistPrev = false;
  st.rightFistNow = false;
  st.rightFistPrev = false;

  filt.moveDx = filt.moveDy = 0;
  filt.rotDx = filt.rotDy = 0;

  airRuler.clearAll();
  handCursor.reset();
}

/**
 * Hit-test con “margen interior” para evitar que rozar un botón active click accidental.
 * paddingPx: reduce el rectángulo del botón para que sea más difícil activar por accidente.
 */
function elementAtPinch(px, py, selector, paddingPx = 8) {
  const el = document.querySelector(selector);
  if (!el) return null;

  const r = el.getBoundingClientRect();
  const left = r.left + paddingPx;
  const right = r.right - paddingPx;
  const top = r.top + paddingPx;
  const bottom = r.bottom - paddingPx;

  if (px >= left && px <= right && py >= top && py <= bottom) return el;
  return null;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function updateZoomUI(zoomValue) {
  const slider = document.getElementById("zoomSlider");
  const indicator = document.getElementById("zoom-indicator");
  if (slider) slider.value = Math.round(zoomValue * 100);
  if (indicator) indicator.textContent = `${Math.round(zoomValue * 100)}%`;
}

// ✅ Zoom a 2 manos con deadzone para que no “robe” frames por ruido
function tryHandleTwoHandZoom(primary, secondary) {
  if (!primary?.state?.pinchActive || !primary?.mid) return false;
  if (!secondary?.state?.pinchActive || !secondary?.mid) return false;

  const t0 = primary.state.pinchStartT;
  const t1 = secondary.state.pinchStartT;
  if (t0 == null || t1 == null) return false;

  const simultaneous = Math.abs(t0 - t1) <= st.zoom.syncMs;
  if (!st.zoom.active && !simultaneous) return false;

  const d = Math.hypot(
    primary.mid.x - secondary.mid.x,
    primary.mid.y - secondary.mid.y,
  );
  if (!d) return true;

  if (!st.zoom.active) {
    st.zoom.active = true;
    st.zoom.startDist = d;
    st.zoom.startValue = st.zoom.value;
    return true;
  }

  const ratio = d / Math.max(1e-6, st.zoom.startDist);

  // ✅ deadzone (2%): ignora micro-ruido del tracking
  if (Math.abs(1 - ratio) < 0.02) return false;

  const next = clamp(st.zoom.startValue * ratio, st.zoom.min, st.zoom.max);

  st.zoom.value = next;
  threeViewer.setZoom(next);
  updateZoomUI(next);

  return true;
}

// ✅ fist: subo umbral (0.030 era demasiado estricto)
function isFist(lm) {
  if (!lm) return false;
  const tips = [8, 12, 16, 20];
  const mcps = [5, 9, 13, 17];

  let sum = 0;
  for (let k = 0; k < 4; k++) {
    const t = lm[tips[k]];
    const m = lm[mcps[k]];
    sum += Math.hypot(t.x - m.x, t.y - m.y);
  }
  const avg = sum / 4;
  return avg < 0.045; // Ajustable: 0.055–0.080
}

// Normalizado -> px (con mirror)
function normToPx(xNorm, yNorm, canvasW, canvasH) {
  const xRaw = xNorm * canvasW;
  const xPx = CONFIG.MIRROR ? canvasW - xRaw : xRaw;
  const yPx = yNorm * canvasH;
  return { xPx, yPx };
}

export function onResults3D(results, { canvasW = 1, canvasH = 1 } = {}) {
  const hands = results?.multiHandLandmarks || [];
  const handedness = results?.multiHandedness || [];

  lastHands = hands;
  lastHandedness = handedness;

  if (!hands.length) {
    resetAll();
    updateHandTrackingHUD([], [], null);
    return;
  }

  // Update hand tracking visualization
  const gestureState = gestureDetector.detectAll(hands, handedness);
  sendGestureIfConfirmed(gestureState, 'viewer3d');
  updateHandTrackingHUD(hands, handedness, gestureState);
  processGestureFeedback(gestureState);

  const now = performance.now();
  const PINCH_THR = 0.035;

  const info = hands.map((lm, i) => {
    const key = getHandKey(handedness, i);
    const state = getOrCreateHandState(key);

    const pinch = dist2(lm[4], lm[8]) < PINCH_THR;
    const mid = midThumbIndex(lm);

    const wasPinching = !!state.pinchActive;

    if (pinch && mid) {
      if (!state.pinchActive) {
        state.pinchActive = true;
        state.pinchStartT = now;
        state.lastMid = { x: mid.x, y: mid.y };
      }
    } else {
      state.pinchActive = false;
      state.pinchStartT = null;
      state.lastMid = null;
    }

    const pinchStart = pinch && !wasPinching;
    const pinchEnd = !pinch && wasPinching;

    return { i, key, lm, pinch, mid, state, pinchStart, pinchEnd };
  });

  const left = info.find((h) => h.key === "Left");
  const right = info.find((h) => h.key === "Right");

  // --- fists edges ---
  st.leftFistPrev = st.leftFistNow;
  st.rightFistPrev = st.rightFistNow;

  st.leftFistNow = !!(left?.lm && isFist(left.lm));
  st.rightFistNow = !!(right?.lm && isFist(right.lm));

  const rightJustClosed = !st.rightFistPrev && st.rightFistNow;
  const leftJustClosed = !st.leftFistPrev && st.leftFistNow;

  // cámara/modelo para AirRuler pegado al modelo
  const camera = threeViewer.getCamera?.();
  const model = threeViewer.getCurrentModel?.();

  // ==========================================================
  // AIR RULER
  // - Puño DERECHA (edge) inicia
  // - Puño IZQUIERDA (edge) fija y sale
  // ==========================================================
  if (rightJustClosed && !airRuler.isActive() && camera && model) {
    airRuler.startNext({ ownerKey: "Right", model, modelMmReference: 150 });
  }
  if (leftJustClosed && airRuler.isActive()) {
    airRuler.freeze();
  }

  // Cursor update (siempre)
  if (right?.mid)
    handCursor.update(
      "Right",
      right.mid.x,
      right.mid.y,
      right.state.pinchActive,
    );
  else if (info[0]?.mid)
    handCursor.update(info[0].key, info[0].mid.x, info[0].mid.y, false);

  // --- AirRuler live update (SIN BLOQUEAR MOVE) ---
  if (airRuler.isActive() && !airRuler.isFrozen()) {
    if (right?.lm && camera && model) {
      const A = normToPx(right.lm[8].x, right.lm[8].y, canvasW, canvasH);
      const B = normToPx(right.lm[4].x, right.lm[4].y, canvasW, canvasH);

      airRuler.updateLiveFromScreen({
        handKey: "Right",
        AxPx: A.xPx,
        AyPx: A.yPx,
        BxPx: B.xPx,
        ByPx: B.yPx,
        canvasW,
        canvasH,
        camera,
        model,
      });
    }
    // ✅ NO return aquí: la fluidez mejora muchísimo
  }

  // =============================
  // UI click por pinch-hold (Back + Prev/Next)
  // =============================
  const PINCH_CLICK_HOLD_MS = 90;

  let uiTargetBtn = null;
  if (right && right.state.pinchActive && right.mid) {
    const px = right.mid.x * canvasW;
    const py = right.mid.y * canvasH;

    // padding interior para evitar activación accidental
    const backBtn = elementAtPinch(px, py, ".btn-back", 10);
    const prevBtn = elementAtPinch(px, py, "#btn-prev", 10);
    const nextBtn = elementAtPinch(px, py, "#btn-next", 10);

    uiTargetBtn = backBtn || prevBtn || nextBtn;

    if (uiTargetBtn) {
      // armamos estado de click SOLO cuando estás dentro de un botón
      if (!pinchClick.active || pinchClick.target !== uiTargetBtn) {
        pinchClick.active = true;
        pinchClick.startT = now;
        pinchClick.fired = false;
        pinchClick.target = uiTargetBtn;
      } else {
        const dt = now - pinchClick.startT;
        if (!pinchClick.fired && dt > PINCH_CLICK_HOLD_MS) {
          pinchClick.fired = true;
          uiTargetBtn.click();
        }
      }
      // si estás clicando UI, NO muevas el modelo (para que no “arrastres” botones)
      // pero tampoco hacemos un return global: simplemente saltamos move/rotate/zoom más abajo
    } else {
      pinchClick.active = false;
      pinchClick.startT = 0;
      pinchClick.fired = false;
      pinchClick.target = null;
    }
  } else {
    pinchClick.active = false;
    pinchClick.startT = 0;
    pinchClick.fired = false;
    pinchClick.target = null;
  }

  // Si estamos sobre UI, no aplicamos gestos al modelo (fluye porque no “corta” el tracking global)
  const blockingModelGesturesBecauseUI = !!uiTargetBtn;

  // =============================
  // Zoom 2 manos (solo si NO estamos en UI y NO está AirRuler activo)
  // =============================
  const blockingZoomBecauseRuler = airRuler.isActive() && !airRuler.isFrozen();
  if (!blockingModelGesturesBecauseUI && !blockingZoomBecauseRuler) {
    const pinching = info
      .filter(
        (h) =>
          h.state.pinchActive &&
          h.mid &&
          h.state.lastMid &&
          h.state.pinchStartT != null,
      )
      .sort((a, b) => a.state.pinchStartT - b.state.pinchStartT);

    const primary = pinching[0] || null;
    const secondary = pinching[1] || null;

    const zooming = tryHandleTwoHandZoom(primary, secondary);
    if (zooming) {
      if (primary?.state?.lastMid && primary?.mid) {
        primary.state.lastMid.x = primary.mid.x;
        primary.state.lastMid.y = primary.mid.y;
      }
      if (secondary?.state?.lastMid && secondary?.mid) {
        secondary.state.lastMid.x = secondary.mid.x;
        secondary.state.lastMid.y = secondary.mid.y;
      }
      return; // zoom real consume el frame (ok)
    } else {
      st.zoom.active = false;
      st.zoom.startDist = null;
    }
  } else {
    // si está bloqueado por UI o Ruler, no mantenemos zoom activo
    st.zoom.active = false;
    st.zoom.startDist = null;
  }

  // =============================
  // Move (Right pinch) - ✅ fluido
  // =============================
  if (!blockingModelGesturesBecauseUI) {
    if (right?.state?.pinchActive && right.mid && right.state.lastMid) {
      let moveDx = (right.mid.x - right.state.lastMid.x) * canvasW;
      let moveDy = (right.mid.y - right.state.lastMid.y) * canvasH;

      // actualiza lastMid
      right.state.lastMid.x = right.mid.x;
      right.state.lastMid.y = right.mid.y;

      // suavizado
      filt.moveDx = smoothDelta(filt.moveDx, moveDx, 0.35);
      filt.moveDy = smoothDelta(filt.moveDy, moveDy, 0.35);
      moveDx = filt.moveDx;
      moveDy = filt.moveDy;

      threeViewer.applyPinchToModel({
        dragDx: moveDx,
        dragDy: moveDy,
        scaleDelta: 0,
        mirrorX: CONFIG.MIRROR,
      });
    }
  }

  // =============================
  // Rotate (Left pinch) con clamp
  // - bloqueamos rotate si AirRuler está activo (para que no interfiera)
  // =============================
  const blockingRotateBecauseRuler =
    airRuler.isActive() && !airRuler.isFrozen();
  if (!blockingModelGesturesBecauseUI && !blockingRotateBecauseRuler) {
    if (left?.state?.pinchActive && left.mid && left.state.lastMid) {
      let rotDx = (left.mid.x - left.state.lastMid.x) * canvasW;
      let rotDy = (left.mid.y - left.state.lastMid.y) * canvasH;

      left.state.lastMid.x = left.mid.x;
      left.state.lastMid.y = left.mid.y;

      // suavizado
      filt.rotDx = smoothDelta(filt.rotDx, rotDx, 0.35);
      filt.rotDy = smoothDelta(filt.rotDy, rotDy, 0.35);
      rotDx = filt.rotDx;
      rotDy = filt.rotDy;

      // clamp final
      rotDx = clamp(rotDx, -MAX_ROT_PX, MAX_ROT_PX);
      rotDy = clamp(rotDy, -MAX_ROT_PX, MAX_ROT_PX);

      threeViewer.applyRotateToModel({
        dragDx: rotDx,
        dragDy: rotDy,
        mirrorX: CONFIG.MIRROR,
      });
    }
  }
}
