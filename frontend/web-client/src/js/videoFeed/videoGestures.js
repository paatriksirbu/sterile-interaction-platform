/**
 * Procesamiento de gestos para el visor de video. Implementa cooldowns
 */

import { CONFIG } from "../config.js";
import { videoState, canTriggerAction } from "./videoState.js";
import { videoPlayer } from "./videoPlayer.js";
import { getThumbIndexPinchPositions } from "../gestures/pinch.js";

// Shortcut para COOLDOWNS desde config
const COOLDOWNS = CONFIG.COOLDOWNS;

// Estado del procesamiento de gestos
const gestureProcessor = {
  // Pinch tracking
  isPinchActive: false,
  pinchStartTime: 0,
  pinchZone: null,
  lastPinchPosition: null,

  // Open hand tracking
  isOpenHandActive: false,
  openHandStartY: 0,
  openHandStartVolume: 1,

  // Closed Fist tracking para maximizar
  prevClosedFistConfirmed: false,
  lastClosedFistToggleTs: 0,
  closedFistCooldown: COOLDOWNS.UI_MODE,
  lastClosedFistDetectedTs: 0,
  closedFistHysteresisMs: 300,
  closedFistActiveSession: false,

  // Zonas del video (porcentajes)
  zones: {
    left: { x1: 0, x2: 0.33 },
    center: { x1: 0.33, x2: 0.67 },
    right: { x1: 0.67, x2: 1 },
  },

  lastNavigationTime: 0,
  lastPlayPauseTime: 0,
};

/**
 * Procesa los gestos detectados para controlar el video
 */
export function processVideoGestures(hands, gestureState, canvas) {
  if (!gestureState || hands.length === 0) {
    return;
  }

  videoState.showControls();

  const prioritizedLandmarks = gestureState.prioritizedLandmarks || hands;
  if (prioritizedLandmarks.length === 0) return;

  const hand = gestureState.hands?.[0] || gestureState;
  const landmarks = prioritizedLandmarks[0];

  const pinchPos = getThumbIndexPinchPositions(landmarks);
  const isPinching = hand.pinch?.confirmed || false;
  const isOpenHand = hand.openHand?.confirmed || false;

  const isClosedFist =
    gestureState.anyClosedFist || hand.closedFist?.confirmed || false;

  processClosedFistMaximize(isClosedFist);

  // Procesar Open Hand para control de volumen (SOLO en zona derecha)
  if (isOpenHand) {
    const palmCenter = hand.openHand?.palmCenter;
    if (palmCenter) {
      let palmX = palmCenter.x;
      if (CONFIG.MIRROR) palmX = 1 - palmX;
      const zone = getZone(palmX);

      if (zone === "right") {
        processOpenHandVolume(hand);
      } else {
        // Mostrar indicador de que debe ir a la zona derecha
        videoState.updateGestureIndicator(
          "🖐 Open Hand",
          "Ir a zona derecha para volumen",
        );
        gestureProcessor.isOpenHandActive = false;
        videoState.stopVolumeSmoothing();
        videoState.showVolumeIndicator(false);
      }
    }
  } else {
    // Open hand gesto terminado - detener smoothing
    if (gestureProcessor.isOpenHandActive) {
      videoState.stopVolumeSmoothing();
    }
    gestureProcessor.isOpenHandActive = false;
    videoState.showVolumeIndicator(false);
  }

  // Procesar Pinch para interacciones
  if (isPinching && pinchPos) {
    processPinchInteraction(pinchPos);
  } else if (gestureProcessor.isPinchActive) {
    onPinchRelease();
  }

  // Actualizar indicador si no hay gesto activo
  if (!isPinching && !isOpenHand && !isClosedFist) {
    videoState.updateGestureIndicator("-", "Esperando gesto...");
  } else if (isClosedFist && !isPinching && !isOpenHand) {
    videoState.updateGestureIndicator("✊ Closed Fist", "Maximizar");
  }
}

/**
 * Procesa la interacción de pinch
 */
function processPinchInteraction(pinchPos) {
  const now = Date.now();

  let x = pinchPos.x;
  if (CONFIG.MIRROR) {
    x = 1 - x;
  }

  const zone = getZone(x);

  if (gestureProcessor.isPinchActive) {
    gestureProcessor.lastPinchPosition = { x: pinchPos.x, y: pinchPos.y };
  } else {
    // Inicio de pinch
    gestureProcessor.isPinchActive = true;
    gestureProcessor.pinchStartTime = now;
    gestureProcessor.pinchZone = zone;
    gestureProcessor.lastPinchPosition = { x: pinchPos.x, y: pinchPos.y };

    updateZoneHighlight(zone);
    updateGestureIndicatorForZone(zone);
  }
}

/**
 * Llamado cuando se libera el pinch, sin esperar doble tap para acción instantánea
 */
function onPinchRelease() {
  const now = Date.now();
  const duration = now - gestureProcessor.pinchStartTime;
  const zone = gestureProcessor.pinchZone;

  // Solo procesar si fue un tap corto y hay zona válida
  if (duration < 500 && zone) {
    // ACCIÓN INSTANTÁNEA según la zona con cooldowns
    switch (zone) {
      case "left":
        if (
          canTriggerAction(
            gestureProcessor.lastNavigationTime,
            COOLDOWNS.NAVIGATION,
          )
        ) {
          gestureProcessor.lastNavigationTime = now;
          videoPlayer.rewind(10);
          // Misma animación que el botón de retroceder
          videoState.showZoneFeedback("left");
          videoState.updateGestureIndicator("⏪ Pinch", "-10 segundos");
          console.log("⏪ Retroceder 10 segundos");
        }
        break;

      case "center":
        if (
          canTriggerAction(
            gestureProcessor.lastPlayPauseTime,
            COOLDOWNS.PLAY_PAUSE,
          )
        ) {
          gestureProcessor.lastPlayPauseTime = now;
          videoPlayer.togglePlayPause();
          showDoubleTapAnimation("center");
          videoState.updateGestureIndicator("👌 Pinch", "Play/Pause");
          console.log("▶⏸ Play/Pause");
        }
        break;

      case "right":
        if (
          canTriggerAction(
            gestureProcessor.lastNavigationTime,
            COOLDOWNS.NAVIGATION,
          )
        ) {
          gestureProcessor.lastNavigationTime = now;
          videoPlayer.forward(10);
          // Misma animación que el botón de avanzar
          videoState.showZoneFeedback("right");
          videoState.updateGestureIndicator("⏩ Pinch", "+10 segundos");
          console.log("⏩ Avanzar 10 segundos");
        }
        break;
    }
  }

  gestureProcessor.isPinchActive = false;
  gestureProcessor.pinchZone = null;
  // Importante: no quitar "feedback" aquí o la animación desaparece instantáneamente
  clearZoneActiveHighlight();
}

/**
 * Procesa el gesto de puño cerrado para maximizar (CSS)
 */
function processClosedFistMaximize(isClosedFist) {
  const now = Date.now();

  if (isClosedFist) {
    gestureProcessor.lastClosedFistDetectedTs = now;

    // Verificar si es un NUEVO gesto o continuación del anterior
    const isNewGesture =
      !gestureProcessor.closedFistActiveSession &&
      canTriggerAction(
        gestureProcessor.lastClosedFistToggleTs,
        COOLDOWNS.UI_MODE,
      );

    if (isNewGesture) {
      // Iniciar nueva sesión y hacer toggle
      gestureProcessor.closedFistActiveSession = true;

      const isMaximized = document.body.classList.toggle("maximized");
      console.log(`✊ Toggle Maximize: ${isMaximized ? "ON" : "OFF"}`);

      gestureProcessor.lastClosedFistToggleTs = now;
      videoState.lastUIModeTime = now;

      videoState.updateGestureIndicator(
        "✊ Closed Fist",
        isMaximized ? "Maximizado" : "Normal",
      );
    }
  } else {
    // No se detecta closed fist en este frame
    // Solo terminar la sesión si ha pasado el tiempo de histéresis
    const timeSinceLastDetection =
      now - gestureProcessor.lastClosedFistDetectedTs;

    if (timeSinceLastDetection > gestureProcessor.closedFistHysteresisMs) {
      gestureProcessor.closedFistActiveSession = false;
    }
  }

  gestureProcessor.prevClosedFistConfirmed = isClosedFist;
}

/**
 * Procesa el gesto de mano abierta para control de volumen
 */
function processOpenHandVolume(hand) {
  const palmCenter = hand.openHand?.palmCenter;
  if (!palmCenter) return;

  if (gestureProcessor.isOpenHandActive) {
    const deltaY = gestureProcessor.openHandStartY - palmCenter.y;
    // Movimiento vertical: arriba aumenta, abajo disminuye
    const volumeChange = deltaY * 0.8; // Ajustar sensibilidad del movimiento
    const targetVolume = Math.max(
      0,
      Math.min(1, gestureProcessor.openHandStartVolume + volumeChange),
    );

    // Usar smoothing en lugar de cambio directo
    videoState.setTargetVolume(targetVolume, (smoothedVolume) => {
      videoPlayer.setVolume(smoothedVolume);
    });

    videoState.updateGestureIndicator(
      "🖐 Open Hand",
      `Volumen: ${Math.round(targetVolume * 100)}%`,
    );
  } else {
    // Inicio del gesto - inicializar smoothing
    gestureProcessor.isOpenHandActive = true;
    gestureProcessor.openHandStartY = palmCenter.y;
    gestureProcessor.openHandStartVolume = videoState.volume;
    videoState.resetVolumeSmoothing(videoState.volume);
    videoState.showVolumeIndicator(true);
  }
}

/**
 * Determina en qué zona está la coordenada X
 */
function getZone(x) {
  const { zones } = gestureProcessor;
  if (x < zones.left.x2) return "left";
  if (x < zones.center.x2) return "center";
  return "right";
}

/**
 * Actualiza el highlight visual de una zona
 */
function updateZoneHighlight(zone) {
  clearZoneHighlights();
  const zoneEl = document.querySelector(`.zone-${zone}`);
  if (zoneEl) {
    zoneEl.classList.add("active");
  }
}

/**
 * Limpia todos los highlights de zonas
 */
function clearZoneHighlights() {
  document.querySelectorAll(".gesture-zone").forEach((el) => {
    el.classList.remove("active", "feedback");
  });
}

/**
 * Limpia solo el estado "active" (no cancela el feedback).
 * Esto permite que el feedback de forward/rewind se vea aunque el gesto termine.
 */
function clearZoneActiveHighlight() {
  document.querySelectorAll(".gesture-zone").forEach((el) => {
    el.classList.remove("active");
  });
}

/**
 * Actualiza el indicador de gesto según la zona
 */
function updateGestureIndicatorForZone(zone) {
  switch (zone) {
    case "left":
      videoState.updateGestureIndicator("👌 Pinch", "Soltar: -10s");
      break;
    case "center":
      videoState.updateGestureIndicator("👌 Pinch", "Soltar: Play/Pause");
      break;
    case "right":
      videoState.updateGestureIndicator("👌 Pinch", "Soltar: +10s");
      break;
  }
}

/**
 * Muestra animación de doble tap estilo YouTube (flechitas + número)
 */
function showDoubleTapAnimation(zone) {
  const zoneEl = document.querySelector(`.zone-${zone}`);
  if (!zoneEl) return;

  // Forzar reinicio de la animación del ripple-container
  const rippleContainer = zoneEl.querySelector(".ripple-container");
  if (rippleContainer) {
    rippleContainer.style.animation = "none";
    // Forzar reflow para reiniciar la animación
    rippleContainer.getBoundingClientRect();
    rippleContainer.style.animation = "";
  }

  // Mostrar feedback de la zona con el icono SVG
  zoneEl.classList.add("feedback");
  setTimeout(() => zoneEl.classList.remove("feedback"), 800);
}

// Estado para tracking de hover y cooldown de clicks
const hoverState = {
  lastClickTime: 0,
  clickCooldown: 500,
  hoveredElement: null,
};

/**
 * Procesa hover sobre elementos interactivos con pinch
 */
export function processButtonHover(hands, gestureState) {
  if (!hands || hands.length === 0) return;

  const pinchPos = getThumbIndexPinchPositions(hands[0]);
  if (!pinchPos) return;

  const canvas = videoState.canvas;
  if (!canvas) return;

  // Convertir posición normalizada a píxeles de pantalla
  const canvasRect = canvas.getBoundingClientRect();
  let x = pinchPos.x * canvasRect.width + canvasRect.left;
  let y = pinchPos.y * canvasRect.height + canvasRect.top;

  if (CONFIG.MIRROR) {
    x = canvasRect.right - pinchPos.x * canvasRect.width;
  }

  // Lista de elementos interactivos
  const interactiveElements = [
    // Dashboard button
    {
      selector: "#btn-dashboard",
      action: () => (globalThis.location.href = "dashboard.html"),
    },
    // Video items
    ...Array.from(document.querySelectorAll(".video-item")).map((el, i) => ({
      element: el,
      action: () => el.click(),
    })),
    // Tab buttons
    ...Array.from(document.querySelectorAll(".tab-btn")).map((el) => ({
      element: el,
      action: () => el.click(),
    })),
    // Upload button
    {
      selector: "#btn-upload-video",
      action: () => document.getElementById("btn-upload-video")?.click(),
    },
    // Load YouTube button
    {
      selector: "#btn-load-youtube",
      action: () => document.getElementById("btn-load-youtube")?.click(),
    },
  ];

  // Limpiar todos los hovers previos
  document
    .querySelectorAll(".pinch-hover")
    .forEach((el) => el.classList.remove("pinch-hover"));

  const isPinching = gestureState?.hands?.[0]?.pinch?.confirmed || false;
  const now = Date.now();

  for (const item of interactiveElements) {
    const el = item.element || document.querySelector(item.selector);
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    const isOver =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    if (isOver) {
      el.classList.add("pinch-hover");

      // Si hace pinch confirmado y pasó el cooldown, ejecutar acción
      if (
        isPinching &&
        now - hoverState.lastClickTime > hoverState.clickCooldown
      ) {
        hoverState.lastClickTime = now;
        item.action();
        break;
      }
    }
  }
}
