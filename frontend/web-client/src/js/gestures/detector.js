import { CONFIG } from "../config.js";
import { detectPinchGesture } from "./pinch.js";
import { detectPointingGesture, getPointingDirection } from "./pointing.js";
import { detectOpenHand } from "./openHand.js";
import { detectClosedFist } from "./closedFist.js";
import { detectLockGesture } from "./lockGesture.js";
import { getHandProximityScore } from "./base.js";

// CONFIGURACION
const getHandPrioritizationConfig = () => ({
  MAX_HANDS: CONFIG.HAND_PRIORITIZATION?.MAX_HANDS || 2,
  MIN_HAND_SIZE_RATIO: CONFIG.HAND_PRIORITIZATION?.MIN_SIZE_RATIO || 0.4,
  MIN_ABSOLUTE_SIZE: CONFIG.HAND_PRIORITIZATION?.MIN_ABSOLUTE_SIZE || 0.06,
  PROXIMITY_WEIGHTS: CONFIG.HAND_PRIORITIZATION?.PROXIMITY_WEIGHTS || {
    SIZE: 0.5,
    DEPTH: 0.35,
    CONFIDENCE: 0.15,
  },
  TEMPORAL_STABILITY: CONFIG.HAND_PRIORITIZATION?.TEMPORAL_STABILITY || {
    ENABLED: true,
    MIN_FRAMES_TO_TRACK: 3,
    TRACKING_BONUS: 0.15,
    MAX_MEMORY_FRAMES: 5,
  },
  DISTANCE_WARMUP: CONFIG.HAND_PRIORITIZATION?.DISTANCE_WARMUP || {
    ENABLED: true,
    FAR_HAND_SIZE_THRESHOLD: 0.12,
    CLOSE_HAND_FRAMES: 3,
    FAR_HAND_FRAMES: 12,
    MEDIUM_HAND_SIZE_THRESHOLD: 0.15,
    MEDIUM_HAND_FRAMES: 6,
  },
});

const getGestureExclusionConfig = () => ({
  CLOSED_FIST_TO_PINCH_GRACE_FRAMES:
    CONFIG.GESTURE_EXCLUSION?.CLOSED_FIST_TO_PINCH_FRAMES || 8,
  PINCH_TO_CLOSED_FIST_GRACE_FRAMES:
    CONFIG.GESTURE_EXCLUSION?.PINCH_TO_CLOSED_FIST_FRAMES || 5,
});

class SingleHandGestureDetector {
  constructor() {
    // Contadores de frames para confirmación
    this.pinchFrameCount = 0;
    this.approvalFrameCount = 0;
    this.pointingFrameCount = 0;
    this.closedFistFrameCount = 0;
    this.openHandFrameCount = 0;
    this.lockFrameCount = 0;

    // Estados confirmados de gestos
    this.isPinchConfirmed = false;
    this.isApprovalConfirmed = false;
    this.isPointingConfirmed = false;
    this.isClosedFistConfirmed = false;
    this.isOpenHandConfirmed = false;
    this.isLockConfirmed = false;

    // Resultados de detección actuales
    this.currentPinch = null;
    this.currentApproval = null;
    this.currentPointing = null;
    this.currentSpherical = false;
    this.currentClosedFist = false;
    this.currentOpenHand = null;
    this.currentLock = null;

    this.framesSinceClosedFistEnded = Infinity;
    this.framesSincePinchEnded = Infinity;
    this.dominantGesture = null;
  }

  detect(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      this.reset();
      return this.getState();
    }

    // Detectar gestos base
    const pinchResult = detectPinchGesture(landmarks);
    const isPointing = detectPointingGesture(landmarks);
    const pointingDir = isPointing ? getPointingDirection(landmarks) : null;
    const openHandResult = detectOpenHand(landmarks);
    const isClosedFist = detectClosedFist(landmarks);
    const isLockGesture = detectLockGesture(landmarks);

    const exclusionConfig = getGestureExclusionConfig();

    // Actualizar contadores de frames
    if (!isClosedFist && this.currentClosedFist) {
      this.framesSinceClosedFistEnded = 0;
    } else if (!isClosedFist) {
      this.framesSinceClosedFistEnded++;
    }

    if (!pinchResult.isPinching && this.currentPinch?.isPinching) {
      this.framesSincePinchEnded = 0;
    } else if (!pinchResult.isPinching) {
      this.framesSincePinchEnded++;
    }

    const pinchBlockedByClosedFist =
      this.framesSinceClosedFistEnded <
      exclusionConfig.CLOSED_FIST_TO_PINCH_GRACE_FRAMES;

    const closedFistBlockedByPinch =
      this.framesSincePinchEnded <
      exclusionConfig.PINCH_TO_CLOSED_FIST_GRACE_FRAMES;

    const effectivePinch =
      isClosedFist || pinchBlockedByClosedFist
        ? {
            isPinching: false,
            distance: pinchResult.distance,
            rawDistance: pinchResult.rawDistance,
            confidence: 0,
            reason: "blocked_by_closed_fist",
          }
        : pinchResult;

    const effectiveClosedFist =
      closedFistBlockedByPinch && !isClosedFist ? false : isClosedFist;

    this.currentPinch = effectivePinch;
    this.currentPointing = isPointing
      ? { isPointing: true, ...pointingDir }
      : { isPointing: false };
    this.currentClosedFist = effectiveClosedFist;

    if (effectivePinch.isPinching) {
      this.currentOpenHand = { isOpen: false };
      this.openHandFrameCount = 0;
      this.isOpenHandConfirmed = false;
    } else {
      this.currentOpenHand = openHandResult;
    }

    if (effectivePinch.isPinching) {
      this.pinchFrameCount++;
      if (this.pinchFrameCount >= CONFIG.FRAMES.PINCH) {
        this.isPinchConfirmed = true;
      }
    } else {
      this.pinchFrameCount = 0;
      this.isPinchConfirmed = false;
    }

    if (isPointing) {
      this.pointingFrameCount++;
      if (this.pointingFrameCount >= CONFIG.FRAMES.POINTING) {
        this.isPointingConfirmed = true;
      }
    } else {
      this.pointingFrameCount = 0;
      this.isPointingConfirmed = false;
    }

    if (effectiveClosedFist) {
      this.closedFistFrameCount++;
      if (this.closedFistFrameCount >= CONFIG.FRAMES.CLOSED_FIST) {
        this.isClosedFistConfirmed = true;
      }
    } else {
      this.closedFistFrameCount = 0;
      this.isClosedFistConfirmed = false;
    }

    if (this.currentOpenHand?.isOpen) {
      this.openHandFrameCount++;
      if (this.openHandFrameCount >= CONFIG.FRAMES.OPEN_HAND) {
        this.isOpenHandConfirmed = true;
      }
    } else {
      this.openHandFrameCount = 0;
      this.isOpenHandConfirmed = false;
    }

    const lockFramesThreshold =
      CONFIG.FRAMES?.LOCK || CONFIG.FRAMES.CLOSED_FIST || 6;
    this.currentLock = { isLock: !!isLockGesture };

    if (isLockGesture) {
      this.lockFrameCount++;
      if (this.lockFrameCount >= lockFramesThreshold) {
        this.isLockConfirmed = true;
      }
    } else {
      this.lockFrameCount = 0;
      this.isLockConfirmed = false;
    }

    return this.getState();
  }

  getState() {
    return {
      pinch: {
        detected: this.currentPinch?.isPinching || false,
        confirmed: this.isPinchConfirmed,
        frameCount: this.pinchFrameCount,
        distance: this.currentPinch?.distance,
        rawDistance: this.currentPinch?.rawDistance,
        positions: this.currentPinch?.positions,
      },
      pointing: {
        detected: this.currentPointing?.isPointing || false,
        confirmed: this.isPointingConfirmed,
        frameCount: this.pointingFrameCount,
        tip: this.currentPointing?.tip || null,
        direction: this.currentPointing?.direction || null,
        angle: this.currentPointing?.angle || null,
      },
      spherical: { detected: false, confirmed: false, frameCount: 0 },
      closedFist: {
        detected: this.currentClosedFist || false,
        confirmed: this.isClosedFistConfirmed,
        frameCount: this.closedFistFrameCount,
      },
      openHand: {
        detected: this.currentOpenHand?.isOpen || false,
        confirmed: this.isOpenHandConfirmed,
        frameCount: this.openHandFrameCount,
        palmCenter: this.currentOpenHand?.palmCenter || null,
        handSize: this.currentOpenHand?.handSize || null,
      },
      lock: {
        detected: this.currentLock?.isLock || false,
        confirmed: this.isLockConfirmed,
        frameCount: this.lockFrameCount,
      },
    };
  }

  reset() {
    this.pinchFrameCount = 0;
    this.pointingFrameCount = 0;
    this.closedFistFrameCount = 0;
    this.openHandFrameCount = 0;
    this.lockFrameCount = 0;

    this.isPinchConfirmed = false;
    this.isPointingConfirmed = false;
    this.isClosedFistConfirmed = false;
    this.isOpenHandConfirmed = false;
    this.isLockConfirmed = false;

    this.currentPinch = null;
    this.currentPointing = null;
    this.currentSpherical = false;
    this.currentClosedFist = false;
    this.currentOpenHand = null;
    this.currentLock = null;

    this.framesSinceClosedFistEnded = Infinity;
    this.framesSincePinchEnded = Infinity;
    this.dominantGesture = null;
  }

  getSummary() {
    const gestures = [];
    if (this.isPinchConfirmed) gestures.push("🤏 Pinch");
    if (this.isOpenHandConfirmed) gestures.push("🖐️ Mano Abierta");
    return gestures.length > 0 ? gestures.join(" | ") : "Sin gestos detectados";
  }
}

class MultiHandGestureDetector {
  constructor() {
    this.handDetectors = new Map();
    this.lastHandOrder = [];
    this.prioritizedLandmarks = [];
    // Estabilidad temporal: historial de manos rastreadas
    this.trackedHands = new Map(); // handId -> {framesSeen, lastSeen, centroid}
    this.frameCounter = 0;
    // Cache de confianzas de handedness
    this.handConfidences = [];
  }

  getHandCentroid(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    // Usar el wrist como punto de referencia principal
    const wrist = landmarks[0];
    const palm = landmarks[9];
    return {
      x: (wrist.x + palm.x) / 2,
      y: (wrist.y + palm.y) / 2,
      z: (wrist.z + palm.z) / 2,
    };
  }

  // Encuentra la mano rastreada mas cercana dentro de una distancia maxima
  findMatchingTrackedHand(centroid, maxDistance = 0.15) {
    let bestMatch = null;
    let bestDistance = maxDistance;

    for (const [handId, tracked] of this.trackedHands) {
      const dx = centroid.x - tracked.centroid.x;
      const dy = centroid.y - tracked.centroid.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = handId;
      }
    }
    return bestMatch;
  }

  // Calcula los frames requeridos para considerar mano estable
  getRequiredWarmupFrames(handSize) {
    const config = getHandPrioritizationConfig();
    const warmup = config.DISTANCE_WARMUP;

    if (!warmup.ENABLED) {
      return config.TEMPORAL_STABILITY.MIN_FRAMES_TO_TRACK;
    }

    // Mano cercana (grande) - warmup rápido
    if (handSize >= warmup.MEDIUM_HAND_SIZE_THRESHOLD) {
      return warmup.CLOSE_HAND_FRAMES;
    }
    // Mano a distancia media
    if (handSize >= warmup.FAR_HAND_SIZE_THRESHOLD) {
      return warmup.MEDIUM_HAND_FRAMES;
    }
    // Mano lejana (pequeña) - warmup lento
    return warmup.FAR_HAND_FRAMES;
  }

  updateTrackedHands(handsWithProximity) {
    const config = getHandPrioritizationConfig();
    const stability = config.TEMPORAL_STABILITY;

    if (!stability.ENABLED) return;

    this.frameCounter++;
    const currentHandIds = new Set();

    // Asociar cada mano detectada con una mano rastreada o crear nueva
    for (const hand of handsWithProximity) {
      const centroid = this.getHandCentroid(hand.landmarks);
      if (!centroid) continue;

      const matchedId = this.findMatchingTrackedHand(centroid);
      const requiredFrames = this.getRequiredWarmupFrames(hand.size);

      if (matchedId !== null) {
        // Actualizar mano existente
        const tracked = this.trackedHands.get(matchedId);
        tracked.framesSeen++;
        tracked.lastSeen = this.frameCounter;
        tracked.centroid = centroid;
        tracked.lastSize = hand.size;
        tracked.requiredFrames = requiredFrames;
        hand.trackedId = matchedId;
        // Estable = ha pasado el warmup requerido para su distancia
        hand.isStable = tracked.framesSeen >= requiredFrames;
        hand.warmupProgress = Math.min(1, tracked.framesSeen / requiredFrames);
        currentHandIds.add(matchedId);
      } else {
        // Nueva mano detectada
        const newId =
          this.frameCounter + "_" + Math.random().toString(36).substr(2, 5);
        this.trackedHands.set(newId, {
          framesSeen: 1,
          lastSeen: this.frameCounter,
          centroid,
          lastSize: hand.size,
          requiredFrames,
        });
        hand.trackedId = newId;
        hand.isStable = false;
        hand.warmupProgress = 1 / requiredFrames;
        currentHandIds.add(newId);
      }
    }

    // Limpiar manos que llevan mucho tiempo sin verse
    for (const [handId, tracked] of this.trackedHands) {
      if (!currentHandIds.has(handId)) {
        const framesSinceLastSeen = this.frameCounter - tracked.lastSeen;
        if (framesSinceLastSeen > stability.MAX_MEMORY_FRAMES) {
          this.trackedHands.delete(handId);
        }
      }
    }
  }

  getHandProximity(landmarks, confidence = 1) {
    if (!landmarks || landmarks.length < 21) return { score: 0, size: 0 };

    const config = getHandPrioritizationConfig();
    const proximityData = getHandProximityScore(
      landmarks,
      config.PROXIMITY_WEIGHTS,
      confidence,
    );

    return {
      score: proximityData.score,
      size: proximityData.size,
      depth: proximityData.depth,
      ...proximityData,
    };
  }

  setHandConfidences(multiHandedness) {
    this.handConfidences = (multiHandedness || []).map((h) => h?.score || 1);
  }

  prioritizeHands(hands) {
    if (!hands || hands.length === 0) return [];

    const config = getHandPrioritizationConfig();
    const stability = config.TEMPORAL_STABILITY;
    const warmup = config.DISTANCE_WARMUP;

    // Calcular proximidad compuesta para cada mano
    const handsWithProximity = hands.map((landmarks, originalIndex) => {
      const confidence = this.handConfidences[originalIndex] || 1;
      const proximityData = this.getHandProximity(landmarks, confidence);

      return {
        landmarks,
        originalIndex,
        proximity: proximityData.score,
        size: proximityData.size,
        depth: proximityData.depth,
        confidence,
        isStable: false,
        trackedId: null,
        warmupProgress: 0,
      };
    });

    // Filtrar manos demasiado pequeñas (muy lejos)
    const sizeFilteredHands = handsWithProximity.filter(
      (h) => h.size >= config.MIN_ABSOLUTE_SIZE,
    );

    if (sizeFilteredHands.length === 0) return [];

    this.updateTrackedHands(sizeFilteredHands);

    // Filtrar manos que no han completado el warmup requerido para su distancia
    // Esto previene que manos lejanas/erráticas sean reconocidas inmediatamente
    let warmedUpHands = sizeFilteredHands;
    if (warmup.ENABLED) {
      warmedUpHands = sizeFilteredHands.filter((h) => h.isStable);

      if (warmedUpHands.length === 0) {
        return [];
      }
    }

    if (stability.ENABLED) {
      for (const hand of warmedUpHands) {
        if (hand.isStable) {
          hand.proximity += stability.TRACKING_BONUS;
        }
      }
    }

    // Ordenar por proximidad (mayor = más cerca/prioritaria)
    warmedUpHands.sort((a, b) => b.proximity - a.proximity);

    const maxProximity = warmedUpHands[0]?.proximity || 0;
    const minAcceptableProximity = maxProximity * config.MIN_HAND_SIZE_RATIO;

    const filteredHands = warmedUpHands.filter(
      (h) => h.proximity >= minAcceptableProximity,
    );

    // Limitar al máximo de manos configurado
    const prioritizedHands = filteredHands.slice(0, config.MAX_HANDS);

    return prioritizedHands;
  }

  // Obtiene los landmarks de las manos prioritarias (las mas cercanas)
  getPrioritizedLandmarks() {
    return this.prioritizedLandmarks;
  }

  detectAll(hands, multiHandedness = null) {
    // Actualizar confianzas si se proporcionan
    if (multiHandedness) {
      this.setHandConfidences(multiHandedness);
    }

    if (!hands || hands.length === 0) {
      this.reset();
      return this.getState();
    }

    const prioritizedHands = this.prioritizeHands(hands);

    if (prioritizedHands.length === 0) {
      this.reset();
      return this.getState();
    }

    this.prioritizedLandmarks = prioritizedHands.map((h) => h.landmarks);

    for (let i = 0; i < prioritizedHands.length; i++) {
      if (!this.handDetectors.has(i)) {
        this.handDetectors.set(i, new SingleHandGestureDetector());
      }
      this.handDetectors.get(i).detect(prioritizedHands[i].landmarks);
    }

    for (const [index] of this.handDetectors) {
      if (index >= prioritizedHands.length) {
        this.handDetectors.delete(index);
      }
    }

    this.lastHandOrder = prioritizedHands.map((h) => h.originalIndex);

    return this.getState();
  }

  detect(landmarks) {
    if (!this.handDetectors.has(0)) {
      this.handDetectors.set(0, new SingleHandGestureDetector());
    }
    return this.handDetectors.get(0).detect(landmarks);
  }

  getHandState(handIndex) {
    const detector = this.handDetectors.get(handIndex);
    return detector ? detector.getState() : null;
  }

  getState() {
    const handStates = [];
    for (let i = 0; i < this.handDetectors.size; i++) {
      const detector = this.handDetectors.get(i);
      if (detector) {
        handStates.push({
          handIndex: i,
          ...detector.getState(),
        });
      }
    }

    const anyPinchConfirmed = handStates.some((h) => h.pinch.confirmed);
    const handsWithPinch = handStates.filter((h) => h.pinch.confirmed);
    const bothHandsPinching = handsWithPinch.length >= 2;

    const anyPointingConfirmed = handStates.some((h) => h.pointing?.confirmed);
    const handsWithPointing = handStates.filter((h) => h.pointing?.confirmed);

    const anySphericalConfirmed = false;
    const anyClosedFistConfirmed = handStates.some(
      (h) => h.closedFist?.confirmed,
    );
    const handsWithClosedFist = handStates.filter(
      (h) => h.closedFist?.confirmed,
    );
    const anyOpenHandConfirmed = handStates.some((h) => h.openHand?.confirmed);
    const anyLockConfirmed = handStates.some((h) => h.lock?.confirmed);

    const handsWithOpenHand = handStates.filter((h) => h.openHand?.confirmed);
    const handsWithLock = handStates.filter((h) => h.lock?.confirmed);

    return {
      hands: handStates,
      handCount: handStates.length,
      prioritizedLandmarks: this.prioritizedLandmarks,
      pinch: handStates[0]?.pinch || {
        detected: false,
        confirmed: false,
        frameCount: 0,
      },
      pointing: handStates[0]?.pointing || {
        detected: false,
        confirmed: false,
        frameCount: 0,
      },
      spherical: { detected: false, confirmed: false, frameCount: 0 },
      closedFist: handStates[0]?.closedFist || {
        detected: false,
        confirmed: false,
        frameCount: 0,
      },
      openHand: handStates[0]?.openHand || {
        detected: false,
        confirmed: false,
        frameCount: 0,
      },
      lock: handStates[0]?.lock || {
        detected: false,
        confirmed: false,
        frameCount: 0,
      },

      anyPinch: anyPinchConfirmed,
      anyPointing: anyPointingConfirmed,
      anySpherical: anySphericalConfirmed,
      anyClosedFist: anyClosedFistConfirmed,
      anyOpenHand: anyOpenHandConfirmed,
      anyLock: anyLockConfirmed,

      bothHandsPinching,
      handsWithPinch,
      handsWithPointing,
      handsWithClosedFist,
      handsWithOpenHand,
      handsWithLock,
    };
  }

  reset() {
    this.handDetectors.forEach((detector) => detector.reset());
    this.handDetectors.clear();
    this.lastHandOrder = [];
    this.prioritizedLandmarks = [];
    this.handConfidences = [];
  }

  fullReset() {
    this.reset();
    this.trackedHands.clear();
    this.frameCounter = 0;
  }

  getSummary() {
    const state = this.getState();
    if (state.bothHandsPinching) {
      return "🤏🤏 Doble Pinch";
    } else if (state.anyPinch) {
      return "🤏 Pinch";
    }
    return "Sin gestos detectados";
  }
}

export const gestureDetector = new MultiHandGestureDetector();
export { SingleHandGestureDetector, MultiHandGestureDetector };
