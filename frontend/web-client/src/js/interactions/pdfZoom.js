import { CONFIG } from "../config.js";
import { appState } from "../state/state.js";
import { pdfManager } from "../objects/pdfManager.js";
import { getThumbIndexPinchPositions } from "../gestures/pinch.js";
import { normToPx } from "../utils/transforms.js";
import { smoothAndPredict } from "../utils/smoothing.js";
import { getFirstPinchPos, pinchToClientInContainer } from "./coordinates.js";
import { interactionState, CLOSED_FIST_COOLDOWN_MS } from "./state.js";

// Referencia a botones
let cachedUiButtons = null;
let lastUiButtonCacheTime = 0;
const UI_BUTTON_CACHE_MS = 1000;

function getCachedUiButtons() {
  const now = Date.now();
  if (!cachedUiButtons || now - lastUiButtonCacheTime > UI_BUTTON_CACHE_MS) {
    cachedUiButtons = {
      zoomIn: document.getElementById("btn-zoom-in"),
      zoomOut: document.getElementById("btn-zoom-out"),
      dashboard: document.getElementById("btn-dashboard"),
      all: document.querySelectorAll(
        "#btn-zoom-in, #btn-zoom-out, #btn-dashboard",
      ),
    };
    lastUiButtonCacheTime = now;
  }
  return cachedUiButtons;
}

// Procesa arrastre de pdf con pinch
export function processPdfInteractions(hands) {
  if (hands.length === 0) return;

  const { canvas } = appState;

  // Bloquear drag si hubo un cambio de página reciente
  const pdfLockMs = CONFIG.INTERACTIONS.OPENHAND.PDF_LOCK_AFTER_PAGE_MS || 400;
  const timeSincePageChange =
    performance.now() - interactionState.lastPageChangeTs;
  if (timeSincePageChange < pdfLockMs) {
    appState.pdf.dragging = false;
    return;
  }

  // 1) Detectar primer pinch activo
  let pinchPos = null;
  for (let i = 0; i < hands.length; i++) {
    const pos = getThumbIndexPinchPositions(hands[i]);
    if (pos) {
      pinchPos = pos;
      break;
    }
  }
  const pinchActive = !!pinchPos;

  // 2) Inicio de pinch → comprobar si cae sobre el PDF
  if (pinchActive && !appState.pinchWasActive) {
    const pinchPx = normToPx(pinchPos.x, pinchPos.y, canvas);
    const pinchVisX = CONFIG.MIRROR ? canvas.width - pinchPx.x : pinchPx.x;
    const pinchVisY = pinchPx.y;

    if (pdfManager.isPointOnPdf(pinchVisX, pinchVisY, canvas)) {
      appState.pdf.dragging = true;
      interactionState.activeDragContext = "pdf";

      const pdfCenterPx = normToPx(
        pdfManager.center.x,
        pdfManager.center.y,
        canvas,
      );
      appState.pdf.offsetPx = {
        dx: pdfCenterPx.x - pinchVisX,
        dy: pdfCenterPx.y - pinchVisY,
      };
    } else {
      appState.pdf.dragging = false;
    }
  } else if (!pinchActive) {
    appState.pdf.dragging = false;
    if (interactionState.activeDragContext === "pdf")
      interactionState.activeDragContext = null;
  }
  appState.pinchWasActive = pinchActive;

  // 3) Arrastre en curso
  if (
    appState.pdf.dragging &&
    pinchActive &&
    interactionState.activeDragContext === "pdf"
  ) {
    const pinchPx = normToPx(pinchPos.x, pinchPos.y, canvas);
    const pinchVisX = CONFIG.MIRROR ? canvas.width - pinchPx.x : pinchPx.x;
    const pinchVisY = pinchPx.y;

    const newCenterPx = {
      x: pinchVisX + (appState.pdf.offsetPx?.dx || 0),
      y: pinchVisY + (appState.pdf.offsetPx?.dy || 0),
    };

    const newCenterNorm = {
      x: newCenterPx.x / canvas.width,
      y: newCenterPx.y / canvas.height,
    };

    const smoothedPos = smoothAndPredict(
      "pdf-center",
      newCenterNorm,
      CONFIG.SMOOTHING.ALPHA,
      CONFIG.SMOOTHING.PREDICT,
    );

    pdfManager.center = pdfManager.clampCenter(smoothedPos, canvas);
    appState.pdf.center = { ...pdfManager.center };
  }

  // Legacy flags apagados
  appState.sphericalDragging = false;
  appState.sphericalWasActive = false;
  appState.activeSquareId = null;
}

/* ============================================================
    ZOOM — Solo dos índices extendidos
    ============================================================ */

// Devuelve true si el dedo índice de esta mano está extendido.
export function isIndexExtended(hand) {
  const wrist = hand[0];
  const indexMCP = hand[5];
  const indexTip = hand[8];
  if (!wrist || !indexMCP || !indexTip) return false;

  const tipDist = Math.hypot(
    indexTip.x - wrist.x,
    indexTip.y - wrist.y,
    (indexTip.z || 0) - (wrist.z || 0),
  );
  const mcpDist = Math.hypot(
    indexMCP.x - wrist.x,
    indexMCP.y - wrist.y,
    (indexMCP.z || 0) - (wrist.z || 0),
  );

  return tipDist > mcpDist * 1.6;
}

// Aplica un paso de zoom.
function _applyZoomStep(levelIndex, midNorm, canvas) {
  const appEl = document.getElementById("app") || document.body;
  const client = pinchToClientInContainer(midNorm, appEl, CONFIG.MIRROR);
  const crect = canvas.getBoundingClientRect();
  let cx = (client.clientX - crect.left) / crect.width;
  let cy = (client.clientY - crect.top) / crect.height;
  if (CONFIG.MIRROR) cx = 1 - cx;

  pdfManager.center = {
    x: Math.max(0, Math.min(1, cx)),
    y: Math.max(0, Math.min(1, cy)),
  };
  appState.currentZoom = CONFIG.INTERACTIONS.ZOOM.LEVELS[levelIndex];

  const zi = document.getElementById("zoom-indicator");
  if (zi) zi.textContent = `${Math.round(appState.currentZoom * 100)}%`;
}

// Procesa zoom con dos índices extendidos.
export function processZoomGestures(hands, gestureState) {
  if (!hands || hands.length < 2) {
    interactionState.zoomActive = false;
    interactionState.zoomInitialDistance = null;
    interactionState.zoomInitialLevelIndex = null;
    return;
  }

  const canvas = appState.canvas;
  if (!canvas) return;

  const h0 = hands[0];
  const h1 = hands[1];

  // Obtener las puntas de los índices (landmark 8)
  const idx0 = h0[8];
  const idx1 = h1[8];

  if (!idx0 || !idx1) {
    interactionState.zoomActive = false;
    interactionState.zoomInitialDistance = null;
    interactionState.zoomInitialLevelIndex = null;
    return;
  }

  const dist = Math.hypot(idx0.x - idx1.x, idx0.y - idx1.y);

  // Distancia mínima para activar zoom (evita activación accidental)
  const MIN_ACTIVATION_DIST = 0.1;
  if (dist < MIN_ACTIVATION_DIST) {
    interactionState.zoomActive = false;
    interactionState.zoomInitialDistance = null;
    interactionState.zoomInitialLevelIndex = null;
    return;
  }

  const mid = { x: (idx0.x + idx1.x) / 2, y: (idx0.y + idx1.y) / 2 };

  // Primera vez que se activa el gesto
  if (!interactionState.zoomActive) {
    interactionState.zoomActive = true;
    interactionState.zoomInitialDistance = dist;
    const cur = appState.currentZoom || 1.0;
    let closest = 0,
      bestDiff = Infinity;
    for (let i = 0; i < CONFIG.INTERACTIONS.ZOOM.LEVELS.length; i++) {
      const d = Math.abs(CONFIG.INTERACTIONS.ZOOM.LEVELS[i] - cur);
      if (d < bestDiff) {
        bestDiff = d;
        closest = i;
      }
    }
    interactionState.zoomInitialLevelIndex = closest;
    interactionState.lastZoomChangeTs = performance.now();
    return;
  }

  const ratio = dist / (interactionState.zoomInitialDistance || 1);
  const now = performance.now();
  const cooldown = CONFIG.INTERACTIONS.ZOOM.THROTTLE_MS;
  const stepRatio = CONFIG.INTERACTIONS.ZOOM.STEP_RATIO;

  if (
    ratio > 1 + stepRatio &&
    now - interactionState.lastZoomChangeTs > cooldown
  ) {
    const nextIndex = Math.min(
      CONFIG.INTERACTIONS.ZOOM.LEVELS.length - 1,
      interactionState.zoomInitialLevelIndex + 1,
    );
    if (nextIndex !== interactionState.zoomInitialLevelIndex) {
      interactionState.zoomInitialLevelIndex = nextIndex;
      interactionState.zoomInitialDistance = dist;
      interactionState.lastZoomChangeTs = now;
      _applyZoomStep(nextIndex, mid, canvas);
    }
  } else if (
    ratio < 1 - stepRatio &&
    now - interactionState.lastZoomChangeTs > cooldown
  ) {
    const nextIndex = Math.max(0, interactionState.zoomInitialLevelIndex - 1);
    if (nextIndex !== interactionState.zoomInitialLevelIndex) {
      interactionState.zoomInitialLevelIndex = nextIndex;
      interactionState.zoomInitialDistance = dist;
      interactionState.lastZoomChangeTs = now;
      _applyZoomStep(nextIndex, mid, canvas);
    }
  }
}

/* ============================================================
    UI PINCH CLICK (botones zoom in/out)
    ============================================================ */

// Procesa clicks en botones de UI con pinch.
export function processUiPinchClicks(hands, gestureState) {
  const viewportEl = document.body;
  const pinchPos = getFirstPinchPos(hands);
  const pinchActive = !!pinchPos;
  const margin = CONFIG.UI?.BUTTON_HIT_MARGIN_PX || 48;

  const buttons = getCachedUiButtons();

  if (!pinchActive) {
    interactionState.prevUiPinchActive = false;
    buttons.all.forEach((b) => b?.classList?.remove("pinch-hover"));
    return;
  }

  const { clientX, clientY } = pinchToClientInContainer(
    pinchPos,
    viewportEl,
    CONFIG.MIRROR,
  );

  const btnIn = buttons.zoomIn;
  const btnOut = buttons.zoomOut;
  const btnDashboard = buttons.dashboard;

  function pointInExpandedRect(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      clientX >= r.left - margin &&
      clientX <= r.right + margin &&
      clientY >= r.top - margin &&
      clientY <= r.bottom + margin
    );
  }

  // Hover visual
  buttons.all.forEach((btn) => {
    if (pointInExpandedRect(btn)) {
      btn.classList.add("pinch-hover");
    } else {
      btn.classList.remove("pinch-hover");
    }
  });

  if (pinchActive && !interactionState.prevUiPinchActive) {
    if (btnIn && pointInExpandedRect(btnIn)) btnIn.click();
    if (btnOut && pointInExpandedRect(btnOut)) btnOut.click();
    if (btnDashboard && pointInExpandedRect(btnDashboard)) {
      window.location.href = "dashboard.html";
    }
    interactionState.prevUiPinchActive = true;
  }

  processUiDwellOpenHand(hands, gestureState);
}

// Procesa dwell con mano abierta sobre botones.
function processUiDwellOpenHand(hands, gestureState) {
  const buttons = getCachedUiButtons();

  if (!gestureState || !gestureState.openHand?.confirmed) {
    interactionState.dwellTargetId = null;
    interactionState.dwellStartTs = 0;
    buttons.all.forEach((b) => b?.classList?.remove("dwell-active"));
    return;
  }

  const palm = gestureState.openHand.palmCenter;
  if (!palm) return;

  const viewportEl = document.body;
  const { clientX, clientY } = pinchToClientInContainer(
    palm,
    viewportEl,
    CONFIG.MIRROR,
  );

  const btnIn = buttons.zoomIn;
  const btnOut = buttons.zoomOut;
  const btnDashboard = buttons.dashboard;
  const margin = CONFIG.UI?.BUTTON_HIT_MARGIN_PX || 48;

  function hit(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      clientX >= r.left - margin &&
      clientX <= r.right + margin &&
      clientY >= r.top - margin &&
      clientY <= r.bottom + margin
    );
  }

  let target = null;
  if (hit(btnIn)) target = "btn-zoom-in";
  else if (hit(btnOut)) target = "btn-zoom-out";
  else if (hit(btnDashboard)) target = "btn-dashboard";

  const now = performance.now();
  if (target) {
    if (interactionState.dwellTargetId !== target) {
      interactionState.dwellTargetId = target;
      interactionState.dwellStartTs = now;
      buttons.all.forEach((b) => b?.classList?.remove("dwell-active"));
      const el = document.getElementById(interactionState.dwellTargetId);
      if (el) el.classList.add("dwell-active");
    } else {
      const elapsed = now - interactionState.dwellStartTs;
      if (elapsed >= (CONFIG.UI?.DWELL_MS || 800)) {
        const el = document.getElementById(interactionState.dwellTargetId);
        // Para el botón dashboard, navegar en lugar de click
        if (target === "btn-dashboard") {
          window.location.href = "dashboard.html";
        } else if (el) {
          el.click();
        }
        interactionState.dwellTargetId = null;
        interactionState.dwellStartTs = 0;
        buttons.all.forEach((b) => b?.classList?.remove("dwell-active"));
      }
    }
  } else {
    interactionState.dwellTargetId = null;
    interactionState.dwellStartTs = 0;
    buttons.all.forEach((b) => b?.classList?.remove("dwell-active"));
  }
}

/* ============================================================
    CLOSED FIST → Toggle Maximizar
    ============================================================ */

export function showGestureFeedback(icon, label) {
  const gestureValue = document.getElementById("gesture-value");
  if (gestureValue) {
    const originalText = gestureValue.textContent;
    const originalColor = gestureValue.style.color;
    gestureValue.textContent = `${icon} ${label}`;
    gestureValue.style.color = "#4CAF50";
    setTimeout(() => {
      gestureValue.textContent = originalText;
      gestureValue.style.color = originalColor;
    }, 1000);
  }
}

// Detecta gesto de puño cerrado y hace toggle de maximizar.
export function processClosedFistMaximize(gestureState) {
  if (!gestureState) return;

  const closedFistConfirmed =
    gestureState.anyClosedFist || gestureState.closedFist?.confirmed;
  const now = performance.now();

  if (closedFistConfirmed) {
    interactionState.lastClosedFistDetectedTs = now;

    const isNewGesture =
      !interactionState.closedFistActiveSession &&
      now - interactionState.lastClosedFistToggleTs > CLOSED_FIST_COOLDOWN_MS;

    if (isNewGesture) {
      // Iniciar nueva sesión y hacer toggle
      interactionState.closedFistActiveSession = true;

      if (typeof window.toggleMaximize === "function") {
        window.toggleMaximize();
        interactionState.lastClosedFistToggleTs = now;
        showGestureFeedback("✔", "Maximize Toggle");
      }
    }
  } else {
    // No se detecta closed fist en este frame
    // Solo terminar la sesión si ha pasado el tiempo de histéresis
    const timeSinceLastDetection =
      now - interactionState.lastClosedFistDetectedTs;

    if (timeSinceLastDetection > interactionState.closedFistHysteresisMs) {
      interactionState.closedFistActiveSession = false;
    }
  }

  interactionState.prevClosedFistConfirmed = closedFistConfirmed;
}
