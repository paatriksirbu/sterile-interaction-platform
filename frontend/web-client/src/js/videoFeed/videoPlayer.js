/**
 * Video Player - Control del reproductor de video
 */

import { videoState } from "./videoState.js";

class VideoPlayer {
  constructor() {
    this.videoElement = null;
    this.youtubePlayer = null;
    this.youtubeReady = false;
    this.pendingYouTubeId = null;
    this.localVideos = [];
    this.currentVideoIndex = -1;
    this.isYouTube = false;
    this._ytUpdateInterval = null;
  }

  /**
   * Inicializa el reproductor con el elemento de video
   */
  init(videoElement) {
    this.videoElement = videoElement;

    // Event listeners para HTML5 video
    this.videoElement.addEventListener("play", () => {
      videoState.updatePlayState(true);
    });

    this.videoElement.addEventListener("pause", () => {
      videoState.updatePlayState(false);
    });

    this.videoElement.addEventListener("timeupdate", () => {
      videoState.updateTimeUI(
        this.videoElement.currentTime,
        this.videoElement.duration,
      );
    });

    this.videoElement.addEventListener("loadedmetadata", () => {
      videoState.updateTimeUI(0, this.videoElement.duration);
      videoState.updateVolumeUI(this.videoElement.volume);
    });

    this.videoElement.addEventListener("volumechange", () => {
      videoState.updateVolumeUI(this.videoElement.volume);
    });

    this.videoElement.addEventListener("ended", () => {
      videoState.updatePlayState(false);
    });

    // Inicializar YouTube API callback
    this.initYouTubeAPI();

    console.log("📹 Video Player initialized");
  }

  /**
   * Configura el callback global para YouTube API
   */
  initYouTubeAPI() {
    // La API de YouTube llama a window.onYouTubeIframeAPIReady cuando está lista
    globalThis.onYouTubeIframeAPIReady = () => {
      console.log("📺 YouTube IFrame API Ready");
      this.youtubeReady = true;

      // Si hay un video pendiente, cargarlo
      if (this.pendingYouTubeId) {
        this.createYouTubePlayer(this.pendingYouTubeId);
        this.pendingYouTubeId = null;
      }
    };

    // Si la API ya estaba cargada
    if (globalThis.YT?.Player) {
      this.youtubeReady = true;
    }
  }

  /**
   * Crea un reproductor de YouTube
   */
  createYouTubePlayer(videoId) {
    // Destruir player anterior si existe
    if (this.youtubePlayer) {
      this.youtubePlayer.destroy();
      this.youtubePlayer = null;
    }

    // Limpiar intervalo de actualización anterior
    if (this._ytUpdateInterval) {
      clearInterval(this._ytUpdateInterval);
    }

    this.youtubePlayer = new YT.Player("youtube-player", {
      height: "100%",
      width: "100%",
      videoId: videoId,
      playerVars: {
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        origin: globalThis.location.origin,
      },
      events: {
        onReady: (e) => this.onYouTubeReady(e),
        onStateChange: (e) => this.onYouTubeStateChange(e),
        onError: (e) => this.onYouTubeError(e),
      },
    });
  }

  /**
   * Callback cuando el player de YouTube está listo
   */
  onYouTubeReady(event) {
    console.log("📺 YouTube Player Ready");

    // Obtener duración
    const duration = this.youtubePlayer.getDuration();
    videoState.updateTimeUI(0, duration);

    // Obtener volumen (YouTube usa 0-100)
    const volume = this.youtubePlayer.getVolume() / 100;
    videoState.updateVolumeUI(volume);

    // Iniciar intervalo para actualizar tiempo
    this._ytUpdateInterval = setInterval(() => {
      if (this.isYouTube && this.youtubePlayer) {
        const currentTime = this.youtubePlayer.getCurrentTime();
        const duration = this.youtubePlayer.getDuration();
        videoState.updateTimeUI(currentTime, duration);
      }
    }, 500);
  }

  /**
   * Callback cuando cambia el estado del video de YouTube
   */
  onYouTubeStateChange(event) {
    const state = event.data;

    switch (state) {
      case YT.PlayerState.PLAYING:
        videoState.updatePlayState(true);
        break;
      case YT.PlayerState.PAUSED:
        videoState.updatePlayState(false);
        break;
      case YT.PlayerState.ENDED:
        videoState.updatePlayState(false);
        break;
      case YT.PlayerState.BUFFERING:
        // Podríamos mostrar un indicador de carga
        break;
    }
  }

  /**
   * Callback de error de YouTube
   */
  onYouTubeError(event) {
    console.error("YouTube Error:", event.data);
    const errorMessages = {
      2: "ID de video inválido",
      5: "Error de reproducción HTML5",
      100: "Video no encontrado o privado",
      101: "Reproducción no permitida",
      150: "Reproducción no permitida",
    };
    alert(errorMessages[event.data] || "Error de YouTube");
  }

  /**
   * Establece la lista de videos locales
   */
  setLocalVideos(videos) {
    this.localVideos = videos;
    this.renderVideoList();
  }

  /**
   * Renderiza la lista de videos en el sidebar
   */
  renderVideoList() {
    const container = document.getElementById("local-videos");
    if (!container) return;

    container.innerHTML = "";

    this.localVideos.forEach((video, index) => {
      const item = document.createElement("div");
      item.className = "video-item";
      item.dataset.index = index;
      item.innerHTML = `
                <span class="video-icon">🎬</span>
                <span class="video-name">${video.name}</span>
            `;
      item.addEventListener("click", () => this.loadLocalVideo(index));
      container.appendChild(item);
    });
  }

  /**
   * Carga un video local por índice
   */
  loadLocalVideo(index) {
    if (index < 0 || index >= this.localVideos.length) return;

    this.isYouTube = false;
    this.currentVideoIndex = index;

    // Ocultar YouTube, mostrar HTML5
    const ytContainer = document.getElementById("youtube-container");
    if (ytContainer) ytContainer.classList.add("hidden");
    this.videoElement.classList.remove("hidden");

    const video = this.localVideos[index];
    this.videoElement.src = video.path;
    this.videoElement.load();

    // Actualizar UI
    this.updateActiveVideoItem(index);

    console.log(`📹 Loaded: ${video.name}`);
  }

  /**
   * Carga un video desde archivo (input file)
   */
  loadFromFile(file) {
    if (!file) return;

    this.isYouTube = false;
    const url = URL.createObjectURL(file);

    // Ocultar YouTube
    const ytContainer = document.getElementById("youtube-container");
    if (ytContainer) ytContainer.classList.add("hidden");
    this.videoElement.classList.remove("hidden");

    this.videoElement.src = url;
    this.videoElement.load();

    // Agregar a la lista
    const newVideo = { name: file.name, path: url, isBlob: true };
    this.localVideos.push(newVideo);
    this.currentVideoIndex = this.localVideos.length - 1;
    this.renderVideoList();
    this.updateActiveVideoItem(this.currentVideoIndex);

    console.log(`📹 Loaded file: ${file.name}`);
  }

  loadYouTube(url) {
    const videoId = this.extractYouTubeId(url);
    if (!videoId) {
      console.error("URL de YouTube inválida");
      alert(
        "URL de YouTube inválida. Usa un formato como: https://www.youtube.com/watch?v=VIDEO_ID",
      );
      return;
    }

    this.isYouTube = true;

    // Ocultar HTML5, mostrar YouTube
    this.videoElement.classList.add("hidden");
    this.videoElement.pause();

    const ytContainer = document.getElementById("youtube-container");
    if (ytContainer) {
      ytContainer.classList.remove("hidden");
    }

    // Si la API está lista, crear player
    if (this.youtubeReady) {
      this.createYouTubePlayer(videoId);
    } else {
      this.pendingYouTubeId = videoId;
      console.log("📺 YouTube API not ready, queuing video:", videoId);
    }

    console.log(`📹 YouTube loading: ${videoId}`);
  }

  /**
   * Extrae el ID de un video de YouTube
   */
  extractYouTubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Actualiza el item activo
  updateActiveVideoItem(index) {
    const items = document.querySelectorAll(".video-item");
    items.forEach((item, i) => {
      item.classList.toggle("active", i === index);
    });
  }

  // ============================================================
  //    CONTROLES DE REPRODUCCIÓN
  // ============================================================

  /**
   * Play/Pause toggle
   */
  togglePlayPause() {
    if (this.isYouTube && this.youtubePlayer) {
      const state = this.youtubePlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        this.youtubePlayer.pauseVideo();
      } else {
        this.youtubePlayer.playVideo();
      }
      videoState.showZoneFeedback("center");
      return;
    }

    if (this.videoElement.paused) {
      const playPromise = this.videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignorar el error "play() interrupted by pause()"
        });
      }
      videoState.showZoneFeedback("center");
    } else {
      this.videoElement.pause();
      videoState.showZoneFeedback("center");
    }
  }

  /**
   * Avanza en el video 10 segundos
   */
  forward(seconds = 10) {
    try {
      // Verificar que hay un video de YouTube cargado
      if (this.isYouTube && this.youtubePlayer) {
        const currentTime = this.youtubePlayer.getCurrentTime();
        const duration = this.youtubePlayer.getDuration();
        if (!Number.isFinite(duration) || duration <= 0) {
          console.warn("⚠️ No hay video de YouTube cargado para avanzar");
          return;
        }
        this.youtubePlayer.seekTo(
          Math.min(duration, currentTime + seconds),
          true,
        );
        videoState.showZoneFeedback("right");
        return;
      }

      // Verificar video HTML5
      if (
        !this.videoElement ||
        !Number.isFinite(this.videoElement.duration) ||
        this.videoElement.duration <= 0
      ) {
        console.warn("⚠️ No hay video cargado para avanzar");
        return;
      }

      this.videoElement.currentTime = Math.min(
        this.videoElement.duration,
        this.videoElement.currentTime + seconds,
      );
      videoState.showZoneFeedback("right");
    } catch (error) {
      console.warn("⚠️ Error al avanzar video:", error.message);
    }
  }

  /**
   * Retrocede en el video 10 segundos
   */
  rewind(seconds = 10) {
    try {
      // Verificar que hay un video de YouTube cargado
      if (this.isYouTube && this.youtubePlayer) {
        const currentTime = this.youtubePlayer.getCurrentTime();
        const duration = this.youtubePlayer.getDuration();
        if (!Number.isFinite(duration) || duration <= 0) {
          console.warn("⚠️ No hay video de YouTube cargado para retroceder");
          return;
        }
        this.youtubePlayer.seekTo(Math.max(0, currentTime - seconds), true);
        videoState.showZoneFeedback("left");
        return;
      }

      // Verificar video HTML5
      if (
        !this.videoElement ||
        !Number.isFinite(this.videoElement.duration) ||
        this.videoElement.duration <= 0
      ) {
        console.warn("⚠️ No hay video cargado para retroceder");
        return;
      }

      this.videoElement.currentTime = Math.max(
        0,
        this.videoElement.currentTime - seconds,
      );
      videoState.showZoneFeedback("left");
    } catch (error) {
      console.warn("⚠️ Error al retroceder video:", error.message);
    }
  }

  /**
   * Salta a un porcentaje del video
   */
  seekToPercent(percent) {
    if (this.isYouTube && this.youtubePlayer) {
      const duration = this.youtubePlayer.getDuration();
      const time = duration * Math.max(0, Math.min(1, percent));
      this.youtubePlayer.seekTo(time, true);
      return;
    }

    const time = this.videoElement.duration * Math.max(0, Math.min(1, percent));
    this.videoElement.currentTime = time;
  }

  /**
   * Cambia el volumen usando throttling suave
   */
  changeVolume(delta) {
    // Throttle suave para volumen
    if (!videoState.canChangeVolume()) return;
    videoState.lastVolumeChangeTime = Date.now();

    if (this.isYouTube && this.youtubePlayer) {
      const currentVolume = this.youtubePlayer.getVolume() / 100;
      const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
      this.youtubePlayer.setVolume(newVolume * 100);
      videoState.updateVolumeUI(newVolume);
      videoState.isMuted = newVolume === 0;
      videoState.showVolumeIndicator(true);

      clearTimeout(this._volumeHideTimeout);
      this._volumeHideTimeout = setTimeout(() => {
        videoState.showVolumeIndicator(false);
      }, 1500);
      return;
    }

    const newVolume = Math.max(
      0,
      Math.min(1, this.videoElement.volume + delta),
    );
    this.videoElement.volume = newVolume;
    videoState.isMuted = newVolume === 0;
    videoState.showVolumeIndicator(true);

    // Ocultar indicador después de un momento
    clearTimeout(this._volumeHideTimeout);
    this._volumeHideTimeout = setTimeout(() => {
      videoState.showVolumeIndicator(false);
    }, 1500);
  }

  /**
   * Establece el volumen directamente
   */
  setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));

    if (this.isYouTube && this.youtubePlayer) {
      this.youtubePlayer.setVolume(vol * 100);
      videoState.updateVolumeUI(vol);
      videoState.isMuted = vol === 0;
      videoState.showVolumeIndicator(true);

      clearTimeout(this._volumeHideTimeout);
      this._volumeHideTimeout = setTimeout(() => {
        videoState.showVolumeIndicator(false);
      }, 1500);
      return;
    }

    this.videoElement.volume = vol;
    videoState.isMuted = vol === 0;
    videoState.showVolumeIndicator(true);

    clearTimeout(this._volumeHideTimeout);
    this._volumeHideTimeout = setTimeout(() => {
      videoState.showVolumeIndicator(false);
    }, 1500);
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    if (this.isYouTube && this.youtubePlayer) {
      if (this.youtubePlayer.isMuted()) {
        this.youtubePlayer.unMute();
        const vol = this.youtubePlayer.getVolume() / 100;
        videoState.updateVolumeUI(vol);
        videoState.isMuted = false;
      } else {
        this.youtubePlayer.mute();
        videoState.updateVolumeUI(0);
        videoState.isMuted = true;
      }
      return;
    }

    this.videoElement.muted = !this.videoElement.muted;
    videoState.isMuted = this.videoElement.muted;
    videoState.updateVolumeUI(
      this.videoElement.muted ? 0 : this.videoElement.volume,
    );
  }

  /**
   * Toggle fullscreen
   */
  toggleFullscreen() {
    // Verificar cooldown antes de ejecutar
    if (!videoState.canFullscreen()) {
      console.log("⏱ Fullscreen en cooldown, ignorando...");
      return;
    }
    // Actualizar timestamp SOLO cuando el gesto es válido
    videoState.lastFullscreenTime = Date.now();

    const container = document.getElementById("workarea");

    if (document.fullscreenElement) {
      document.exitFullscreen();
      videoState.isFullscreen = false;
    } else {
      container.requestFullscreen().catch((err) => {
        console.error("Error al entrar en fullscreen:", err);
      });
      videoState.isFullscreen = true;
    }
  }

  /**
   * Obtiene la posición actual de reproducción (0-1)
   */
  getProgress() {
    if (this.isYouTube && this.youtubePlayer) {
      const duration = this.youtubePlayer.getDuration();
      if (!duration) return 0;
      return this.youtubePlayer.getCurrentTime() / duration;
    }

    if (!this.videoElement.duration) return 0;
    return this.videoElement.currentTime / this.videoElement.duration;
  }

  /**
   * Verifica si hay un video cargado
   */
  hasVideo() {
    if (this.isYouTube) {
      return this.youtubePlayer !== null;
    }
    return this.videoElement.src && this.videoElement.readyState >= 1;
  }

  /**
   * Verifica si está reproduciendo
   */
  isPlaying() {
    if (this.isYouTube && this.youtubePlayer) {
      return this.youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING;
    }
    return !this.videoElement.paused;
  }
}

export const videoPlayer = new VideoPlayer();
