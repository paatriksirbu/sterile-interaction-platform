/**
 * Video UI - Inicialización de la interfaz de usuario
 * Maneja event listeners y controles manuales
 * @module videoFeed/videoUI
 */

import { videoState } from "./videoState.js";
import { videoPlayer } from "./videoPlayer.js";

/**
 * Inicializa todos los controles de UI
 */
export function initVideoUI() {
  initVideoControls();
  initTabSwitcher();
  initVideoSelector();
  initProgressBar();
  initDashboardButton();
  initKeyboardShortcuts();

  console.log("🎛 Video UI initialized");
}

/**
 * Inicializa los controles de video (botones)
 */
function initVideoControls() {
  // Play/Pause
  const btnPlay = document.getElementById("btn-play");
  if (btnPlay) {
    btnPlay.addEventListener("click", () => videoPlayer.togglePlayPause());
  }

  // Rewind
  const btnRewind = document.getElementById("btn-rewind");
  if (btnRewind) {
    btnRewind.addEventListener("click", () => videoPlayer.rewind(10));
  }

  // Forward
  const btnForward = document.getElementById("btn-forward");
  if (btnForward) {
    btnForward.addEventListener("click", () => videoPlayer.forward(10));
  }

  // Mute
  const btnMute = document.getElementById("btn-mute");
  if (btnMute) {
    btnMute.addEventListener("click", () => videoPlayer.toggleMute());
  }

  // Volume slider
  const volumeSlider = document.getElementById("volume-slider");
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      videoPlayer.setVolume(e.target.value / 100);
    });
  }

  // Fullscreen
  const btnFullscreen = document.getElementById("btn-fullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () =>
      videoPlayer.toggleFullscreen(),
    );
  }
}

/**
 * Inicializa el switcher de tabs (Local/YouTube)
 */
function initTabSwitcher() {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = {
    local: document.getElementById("tab-local"),
    youtube: document.getElementById("tab-youtube"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;

      // Actualizar estado activo de tabs
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Mostrar/ocultar contenido
      Object.entries(tabContents).forEach(([key, content]) => {
        if (content) {
          content.classList.toggle("hidden", key !== targetTab);
        }
      });
    });
  });
}

/**
 * Inicializa el selector de videos
 */
function initVideoSelector() {
  // Botón de subir video
  const btnUpload = document.getElementById("btn-upload-video");
  const fileInput = document.getElementById("video-file-input");

  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        videoPlayer.loadFromFile(file);
      }
    });
  }

  // Cargar YouTube
  const btnLoadYT = document.getElementById("btn-load-youtube");
  const ytInput = document.getElementById("youtube-url");

  if (btnLoadYT && ytInput) {
    btnLoadYT.addEventListener("click", () => {
      const url = ytInput.value.trim();
      if (url) {
        videoPlayer.loadYouTube(url);
      }
    });

    // También al presionar Enter
    ytInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        btnLoadYT.click();
      }
    });
  }
}

/**
 * Inicializa la barra de progreso interactiva
 */
function initProgressBar() {
  const progressBar = document.querySelector(".progress-bar");
  if (!progressBar) return;

  let isDragging = false;

  const updateProgress = (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    videoPlayer.seekToPercent(percent);
  };

  progressBar.addEventListener("mousedown", (e) => {
    isDragging = true;
    updateProgress(e);
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      updateProgress(e);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  progressBar.addEventListener("click", updateProgress);
}

/**
 * Inicializa el botón del dashboard
 */
function initDashboardButton() {
  const btnDashboard = document.getElementById("btn-dashboard");
  if (btnDashboard) {
    btnDashboard.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
  }
}

/**
 * Inicializa atajos de teclado
 */
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ignorar si está en un input
    if (e.target.tagName === "INPUT") return;

    switch (e.key.toLowerCase()) {
      case " ":
      case "k":
        e.preventDefault();
        videoPlayer.togglePlayPause();
        break;

      case "arrowleft":
      case "j":
        e.preventDefault();
        videoPlayer.rewind(10);
        break;

      case "arrowright":
      case "l":
        e.preventDefault();
        videoPlayer.forward(10);
        break;

      case "arrowup":
        e.preventDefault();
        videoPlayer.changeVolume(0.1);
        break;

      case "arrowdown":
        e.preventDefault();
        videoPlayer.changeVolume(-0.1);
        break;

      case "m":
        e.preventDefault();
        videoPlayer.toggleMute();
        break;

      case "f":
        e.preventDefault();
        videoPlayer.toggleFullscreen();
        break;

      case "escape":
        if (videoState.isFullscreen) {
          document.exitFullscreen();
        }
        break;
    }
  });
}

/**
 * Muestra una notificación temporal
 */
export function showNotification(message, duration = 2000) {
  // Crear elemento de notificación
  const notification = document.createElement("div");
  notification.className = "video-notification";
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 16px 32px;
        background: rgba(0,0,0,0.85);
        color: #fff;
        font-size: 18px;
        border-radius: 8px;
        z-index: 1000;
        animation: fadeInOut ${duration}ms ease;
    `;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), duration);
}
