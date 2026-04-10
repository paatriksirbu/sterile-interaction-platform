import { setupCanvas, applyMirror } from "../utils/canvas.js";
import { appState } from "../state/state.js";
import { CONFIG } from "../config.js";
import { threeViewer } from "../rendering/threeViewer.js";

import { handCursor, clearOverlay } from "./cursor3d.js";
import { onResults3D, getOverlayHands, getAirRuler } from "./results3d.js";

import { drawAllHands } from "../rendering/hands.js";

const USE_MEDIAPIPE = true;
const SHOW_DEBUG_CUBE = false;

// helper: /src/assets + encode para espacios/acentos
const ASSET = (file) => encodeURI(`/src/assets/${file}`);

// ✅ Playlist de modelos
const MODELS = [
  { label: "Brain ", url: ASSET("Brain_Model.obj"), scale: 1 },
  {
    label: "Bodybuilder ",
    url: ASSET("Bodybuilder_Man_Lores.obj"),
    scale: 0.01,
  },
];

// DOM
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const videoElement = document.querySelector(".input_video");
const workarea = document.getElementById("workarea");
const threeCanvas = document.getElementById("three-canvas");

const depthCanvas = document.getElementById("depthCanvas");
const depthCtx = depthCanvas?.getContext("2d");

const modelLabelEl = document.getElementById("modelLabel");
function updateModelLabel() {
  const info = threeViewer.getCurrentModelInfo?.();
  if (modelLabelEl) modelLabelEl.textContent = info?.label ?? "";
}

// init
setupCanvas(overlay);
appState.init(overlay, ctx, videoElement);
threeViewer.init({ canvas: threeCanvas, container: workarea });

// resize
function resizeToWorkarea() {
  const rect = workarea.getBoundingClientRect();
  overlay.width = Math.floor(rect.width);
  overlay.height = Math.floor(rect.height);
  threeViewer.resize(overlay.width, overlay.height);
}
resizeToWorkarea();
window.addEventListener("resize", resizeToWorkarea);

// load initial
if (SHOW_DEBUG_CUBE) {
  threeViewer.addDebugCube();
  updateModelLabel();
} else {
  threeViewer.setPlaylist(MODELS);
  threeViewer
    .loadModel(MODELS[0])
    .then(updateModelLabel)
    .catch((e) => {
      console.error("Error cargando modelo inicial, fallback a cubo:", e);
      threeViewer.addDebugCube();
      updateModelLabel();
    });
}

// zoom UI
const btnZoomOut = document.getElementById("btn-zoom-out");
const btnZoomIn = document.getElementById("btn-zoom-in");
const zoomIndicator = document.getElementById("zoom-indicator");
const zoomSlider = document.getElementById("zoomSlider");

function updateZoomIndicator() {
  if (!zoomIndicator) return;
  const z = Math.round((appState.currentZoom || 1) * 100);
  zoomIndicator.textContent = `${z}%`;
  threeViewer.setZoom(appState.currentZoom || 1);
}

btnZoomIn?.addEventListener("click", () => {
  appState.currentZoom = Math.min(2, (appState.currentZoom || 1) + 0.1);
  updateZoomIndicator();
});
btnZoomOut?.addEventListener("click", () => {
  appState.currentZoom = Math.max(0.5, (appState.currentZoom || 1) - 0.1);
  updateZoomIndicator();
});
zoomSlider?.addEventListener("input", (e) => {
  appState.currentZoom = Number(e.target.value) / 100;
  updateZoomIndicator();
});
updateZoomIndicator();

// ✅ prev/next + label sincronizado (await)
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");

async function navWithLock(navFn) {
  if (btnPrev) btnPrev.disabled = true;
  if (btnNext) btnNext.disabled = true;
  try {
    await navFn();
    updateModelLabel();
  } catch (e) {
    console.error("Error cambiando modelo:", e);
  } finally {
    if (btnPrev) btnPrev.disabled = false;
    if (btnNext) btnNext.disabled = false;
  }
}

btnPrev?.addEventListener("click", () => navWithLock(() => threeViewer.prev()));
btnNext?.addEventListener("click", () => navWithLock(() => threeViewer.next()));

// overlay
const airRuler = getAirRuler();
function animateOverlay() {
  clearOverlay(ctx, overlay);

  handCursor.draw(ctx, overlay, { mirror: CONFIG.MIRROR });

  airRuler.drawOverlay(ctx, {
    camera: threeViewer.getCamera(),
    model: threeViewer.getCurrentModel(),
    canvasW: overlay.width,
    canvasH: overlay.height,
  });

  requestAnimationFrame(animateOverlay);
}
animateOverlay();

// hands preview
function animateHandsPreview() {
  if (!depthCanvas || !depthCtx) {
    requestAnimationFrame(animateHandsPreview);
    return;
  }

  depthCtx.setTransform(1, 0, 0, 1, 0, 0);
  depthCtx.clearRect(0, 0, depthCanvas.width, depthCanvas.height);

  const { hands, handedness } = getOverlayHands();
  if (hands?.length) {
    depthCtx.save();
    applyMirror(depthCtx, depthCanvas, CONFIG.MIRROR);
    drawAllHands(depthCtx, hands, handedness, depthCanvas);
    depthCtx.restore();
  }

  requestAnimationFrame(animateHandsPreview);
}
animateHandsPreview();

// mediapipe
async function initMediaPipeIfEnabled() {
  if (!USE_MEDIAPIPE) return;
  const { initMediaPipe } = await import("../utils/mediapipeSetup.js");

  function onResults(results) {
    onResults3D(results, { canvasW: overlay.width, canvasH: overlay.height });
  }

  initMediaPipe(videoElement, onResults);
}
initMediaPipeIfEnabled().catch(console.error);

// cleanup
window.addEventListener("beforeunload", () => {
  threeViewer.dispose();
  const stream = videoElement?.srcObject;
  stream?.getTracks().forEach((t) => t.stop());
});
