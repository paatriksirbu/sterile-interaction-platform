import { CONFIG } from "../config.js";

const CLICK_COOLDOWN_MS = 350;
let lastClickAt = 0;

const SMOOTH_ALPHA = 0.22;
let sx = null,
  sy = null;

function smooth(x, y) {
  if (sx === null || sy === null) {
    sx = x;
    sy = y;
    return { x, y };
  }
  sx = sx + SMOOTH_ALPHA * (x - sx);
  sy = sy + SMOOTH_ALPHA * (y - sy);
  return { x: sx, y: sy };
}

function resetSmoothing() {
  sx = null;
  sy = null;
}

function getThumbIndexMidpoint(handLandmarks) {
  const t = handLandmarks?.[4];
  const i = handLandmarks?.[8];
  if (!t || !i) return null;
  return { x: (t.x + i.x) * 0.5, y: (t.y + i.y) * 0.5, z: (t.z + i.z) * 0.5 };
}

const DWELL_MS = 300;
let dwellStart = null;
let prevDwellConfirmed = false;

function showCursor(
  x,
  y,
  { arming = false, progress = 0, confirmed = false } = {},
) {
  const cursor = document.getElementById("pinch-cursor");
  if (!cursor) return;

  cursor.style.opacity = "1";
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
  cursor.classList.add("show");
  cursor.style.setProperty("--p", String(progress));
  cursor.classList.toggle("arming", arming);
  cursor.classList.toggle("confirmed", confirmed);
}

function hideCursor() {
  const cursor = document.getElementById("pinch-cursor");
  if (!cursor) return;

  cursor.classList.remove("show", "arming", "confirmed");
  cursor.style.left = `-9999px`;
  cursor.style.top = `-9999px`;
  cursor.style.setProperty("--p", "0");
}

// Callbacks for actions
let actionCallbacks = {
  onStepSelect: null,
  onStepComplete: null,
  onChecklistToggle: null,
  onViewPresetSelect: null,
  onZoom: null,
  onNavigate: null,
  onBack: null,
  onRotateModel: null,
  onMicToggle: null,
  onExpandNotes: null,
  onCloseModal: null,
};

export function setActionCallbacks(callbacks) {
  actionCallbacks = { ...actionCallbacks, ...callbacks };
}

// Cache interactivo para evitar consultas repetidas
let cachedInteractiveElements = null;
let lastCacheTime = 0;
const CACHE_REFRESH_MS = 500;

function getInteractiveElements() {
  const now = Date.now();
  if (!cachedInteractiveElements || now - lastCacheTime > CACHE_REFRESH_MS) {
    cachedInteractiveElements = document.querySelectorAll(
      ".step-item, .nav-btn, .checklist-item, .preset-btn, .ctrl-btn, .zoom-btn, .btn-back, .mic-btn, .expand-btn, .modal-close, .modal-record-btn, .modal-note-actions button",
    );
    lastCacheTime = now;
  }
  return cachedInteractiveElements;
}

export function processSurgicalPlanGestures(hands, gestureState) {
  const interactiveElements = getInteractiveElements();

  if (!hands?.length) {
    interactiveElements.forEach((el) => el.classList.remove("hover"));
    hideCursor();
    resetSmoothing();
    dwellStart = null;
    prevDwellConfirmed = false;
    return;
  }

  // Mano dominante
  let idx = 0;
  if (gestureState?.hands?.length) {
    const c = gestureState.hands.findIndex((h) => h?.pinch?.confirmed);
    if (c >= 0 && hands[c]) idx = c;
    else {
      const d = gestureState.hands.findIndex((h) => h?.pinch?.detected);
      if (d >= 0 && hands[d]) idx = d;
    }
  }

  const hand = hands[idx];
  const mid = getThumbIndexMidpoint(hand);
  if (!mid) {
    hideCursor();
    return;
  }

  const rawX = CONFIG.MIRROR ? 1 - mid.x : mid.x;
  const rawY = mid.y;
  const { x: scrX, y: scrY } = smooth(
    rawX * window.innerWidth,
    rawY * window.innerHeight,
  );

  const pinchInfo = gestureState?.hands?.[idx]?.pinch ?? {};
  const isPinching = pinchInfo.detected || pinchInfo.confirmed;

  showCursor(scrX, scrY, {
    arming: isPinching && !pinchInfo.confirmed,
    progress: 0,
    confirmed: pinchInfo.confirmed,
  });

  interactiveElements.forEach((el) => el.classList.remove("hover"));

  const targetEl = document.elementFromPoint(scrX, scrY);
  const interactiveTarget = targetEl?.closest(
    ".step-item, .nav-btn, .checklist-item, .preset-btn, .ctrl-btn, .zoom-btn, .btn-back, .mic-btn, .expand-btn, .modal-close, .modal-record-btn, .modal-note-actions button",
  );

  if (interactiveTarget) {
    interactiveTarget.classList.add("hover");

    if (isPinching) {
      if (!dwellStart) {
        dwellStart = Date.now();
      } else {
        const elapsed = Date.now() - dwellStart;
        const progress = Math.min(1, elapsed / DWELL_MS);
        showCursor(scrX, scrY, {
          arming: true,
          progress,
          confirmed: progress >= 1,
        });

        if (progress >= 1 && !prevDwellConfirmed) {
          prevDwellConfirmed = true;

          const now = Date.now();
          if (now - lastClickAt > CLICK_COOLDOWN_MS) {
            lastClickAt = now;
            triggerAction(interactiveTarget);
          }
        }
      }
    } else {
      dwellStart = null;
      prevDwellConfirmed = false;
    }
  } else {
    dwellStart = null;
    prevDwellConfirmed = false;
  }
}

function triggerAction(element) {
  if (element.classList.contains("step-item")) {
    const stepId = parseInt(element.dataset.stepId, 10);
    actionCallbacks.onStepSelect?.(stepId);
  } else if (element.classList.contains("nav-btn")) {
    const action = element.dataset.action;
    if (action === "complete") actionCallbacks.onStepComplete?.();
    else if (action === "prev") actionCallbacks.onNavigate?.("prev");
    else if (action === "next") actionCallbacks.onNavigate?.("next");
  } else if (element.classList.contains("checklist-item")) {
    const checkId = parseInt(element.dataset.checkId, 10);
    actionCallbacks.onChecklistToggle?.(checkId);
  } else if (element.classList.contains("preset-btn")) {
    const view = element.dataset.view;
    actionCallbacks.onViewPresetSelect?.(view);
  } else if (element.classList.contains("zoom-btn")) {
    const isZoomIn = element.id === "btn-zoom-in";
    actionCallbacks.onZoom?.(isZoomIn ? "in" : "out");
  } else if (element.classList.contains("ctrl-btn")) {
    if (element.id === "btn-reset-view")
      actionCallbacks.onViewPresetSelect?.("front");
    else if (element.id === "btn-toggle-wireframe")
      element.classList.toggle("active");
    else if (element.id === "btn-toggle-labels")
      element.classList.toggle("active");
  } else if (
    element.classList.contains("btn-back") ||
    element.id === "btn-back"
  ) {
    actionCallbacks.onBack?.();
  } else if (
    element.classList.contains("mic-btn") ||
    element.classList.contains("modal-record-btn")
  ) {
    actionCallbacks.onMicToggle?.(element);
  } else if (element.classList.contains("expand-btn")) {
    actionCallbacks.onExpandNotes?.();
  } else if (element.classList.contains("modal-close")) {
    actionCallbacks.onCloseModal?.();
  } else if (element.closest(".modal-note-actions")) {
    element.click();
  }

  element.style.transform = "scale(0.95)";
  setTimeout(() => {
    element.style.transform = "";
  }, 100);
}

let swipeState = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };

export function processSwipeGesture(hands, gestureState) {
  if (!hands?.length) {
    swipeState.active = false;
    return null;
  }

  const handInfo = gestureState?.hands?.[0];
  // Solo permite rotar mientras se hace el pinch
  const isPinching = handInfo?.pinch?.detected || handInfo?.pinch?.confirmed;

  if (!isPinching) {
    swipeState.active = false;
    return null;
  }

  const hand = hands[0];
  const thumbTip = hand?.[4];
  const indexTip = hand?.[8];
  if (!thumbTip || !indexTip) return null;

  const midX = (thumbTip.x + indexTip.x) / 2;
  const midY = (thumbTip.y + indexTip.y) / 2;

  const x = CONFIG.MIRROR ? 1 - midX : midX;
  const y = midY;

  if (!swipeState.active) {
    swipeState = { active: true, startX: x, startY: y, lastX: x, lastY: y };
    return null;
  }

  const deltaX = (x - swipeState.lastX) * 3;
  const deltaY = (y - swipeState.lastY) * 3;

  swipeState.lastX = x;
  swipeState.lastY = y;

  if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
    return { deltaX, deltaY };
  }

  return null;
}
