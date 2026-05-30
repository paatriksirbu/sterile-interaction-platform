// let LOCAL_CONFIG = null;
// try {
//   const localModule = await import("./config.local.js");
//   LOCAL_CONFIG = localModule.LOCAL_CONFIG;
//   console.log("✅ Configuración local cargada correctamente");
// } catch (e) {
//   console.warn("⚠️ No se encontró config.local.js");
//   console.error(e);
// }

export const CONFIG = {
  // Modo espejo para cámara frontal (false = sin inversión, mano izquierda a la izquierda)
  MIRROR: true,

  // Zoom
  ZOOM: {
    MIN: 0.5,
    MAX: 3,
    SENSITIVITY: 3,
  },
  // Interactions tuning (pager, open-hand, rail, zoom)
  INTERACTIONS: {
    PAGER: {
      CLICK_COOLDOWN_MS: 300,
      SCROLL_STEP_PX: 60,
      SCROLL_COOLDOWN_MS: 160,
    },
    OPENHAND: {
      SCROLL_STEP_PX: 120,
      SCROLL_COOLDOWN_MS: 400, // Tiempo entre cambios de página
      ENABLED_OUTSIDE_RAIL: false, // NO afecta al scroll del rail
      PDF_LOCK_AFTER_PAGE_MS: 400,
      PDF_HIT_MARGIN_PX: 50,
    },
    LOCK: {
      ENABLED: true,
      HOLD_MS: 1000, // Tiempo que hay que mantener el gesto para togglear
      COOLDOWN_MS: 1000, // Tiempo mínimo entre cambios LOCKED/ACTIVE
    },
    RAIL: {
      ACTIVATION_MARGIN_PX: 20,
      HANDLE_SMOOTHING: 0.035,
      PAGE_THROTTLE_MS: 400,
    },
    ZOOM: {
      LEVELS: [0.5, 0.75, 1, 1.15, 1.25, 1.5, 2],
      STEP_RATIO: 0.12,
      THROTTLE_MS: 600,
    },
  },
  UI: {
    BUTTON_HIT_MARGIN_PX: 48,
    DWELL_MS: 800,
  },

  // Anotaciones (chinchetas/marcas)
  ANNOTATIONS: {
    ENABLED: true,
    DWELL_MS: 800,
    PIN_SIZE: 24,
    LABEL_OFFSET: 28,
    LABEL_FONT_SIZE: 12,
    SHOW_LABELS: true,
    HIT_THRESHOLD: 0.05,
    MAX_PER_PAGE: 10,
    SPEECH_ENABLED: true,
    SPEECH_AUTO_START: true,
    MAX_TEXT_WIDTH: 300,
  },

  // // Azure Speech Service (Speech-to-Text)
  // AZURE_SPEECH: {
  //   SUBSCRIPTION_KEY: LOCAL_CONFIG?.AZURE_SPEECH?.SUBSCRIPTION_KEY || "",
  //   REGION: LOCAL_CONFIG?.AZURE_SPEECH?.REGION || "westeurope",
  //   LANGUAGE: "es-ES",
  //   MAX_RECORDING_MS: 5000,
  // },

  FRAMES: {
    PINCH: 5,
    SPHERICAL: 10,
    POINTING: 10,
    CLOSED_FIST: 6,
    OPEN_HAND: 4,
    LOCK: 8,
  },

  // PRIORIZACIÓN DE MANOS - Para múltiples manos
  HAND_PRIORITIZATION: {
    MAX_HANDS: 2,
    // Mano debe ser al menos 40% del tamaño de la más grande para ser considerada
    MIN_SIZE_RATIO: 0.4,
    // Tamaño mínimo absoluto de mano (en coordenadas normalizadas, ~0.08 = muy lejos)
    MIN_ABSOLUTE_SIZE: 0.06,
    // Peso de cada señal en el cálculo de proximidad (deben sumar ~1)
    PROXIMITY_WEIGHTS: {
      SIZE: 0.5,
      DEPTH: 0.35,
      CONFIDENCE: 0.15,
    },
    // Estabilidad temporal - evita cambios bruscos entre manos
    TEMPORAL_STABILITY: {
      ENABLED: true,
      MIN_FRAMES_TO_TRACK: 3,
      TRACKING_BONUS: 0.15,
      MAX_MEMORY_FRAMES: 5,
    },
    // Warmup de distancia - manos lejanas requieren más tiempo para ser reconocidas
    DISTANCE_WARMUP: {
      ENABLED: true,
      // Umbral de tamaño para considerar una mano "lejana" (menor = más lejos)
      FAR_HAND_SIZE_THRESHOLD: 0.12,
      // Frames requeridos para manos cercanas (rápido)
      CLOSE_HAND_FRAMES: 3,
      // Frames requeridos para manos lejanas (más lento, evita falsos positivos)
      FAR_HAND_FRAMES: 12,
      // Frames intermedios para transición suave
      MEDIUM_HAND_SIZE_THRESHOLD: 0.15,
      MEDIUM_HAND_FRAMES: 6,
    },
  },

  GESTURE_EXCLUSION: {
    CLOSED_FIST_TO_PINCH_FRAMES: 8,
    PINCH_TO_CLOSED_FIST_FRAMES: 5,
  },

  THRESHOLDS: {
    PINCH_MOVE: 0.35,
    RING_TOGGLE: 0.07,
    PINCH_ENTER: 0.3,
    PINCH_EXIT: 0.42,
  },

  COLORS: {
    Left: "purple",
    Right: "turquoise",
    Unknown: "#FFD166",
  },

  SMOOTHING: {
    ALPHA: 0.5,
    PREDICT: 0.06,
    DEADBAND: 0.002,
  },

  //    COOLDOWNS - Evitar triggers múltiples por gesto
  COOLDOWNS: {
    FULLSCREEN: 500,
    PLAY_PAUSE: 400,

    UI_MODE: 400,

    // Navegación por gestos: 250-400ms
    NAVIGATION: 300,

    // Volume tiene smoothing
    VOLUME: 50,
  },

  //    VOLUME SMOOTHING - Interpolación suave del volumen
  VOLUME_SMOOTHING: {
    FACTOR: 0.15,
    MIN_DELTA: 0.005,
  },

  // Optimizaciones para rendimiento y precision
  PERFORMANCE: {
    // Complejidad del modelo de MediaPipe: 0=lite (más rápido), 1=full (predeterminado)
    MODEL_COMPLEXITY: 0,
    // Resolución de la cámara (más baja = más rápido, pero menos preciso a distancia)
    CAMERA_WIDTH: 480,
    CAMERA_HEIGHT: 360,
    MIN_DETECTION_CONFIDENCE: 0.6,
    MIN_TRACKING_CONFIDENCE: 0.6,
    HUD_UPDATE_INTERVAL: 3,
    STABILITY_UPDATE_INTERVAL: 2,
  },
};
