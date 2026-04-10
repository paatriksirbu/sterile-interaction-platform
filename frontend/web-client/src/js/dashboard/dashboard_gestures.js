import { pinchToClientInContainer } from "../interactions/coordinates.js";
import { CONFIG } from "../config.js";
import { triggerDashboardAction } from "./dashboard.js";

const CLICK_COOLDOWN_MS = 350;
let lastClickAt = 0;

// =======================
// Smoothing (anti-jitter)
// =======================
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

// =======================
// ✅ Midpoint pulgar-índice SIEMPRE
// =======================
function getThumbIndexMidpoint(handLandmarks) {
  const t = handLandmarks?.[4]; // thumb tip
  const i = handLandmarks?.[8]; // index tip
  if (!t || !i) return null;
  return { x: (t.x + i.x) * 0.5, y: (t.y + i.y) * 0.5, z: (t.z + i.z) * 0.5 };
}

// =======================
// Dwell (delay pinch 300ms)
// =======================
const DWELL_MS = 300;
let dwellStart = null;
let prevDwellConfirmed = false;

// =======================
// Cursor helpers
// =======================
function showCursor(
  x,
  y,
  { arming = false, progress = 0, confirmed = false } = {},
) {
  const cursor = document.getElementById("pinch-cursor");
  if (!cursor) return;

  cursor.style.opacity = ""; // evita inline opacity roto
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

  cursor.classList.add("show");

  // progreso 0..1
  cursor.style.setProperty("--p", String(progress));

  // clases de estado
  cursor.classList.toggle("arming", arming);
  cursor.classList.toggle("confirmed", confirmed);
}

function hideCursor() {
  const cursor = document.getElementById("pinch-cursor");
  if (!cursor) return;

  cursor.classList.remove("show", "arming", "confirmed");
  cursor.style.left = `-9999px`;
  cursor.style.top = `-9999px`;
  cursor.style.opacity = "";
  cursor.style.setProperty("--p", "0");
}

// Cache para mejorar rendimiento
let cachedTiles = null;
let lastTileCacheTime = 0;
const TILE_CACHE_MS = 500;

function getTiles() {
  const now = Date.now();
  if (!cachedTiles || now - lastTileCacheTime > TILE_CACHE_MS) {
    cachedTiles = document.querySelectorAll(".tile");
    lastTileCacheTime = now;
  }
  return cachedTiles;
}

// =======================
// Main processing
// =======================
export function processDashboardGestures(hands, gestureState) {
  const tiles = getTiles();

  if (!hands?.length) {
    tiles.forEach((t) => t.classList.remove("hover"));
    hideCursor();
    resetSmoothing();
    dwellStart = null;
    prevDwellConfirmed = false;
    return;
  }

  // Mano prioritaria (si el detector da info)
  let idx = 0;
  if (gestureState?.hands?.length) {
    const c = gestureState.hands.findIndex((h) => h?.pinch?.confirmed);
    if (c >= 0 && hands[c]) idx = c;
    else {
      const d = gestureState.hands.findIndex((h) => h?.pinch?.detected);
      if (d >= 0 && hands[d]) idx = d;
    }
  }

  const pinchState = gestureState?.hands?.[idx]?.pinch ?? {
    detected: false,
    confirmed: false,
  };
  const detected = !!pinchState.detected;

  // Cursor position (midpoint)
  const mid = getThumbIndexMidpoint(hands[idx]);
  if (!mid) {
    tiles.forEach((t) => t.classList.remove("hover"));
    hideCursor();
    resetSmoothing();
    dwellStart = null;
    prevDwellConfirmed = false;
    return;
  }

  const { clientX, clientY } = pinchToClientInContainer(
    mid,
    document.body,
    CONFIG.MIRROR,
  );
  const p = smooth(clientX, clientY);

  // -----------------------
  // ✅ DWELL LOGIC (300ms)
  // -----------------------
  const now = performance.now();
  let progress = 0;
  let dwellConfirmed = false;

  if (detected) {
    if (dwellStart === null) dwellStart = now;
    progress = Math.min((now - dwellStart) / DWELL_MS, 1);
    dwellConfirmed = progress >= 1;
  } else {
    dwellStart = null;
    progress = 0;
    dwellConfirmed = false;
  }

  // Mostrar cursor siempre con mano
  showCursor(p.x, p.y, {
    arming: detected && !dwellConfirmed,
    progress,
    confirmed: dwellConfirmed,
  });

  // Hover tiles
  let hovered = null;
  tiles.forEach((tile) => {
    const r = tile.getBoundingClientRect();
    const inside =
      p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
    tile.classList.toggle("hover", inside);
    if (inside) hovered = tile.dataset.action || null;
  });

  // Click por flanco + cooldown usando dwellConfirmed (no el confirmed del detector)
  const risingEdge = !prevDwellConfirmed && dwellConfirmed === true;
  const canClick = now - lastClickAt > CLICK_COOLDOWN_MS;

  if (hovered && risingEdge && canClick) {
    triggerDashboardAction(hovered);
    lastClickAt = now;
  }

  prevDwellConfirmed = dwellConfirmed;
}





