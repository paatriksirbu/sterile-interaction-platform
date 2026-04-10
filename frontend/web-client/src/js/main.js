import { setupCanvas } from "./utils/canvas.js";
import { CONFIG } from "./config.js";
import { initMediaPipe } from "./utils/mediapipeSetup.js";
import { onResults, initCanvasClickListeners } from "./handlers/results.js";
import { appState } from "./state/state.js";
import { pdfManager } from "./objects/pdfManager.js";
import { annotationManager } from "./objects/annotationManager.js";
import { speechAnnotation } from "./services/speechAnnotation.js";

// 1) Referencias DOM
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const videoElement = document.querySelector(".input_video");
const workarea = document.getElementById("workarea");

// 2) Inicializar canvas (base) + estado
setupCanvas(canvas);
appState.init(canvas, ctx, videoElement);

// 3) Inicializar click listeners del canvas (para panel de anotaciones)
initCanvasClickListeners(canvas);

// 4) Ajustar el canvas exactamente al área de trabajo central
function resizeCanvasToWorkarea() {
  const rect = workarea.getBoundingClientRect();
  // Importante: usar enteros para evitar borrosidad
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
}
resizeCanvasToWorkarea();
window.addEventListener("resize", resizeCanvasToWorkarea);

// 5) Cargar PDF (ajusta la ruta a tu documento real)
pdfManager
  .load("../assets/Moore_Anatomia_con_orientacion_clinica_7 (1).pdf")
  .then(updatePageIndicator);

// 6) Inicializar MediaPipe (manos)
initMediaPipe(videoElement, onResults);

// 7) Columna 3: navegación por páginas (scroll + botones)
const pager = document.getElementById("pager");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const pageIndicator = document.getElementById("page-indicator");
const railPage = document.querySelector("#scroll-rail .page");
const railOf = document.querySelector("#scroll-rail .of");
const railHandle = document.querySelector("#scroll-rail .scroll-handle");
// Zoom controls (DOM)
const btnZoomOut = document.getElementById("btn-zoom-out");
const btnZoomIn = document.getElementById("btn-zoom-in");
const zoomIndicator = document.getElementById("zoom-indicator");

function updateZoomIndicator() {
  if (!zoomIndicator) return;
  const z = Math.round((appState.currentZoom || 1) * 100);
  zoomIndicator.textContent = `${z}%`;
}

// Exponer funciones globales para controles de zoom
window.appState = appState;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.updateZoomIndicator = updateZoomIndicator;

function setZoomToLevelIndex(index) {
  const levels = CONFIG.INTERACTIONS.ZOOM.LEVELS || [1.0];
  const idx = Math.max(0, Math.min(levels.length - 1, index));
  appState.currentZoom = levels[idx];
  updateZoomIndicator();
}

function zoomIn() {
  const levels = CONFIG.INTERACTIONS.ZOOM.LEVELS;
  const cur = appState.currentZoom || 1.0;
  let idx = levels.findIndex((l) => l === cur);
  if (idx === -1) {
    // selecciona el más cercano
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < levels.length; i++) {
      const d = Math.abs(levels[i] - cur);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    idx = best;
  }
  setZoomToLevelIndex(idx + 1);
}

function zoomOut() {
  const levels = CONFIG.INTERACTIONS.ZOOM.LEVELS;
  const cur = appState.currentZoom || 1.0;
  let idx = levels.findIndex((l) => l === cur);
  if (idx === -1) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < levels.length; i++) {
      const d = Math.abs(levels[i] - cur);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    idx = best;
  }
  setZoomToLevelIndex(idx - 1);
}

if (btnZoomIn)
  btnZoomIn.addEventListener("click", () => {
    zoomIn();
  });
if (btnZoomOut)
  btnZoomOut.addEventListener("click", () => {
    zoomOut();
  });
updateZoomIndicator();

function setRailHandlePosition(pageIndex) {
  const total = pdfManager.pageCount || 1;
  if (!railHandle) return;
  let pct = 0;
  if (total > 1) {
    pct = (pageIndex - 1) / (total - 1);
  }
  // Mover el control visual (centrado)
  railHandle.style.top = `${pct * 100}%`;
  railHandle._currentPct = pct;
}

function updatePageIndicator() {
  const total = pdfManager.pageCount || "—";
  const curr = pdfManager.pageNum || "—";
  if (pageIndicator) pageIndicator.textContent = `${curr} / ${total}`;
  if (railPage) railPage.textContent = `PAGE ${curr}`;
  if (railOf) railOf.textContent = `OF ${total}`;
  // Actualizar posición del control del rail si tenemos un número válido de página actual y total
  if (typeof curr === "number" && typeof pdfManager.pageCount === "number") {
    setRailHandlePosition(curr);
  }
  if (pageIndicator) pageIndicator.textContent = `${curr} / ${total}`;
  if (railPage) railPage.textContent = `PAGE ${curr}`;
  if (railOf) railOf.textContent = `OF ${total}`;
  // Actualizar posición del control del rail si tenemos un número válido de página actual y total
  if (typeof curr === "number" && typeof pdfManager.pageCount === "number") {
    setRailHandlePosition(curr);
  }
}

let wheelCooldown = false;
if (pager) {
  pager.addEventListener(
    "wheel",
    async (e) => {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;

      try {
        if (e.deltaY > 0) await pdfManager.nextPage();
        else await pdfManager.prevPage();
        updatePageIndicator();
      } finally {
        setTimeout(() => (wheelCooldown = false), 220); // anti-rebote
      }
    },
    { passive: false },
  );
}

if (btnPrev)
  btnPrev.addEventListener("click", async () => {
    await pdfManager.prevPage();
    updatePageIndicator();
  });
if (btnNext)
  btnNext.addEventListener("click", async () => {
    await pdfManager.nextPage();
    updatePageIndicator();
  });

// ============================================================
// 8) Listener para actualización del contador de anotaciones
// ============================================================
annotationManager.addListener((event, data) => {
  // El contador ahora se muestra en el panel del canvas
  console.log(`Annotation ${event}:`, data);
});

// Exponer annotationManager para debugging
window.annotationManager = annotationManager;

// Exponer speechAnnotation para debugging y control manual
window.speechAnnotation = speechAnnotation;

// ============================================================
// 9) Control de Maximizar/Minimizar documento
// ============================================================
const btnMaximize = document.getElementById("btn-maximize");
let isMaximized = false;

function toggleMaximize() {
  isMaximized = !isMaximized;
  document.body.classList.toggle("maximized", isMaximized);

  // Actualizar botón
  if (btnMaximize) {
    btnMaximize.classList.toggle("is-maximized", isMaximized);
    const label = btnMaximize.querySelector(".max-label");
    const icon = btnMaximize.querySelector(".max-icon");
    if (label) label.textContent = isMaximized ? "Minimize" : "Maximize";
    if (icon) icon.textContent = isMaximized ? "⛶" : "⛶";
  }

  // Redimensionar canvas después de cambiar el layout
  setTimeout(() => {
    resizeCanvasToWorkarea();
    // Re-centrar el PDF
    pdfManager.center = { x: 0.5, y: 0.5 };
  }, 50);

  console.log(`📐 Documento ${isMaximized ? "maximizado" : "minimizado"}`);
}

// Event listener para el botón
if (btnMaximize) {
  btnMaximize.addEventListener("click", toggleMaximize);
}

// Atajo de teclado: F11 o Escape para toggle
document.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    toggleMaximize();
  } else if (e.key === "Escape" && isMaximized) {
    toggleMaximize();
  }
});

// Exponer función para uso por gestos
window.toggleMaximize = toggleMaximize;
window.isMaximized = () => isMaximized;

console.log("✅ Aplicación iniciada correctamente con layout 3 columnas");
