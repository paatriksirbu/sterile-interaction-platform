import { initMediaPipe } from "../utils/mediapipeSetup.js";
import { setupCanvas } from "../utils/canvas.js";
import { videoState } from "./videoState.js";
import { videoPlayer } from "./videoPlayer.js";
import { onVideoResults } from "./videoResults.js";
import { initVideoUI } from "./videoUI.js";

// ============================================================
//    INICIALIZACIÓN
// ============================================================

// Referencias DOM
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const videoElement = document.querySelector(".input_video");
const workarea = document.getElementById("workarea");
const mainVideo = document.getElementById("main-video");

// Inicializar canvas
setupCanvas(canvas);

// Inicializar estado
videoState.init(canvas, ctx, videoElement, mainVideo);

// Ajustar canvas a toda la pantalla (fixed overlay)
function resizeCanvasToWorkarea() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvasToWorkarea();
window.addEventListener("resize", resizeCanvasToWorkarea);

// Inicializar UI y controles
initVideoUI();

// Inicializar el reproductor de video
videoPlayer.init(mainVideo);

// Cargar videos disponibles en assets/videos
const demoVideos = [
  {
    name: "Vendaje Esguince Tobillo",
    path: "../assets/videos/Video_vendaje_tobillo.mp4",
  },
];
videoPlayer.setLocalVideos(demoVideos);

// Inicializar MediaPipe
initMediaPipe(videoElement, onVideoResults);
const btnMaximize = document.getElementById("btn-fullscreen");
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
  }, 50);

  console.log(`📐 Documento ${isMaximized ? "maximizado" : "minimizado"}`);
}

if (btnMaximize) btnMaximize.addEventListener("click", toggleMaximize);

// Exponer funciones globales para debug
window.videoPlayer = videoPlayer;
window.videoState = videoState;
window.toggleMaximize = toggleMaximize;
window.isMaximized = () => isMaximized;

console.log("🎬 Video Feed initialized with gesture control");
