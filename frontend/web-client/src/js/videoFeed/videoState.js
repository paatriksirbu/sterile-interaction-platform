import { CONFIG } from "../config.js";

/**
 * Helper function para verificar cooldown
 * Solo permite trigger si ha pasado suficiente tiempo
 */
export function canTriggerAction(lastTime, cooldown) {
  return Date.now() - lastTime >= cooldown;
}

class VideoState {
  constructor() {
    // Referencias DOM
    this.canvas = null;
    this.ctx = null;
    this.cameraVideo = null;
    this.mainVideo = null;

    // Estado del video
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 1;
    this.isMuted = false;
    this.isFullscreen = false;

    // Fuente de video
    this.videoSource = "local"; // 'local' | 'youtube'
    this.youtubePlayer = null;

    // Estado de gestos
    this.lastGesture = null;
    this.gestureStartTime = 0;

    // Doble tap detection
    this.lastTapTime = 0;
    this.lastTapZone = null;
    this.doubleTapThreshold = 400; // ms entre taps para considerarlo doble

    // ============================================================
    //    COOLDOWN TIMESTAMPS - Solo se actualizan con gestos válidos
    // ============================================================
    this.lastPlayPauseTime = 0;
    this.lastFullscreenTime = 0;
    this.lastSeekTime = 0;
    this.lastVolumeChangeTime = 0;
    this.lastUIModeTime = 0;

    // Usar constantes de cooldown desde CONFIG
    this.playPauseCooldown = CONFIG.COOLDOWNS.PLAY_PAUSE;
    this.fullscreenCooldown = CONFIG.COOLDOWNS.FULLSCREEN;
    this.seekCooldown = CONFIG.COOLDOWNS.NAVIGATION;
    this.volumeCooldown = CONFIG.COOLDOWNS.VOLUME;
    this.uiModeCooldown = CONFIG.COOLDOWNS.UI_MODE;

    // Volume gesture tracking
    this.volumeGestureActive = false;
    this.volumeStartY = 0;
    this.volumeStartValue = 1;

    // Volume smoothing state (valores dinámicos)
    this.volumeSmoothing = {
      factor: CONFIG.VOLUME_SMOOTHING.FACTOR,
      minDelta: CONFIG.VOLUME_SMOOTHING.MIN_DELTA,
      targetVolume: null,
      currentSmoothed: 1,
    };
    this._volumeSmoothingRAF = null;

    // Pinch tracking para doble tap
    this.pinchHistory = [];
    this.maxPinchHistory = 10;

    // ============================================================
    //    CONTROLS AUTO-SHOW/HIDE (para gestos)
    // ============================================================
    this._controlsTimeout = null;
    this._controlsVisible = false;
    this.controlsAutoHideMs = 3000; // Ocultar después de 3 segundos sin actividad
  }

  /**
   * Inicializa el estado con referencias DOM
   */
  init(canvas, ctx, cameraVideo, mainVideo) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.cameraVideo = cameraVideo;
    this.mainVideo = mainVideo;
  }

  /**
   * Actualiza el estado de reproducción
   */
  updatePlayState(isPlaying) {
    this.isPlaying = isPlaying;
    this.updatePlayPauseUI();
  }

  /**
   * Actualiza la UI de play/pause (soporta SVG icons)
   */
  updatePlayPauseUI() {
    const btnPlay = document.getElementById("btn-play");
    const playIcon = document.querySelector(".zone-center .play-icon");
    const pauseIcon = document.querySelector(".zone-center .pause-icon");

    // Actualizar botón de controles (ahora con SVGs)
    if (btnPlay) {
      const iconPlay = btnPlay.querySelector(".icon-play");
      const iconPause = btnPlay.querySelector(".icon-pause");
      if (iconPlay && iconPause) {
        iconPlay.classList.toggle("hidden", this.isPlaying);
        iconPause.classList.toggle("hidden", !this.isPlaying);
      } else {
        // Fallback para texto
        btnPlay.textContent = this.isPlaying ? "⏸" : "▶";
      }
    }

    // Actualizar zonas de gesto
    if (playIcon && pauseIcon) {
      playIcon.classList.toggle("hidden", this.isPlaying);
      pauseIcon.classList.toggle("hidden", !this.isPlaying);
    }
  }

  /**
   * Actualiza el volumen mostrado en UI (soporta SVG icons)
   */
  updateVolumeUI(volume) {
    this.volume = volume;
    const volumeFill = document.querySelector(".volume-fill");
    const volumeValue = document.querySelector(".volume-value");
    const volumeSlider = document.getElementById("volume-slider");
    const btnMute = document.getElementById("btn-mute");

    if (volumeFill) {
      volumeFill.style.height = `${volume * 100}%`;
    }
    if (volumeValue) {
      volumeValue.textContent = `${Math.round(volume * 100)}%`;
    }
    if (volumeSlider) {
      volumeSlider.value = volume * 100;
    }

    // Actualizar icono de mute (ahora con SVGs)
    // Actualizar icono de mute (ahora con SVGs)
    if (btnMute) {
      const iconHigh = btnMute.querySelector(".icon-vol-high");
      const iconMute = btnMute.querySelector(".icon-vol-mute");

      const isMuted = volume === 0 || this.isMuted;

      if (iconHigh && iconMute) {
        iconHigh.classList.toggle("hidden", isMuted);
        iconMute.classList.toggle("hidden", !isMuted);
        return; // 👈 clave para evitar el else
      }

      // Fallback para texto
      if (isMuted) {
        btnMute.textContent = "🔇";
      } else if (volume < 0.5) {
        btnMute.textContent = "🔉";
      } else {
        btnMute.textContent = "🔊";
      }
    }
  }

  /**
   * Muestra/oculta el indicador de volumen
   */
  showVolumeIndicator(show) {
    const indicator = document.getElementById("volume-indicator");
    if (indicator) {
      indicator.classList.toggle("hidden", !show);
      indicator.classList.toggle("visible", show);
    }
  }

  /**
   * Actualiza el tiempo actual en la UI
   */
  updateTimeUI(currentTime, duration) {
    this.currentTime = currentTime;
    this.duration = duration;

    const currentEl = document.getElementById("current-time");
    const durationEl = document.getElementById("duration");
    const progressFill = document.querySelector(".progress-fill");
    const progressHandle = document.querySelector(".progress-handle");

    if (currentEl) {
      currentEl.textContent = this.formatTime(currentTime);
    }
    if (durationEl) {
      durationEl.textContent = this.formatTime(duration);
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    if (progressHandle) {
      progressHandle.style.left = `${progress}%`;
    }
  }

  /**
   * Formatea segundos a mm:ss
   */
  formatTime(seconds) {
    if (Number.isNaN(seconds) || !Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Registra un pinch para detección de doble tap
   */
  recordPinch(zone, position) {
    const now = Date.now();
    this.pinchHistory.push({ time: now, zone, position });

    // Mantener solo los últimos N registros
    if (this.pinchHistory.length > this.maxPinchHistory) {
      this.pinchHistory.shift();
    }
  }

  /**
   * Detecta si hubo un doble tap reciente en una zona
   */
  checkDoubleTap(zone) {
    const now = Date.now();
    const recentPinches = this.pinchHistory.filter(
      (p) => p.zone === zone && now - p.time < this.doubleTapThreshold,
    );

    if (recentPinches.length >= 2) {
      // Limpiar historial para evitar múltiples detecciones
      this.pinchHistory = this.pinchHistory.filter((p) => p.zone !== zone);
      return { isDoubleTap: true, zone };
    }

    return { isDoubleTap: false, zone: null };
  }

  /**
   * Actualiza el indicador de gesto actual
   */
  updateGestureIndicator(gestureName, action) {
    const nameEl = document.querySelector(".gesture-name");
    const actionEl = document.querySelector(".gesture-action");

    if (nameEl) nameEl.textContent = gestureName || "-";
    if (actionEl) actionEl.textContent = action || "-";
  }

  /**
   * Muestra feedback visual en una zona
   */
  showZoneFeedback(zone) {
    const zoneEl = document.querySelector(`.zone-${zone}`);
    if (zoneEl) {
      zoneEl.classList.add("feedback");
      setTimeout(() => zoneEl.classList.remove("feedback"), 300);
    }
  }

  // ============================================================
  //    COOLDOWN CHECKS - Solo verificar cuando gesto es válido
  // ============================================================

  /**
   * Verifica si se puede ejecutar play/pause (cooldown)
   */
  canPlayPause() {
    return canTriggerAction(this.lastPlayPauseTime, this.playPauseCooldown);
  }

  /**
   * Verifica si se puede ejecutar fullscreen toggle (cooldown)
   */
  canFullscreen() {
    return canTriggerAction(this.lastFullscreenTime, this.fullscreenCooldown);
  }

  /**
   * Verifica si se puede ejecutar seek/navegación (cooldown)
   */
  canSeek() {
    return canTriggerAction(this.lastSeekTime, this.seekCooldown);
  }

  /**
   * Verifica si se puede cambiar volumen (throttling suave)
   */
  canChangeVolume() {
    return canTriggerAction(this.lastVolumeChangeTime, this.volumeCooldown);
  }

  /**
   * Verifica si se puede cambiar modo UI (cooldown)
   */
  canChangeUIMode() {
    return canTriggerAction(this.lastUIModeTime, this.uiModeCooldown);
  }

  // ============================================================
  //    VOLUME SMOOTHING - Interpolación suave del volumen
  // ============================================================

  /**
   * Establece el volumen objetivo con smoothing
   */
  setTargetVolume(targetVolume, applyCallback) {
    this.volumeSmoothing.targetVolume = Math.max(0, Math.min(1, targetVolume));

    // Iniciar animación de smoothing si no está activa
    if (!this._volumeSmoothingRAF) {
      this._startVolumeSmoothing(applyCallback);
    }
  }

  /**
   * Inicia el loop de smoothing de volumen
   * @private
   */
  _startVolumeSmoothing(applyCallback) {
    const smooth = () => {
      const target = this.volumeSmoothing.targetVolume;
      const current = this.volumeSmoothing.currentSmoothed;

      if (target === null) {
        this._volumeSmoothingRAF = null;
        return;
      }

      const delta = target - current;

      // Si el cambio es muy pequeño, aplicar directamente
      if (Math.abs(delta) < this.volumeSmoothing.minDelta) {
        this.volumeSmoothing.currentSmoothed = target;
        applyCallback(target);
        this._volumeSmoothingRAF = null;
        return;
      }

      // Interpolación suave
      const newVolume = current + delta * this.volumeSmoothing.factor;
      this.volumeSmoothing.currentSmoothed = newVolume;
      applyCallback(newVolume);

      this._volumeSmoothingRAF = requestAnimationFrame(smooth);
    };

    this._volumeSmoothingRAF = requestAnimationFrame(smooth);
  }

  /**F
   * Detiene el smoothing de volumen
   */
  stopVolumeSmoothing() {
    if (this._volumeSmoothingRAF) {
      cancelAnimationFrame(this._volumeSmoothingRAF);
      this._volumeSmoothingRAF = null;
    }
    this.volumeSmoothing.targetVolume = null;
  }

  /**
   * Reinicia el estado de smoothing con un valor inicial
   */
  resetVolumeSmoothing(initialVolume) {
    this.stopVolumeSmoothing();
    this.volumeSmoothing.currentSmoothed = initialVolume;
    this.volumeSmoothing.targetVolume = null;
  }

  // ============================================================
  //    CONTROLS VISIBILITY - Mostrar/ocultar con gestos
  // ============================================================

  /**
   * Muestra los controles del video y programa su ocultación automática
   * @param {boolean} resetTimer - Si debe reiniciar el timer de auto-hide
   */
  showControls(resetTimer = true) {
    const controls = document.getElementById("video-controls");
    if (!controls) return;

    // Mostrar controles
    controls.classList.add("visible");
    this._controlsVisible = true;

    // Reiniciar timer de auto-hide
    if (resetTimer) {
      this._resetControlsTimeout();
    }
  }

  /**
   * Oculta los controles del video
   */
  hideControls() {
    const controls = document.getElementById("video-controls");
    if (!controls) return;

    controls.classList.remove("visible");
    this._controlsVisible = false;
    this._clearControlsTimeout();
  }

  /**
   * Reinicia el timeout de auto-hide de controles
   * @private
   */
  _resetControlsTimeout() {
    this._clearControlsTimeout();
    this._controlsTimeout = setTimeout(() => {
      this.hideControls();
    }, this.controlsAutoHideMs);
  }

  /**
   * Limpia el timeout de auto-hide
   * @private
   */
  _clearControlsTimeout() {
    if (this._controlsTimeout) {
      clearTimeout(this._controlsTimeout);
      this._controlsTimeout = null;
    }
  }

  /**
   * Indica si los controles están visibles
   */
  get areControlsVisible() {
    return this._controlsVisible;
  }
}

export const videoState = new VideoState();
