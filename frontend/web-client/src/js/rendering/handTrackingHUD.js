/**
 * Hand Tracking Visualization Module
 * Shared UX components for hand tracking feedback across all pages
 *
 * PERFORMANCE OPTIMIZED:
 * - Cached DOM elements (no getElementById per frame)
 * - Throttled updates (every 3rd frame for HUD, every 2nd for stability)
 * - Pre-created stability bar elements (no innerHTML rebuilds)
 * - Batched DOM updates
 */

import { CONFIG } from "../config.js";
import { getHandProximityScore } from "../gestures/base.js";
import { gestureDetector } from "../gestures/detector.js";

// State for hand tracking visualization
const htState = {
  stabilityHistory: [],
  lastGestureFeedback: null,
  gestureFeedbackTimeout: null,
  initialized: false,
  frameCount: 0,
  lastUpdateFrame: 0,
  // Cached DOM elements for performance
  elements: null,
  // Pre-created stability bars
  stabilityBars: [],
};

// Performance config
const PERF = {
  HUD_UPDATE_INTERVAL: 3, // Update HUD every N frames
  STABILITY_UPDATE_INTERVAL: 2, // Update stability every N frames
  MAX_STABILITY_BARS: 10,
};

/**
 * Initializes the hand tracking HUD elements in the DOM
 * Call this on page load
 */
export function initHandTrackingHUD() {
  if (htState.initialized) return;

  // Check if HUD elements already exist
  let existingHud = document.getElementById("hand-tracking-hud");
  if (!existingHud) {
    // Create HUD elements dynamically
    createHandTrackingElements();
  }

  // Cache all DOM elements for performance (avoid getElementById per frame)
  cacheElements();

  // Pre-create stability bar elements
  createStabilityBars();

  htState.initialized = true;
}

/**
 * Cache DOM element references for performance
 */
function cacheElements() {
  htState.elements = {
    hud: document.getElementById("hand-tracking-hud"),
    hudStatus: document.getElementById("hud-status"),
    hudDistance: document.getElementById("hud-distance"),
    hudConfidence: document.getElementById("hud-confidence"),
    warmupProgress: document.getElementById("warmup-progress"),
    warmupFill: document.getElementById("warmup-fill"),
    warmupPercent: document.getElementById("warmup-percent"),
    stabilityIndicator: document.getElementById("stability-indicator"),
    distanceFill: document.getElementById("hand-distance-fill"),
    distanceBadge: document.getElementById("distance-badge"),
    handStatusText: document.getElementById("hand-status-text"),
    gestureBadge: document.getElementById("gesture-feedback-badge"),
    gestureText: document.getElementById("gesture-feedback-text"),
  };

  // Cache status text element
  if (htState.elements.hudStatus) {
    htState.elements.hudStatusText =
      htState.elements.hudStatus.querySelector("span:last-child");
  }

  // Cache gesture badge icon
  if (htState.elements.gestureBadge) {
    htState.elements.gestureIcon =
      htState.elements.gestureBadge.querySelector("i");
  }
}

/**
 * Pre-create stability bar DOM elements (avoid innerHTML per frame)
 */
function createStabilityBars() {
  const container = htState.elements?.stabilityIndicator;
  if (!container) return;

  // Clear and create fixed number of bar elements
  container.innerHTML = "";
  htState.stabilityBars = [];

  for (let i = 0; i < PERF.MAX_STABILITY_BARS; i++) {
    const bar = document.createElement("div");
    bar.className = "stability-bar";
    bar.style.height = "4px";
    bar.style.opacity = "0";
    container.appendChild(bar);
    htState.stabilityBars.push(bar);
  }
}

/**
 * Creates the hand tracking HUD and gesture feedback elements
 */
function createHandTrackingElements() {
  // Create Hand Tracking HUD
  const hud = document.createElement("div");
  hud.className = "hand-tracking-hud";
  hud.id = "hand-tracking-hud";
  hud.innerHTML = `
    <div class="hud-header">
      <span class="hud-title"><i class="fa-solid fa-hand"></i> Hand Tracking</span>
      <span class="hud-status" id="hud-status">
        <span class="status-indicator"></span>
        <span>Inactive</span>
      </span>
    </div>
   
    <div class="hud-metric">
      <span class="hud-metric-label"><i class="fa-solid fa-ruler"></i> Distance</span>
      <span class="hud-metric-value" id="hud-distance">--</span>
    </div>
   
    <div class="hud-metric">
      <span class="hud-metric-label"><i class="fa-solid fa-bullseye"></i> Confidence</span>
      <span class="hud-metric-value" id="hud-confidence">--</span>
    </div>
   
    <div class="warmup-progress" id="warmup-progress">
      <div class="warmup-label">
        <span>Warmup</span>
        <span id="warmup-percent">0%</span>
      </div>
      <div class="warmup-bar">
        <div class="warmup-fill" id="warmup-fill" style="width: 0%"></div>
      </div>
    </div>
   
    <div class="stability-indicator" id="stability-indicator"></div>
  `;
  document.body.appendChild(hud);

  // Create Gesture Feedback Badge
  const badge = document.createElement("div");
  badge.className = "gesture-feedback-badge";
  badge.id = "gesture-feedback-badge";
  badge.innerHTML = `
    <i class="fa-solid fa-hand-pointer"></i>
    <span id="gesture-feedback-text">Gesture detected</span>
  `;
  document.body.appendChild(badge);
}

/**
 * Updates the hand tracking HUD with current tracking data
 * Call this in your onResults callback
 *
 * PERFORMANCE: Uses cached elements and throttled updates
 */
export function updateHandTrackingHUD(hands, handedness, gestureState) {
  // Increment frame counter
  htState.frameCount++;

  // Use cached elements (fall back to getElementById if not cached)
  const el = htState.elements || {};
  const hud = el.hud || document.getElementById("hand-tracking-hud");

  if (!hud) return;

  // Show/hide HUD based on hand detection
  if (!hands || hands.length === 0) {
    hud.classList.remove("show");

    // Only update text when state changes (not every frame)
    if (htState.lastHandState !== "none") {
      htState.lastHandState = "none";
      if (el.hudStatusText) {
        el.hudStatus.className = "hud-status inactive";
        el.hudStatusText.textContent = "No Hand";
      }
      if (el.distanceFill) el.distanceFill.style.height = "0%";
      if (el.distanceBadge) {
        el.distanceBadge.textContent = "--";
        el.distanceBadge.className = "distance-badge";
      }
      if (el.handStatusText) el.handStatusText.textContent = "No Hand";
      htState.stabilityHistory = [];
      // Reset stability bars
      htState.stabilityBars.forEach((bar) => {
        bar.style.opacity = "0";
      });
    }
    return;
  }

  htState.lastHandState = "detected";
  hud.classList.add("show");

  // THROTTLE: Only update most HUD elements every N frames
  const shouldUpdateHUD =
    htState.frameCount - htState.lastUpdateFrame >= PERF.HUD_UPDATE_INTERVAL;

  if (!shouldUpdateHUD) {
    // Still update stability indicator more frequently
    if (htState.frameCount % PERF.STABILITY_UPDATE_INTERVAL === 0) {
      const primaryHand = hands[0];
      const confidence = handedness?.[0]?.score || 1;
      const proximityWeights = CONFIG.HAND_PRIORITIZATION
        ?.PROXIMITY_WEIGHTS || {
        SIZE: 0.5,
        DEPTH: 0.35,
        CONFIDENCE: 0.15,
      };
      const proximityData = getHandProximityScore(
        primaryHand,
        proximityWeights,
        confidence,
      );
      updateStabilityBars(proximityData.score);
    }
    return;
  }

  htState.lastUpdateFrame = htState.frameCount;

  // Get primary hand data
  const primaryHand = hands[0];
  const primaryHandedness = handedness?.[0];
  const confidence = primaryHandedness?.score || 1;

  // Calculate proximity data
  const proximityWeights = CONFIG.HAND_PRIORITIZATION?.PROXIMITY_WEIGHTS || {
    SIZE: 0.5,
    DEPTH: 0.35,
    CONFIDENCE: 0.15,
  };
  const proximityData = getHandProximityScore(
    primaryHand,
    proximityWeights,
    confidence,
  );
  const handSize = proximityData.size;

  // Determine distance category
  const warmupConfig = CONFIG.HAND_PRIORITIZATION?.DISTANCE_WARMUP || {
    FAR_HAND_SIZE_THRESHOLD: 0.12,
    MEDIUM_HAND_SIZE_THRESHOLD: 0.15,
  };

  let distanceCategory = "close";
  let distanceLabel = "Close";
  if (handSize < warmupConfig.FAR_HAND_SIZE_THRESHOLD) {
    distanceCategory = "far";
    distanceLabel = "Far";
  } else if (handSize < warmupConfig.MEDIUM_HAND_SIZE_THRESHOLD) {
    distanceCategory = "medium";
    distanceLabel = "Medium";
  }

  // Batch DOM updates
  const distancePercent = Math.min(
    100,
    Math.max(0, ((handSize - 0.05) / 0.2) * 100),
  );

  if (el.distanceFill) el.distanceFill.style.height = `${distancePercent}%`;
  if (el.distanceBadge) {
    el.distanceBadge.textContent = distanceLabel;
    el.distanceBadge.className = `distance-badge ${distanceCategory}`;
  }
  if (el.handStatusText) el.handStatusText.textContent = "Hand Detected";
  if (el.hudDistance) {
    el.hudDistance.textContent = distanceLabel;
    el.hudDistance.className = `hud-metric-value ${distanceCategory}`;
  }

  // Update confidence
  if (el.hudConfidence) {
    const confidencePercent = Math.round(confidence * 100);
    el.hudConfidence.textContent = `${confidencePercent}%`;
    el.hudConfidence.className = `hud-metric-value ${confidence > 0.85 ? "close" : confidence > 0.7 ? "medium" : "far"}`;
  }

  // Update warmup progress
  const trackedHands = gestureDetector.trackedHands;
  let warmupProgressValue = 0;
  let isWarmedUp = false;

  if (trackedHands && trackedHands.size > 0) {
    const firstTracked = trackedHands.values().next().value;
    if (firstTracked) {
      const requiredFrames = firstTracked.requiredFrames || 3;
      warmupProgressValue = Math.min(
        1,
        firstTracked.framesSeen / requiredFrames,
      );
      isWarmedUp = warmupProgressValue >= 1;
    }
  }

  if (el.warmupFill && el.warmupPercent) {
    const warmupPercentValue = Math.round(warmupProgressValue * 100);
    el.warmupFill.style.width = `${warmupPercentValue}%`;
    el.warmupPercent.textContent = `${warmupPercentValue}%`;

    if (isWarmedUp) {
      el.warmupFill.classList.add("complete");
      if (el.warmupProgress) el.warmupProgress.style.opacity = "0.5";
    } else {
      el.warmupFill.classList.remove("complete");
      if (el.warmupProgress) el.warmupProgress.style.opacity = "1";
    }
  }

  // Update HUD status
  if (el.hudStatus && el.hudStatusText) {
    if (isWarmedUp) {
      el.hudStatus.className = "hud-status";
      el.hudStatusText.textContent = "Active";
    } else {
      el.hudStatus.className = "hud-status warming-up";
      el.hudStatusText.textContent = "Warming Up";
    }
  }

  // Update stability bars
  updateStabilityBars(proximityData.score);
}

/**
 * Updates stability bars using pre-created elements (no innerHTML rebuilds)
 */
function updateStabilityBars(currentScore) {
  // Keep last N scores
  htState.stabilityHistory.push(currentScore);
  if (htState.stabilityHistory.length > PERF.MAX_STABILITY_BARS) {
    htState.stabilityHistory.shift();
  }

  // Update pre-created bar elements
  const historyLen = htState.stabilityHistory.length;
  htState.stabilityBars.forEach((bar, idx) => {
    if (idx < historyLen) {
      const score = htState.stabilityHistory[idx];
      const height = Math.max(4, score * 18);
      const opacity = 0.3 + (idx / historyLen) * 0.7;
      bar.style.height = `${height}px`;
      bar.style.opacity = opacity;
    } else {
      bar.style.opacity = "0";
    }
  });
}

/**
 * Shows a gesture feedback badge (uses cached elements)
 */
export function showGestureFeedback(gesture, isConfirmed = false) {
  // Use cached elements
  const el = htState.elements || {};
  const badge =
    el.gestureBadge || document.getElementById("gesture-feedback-badge");
  const text =
    el.gestureText || document.getElementById("gesture-feedback-text");

  if (!badge || !text) return;

  const gestureLabels = {
    pinch: { icon: "fa-hand-pinching", label: "Pinch" },
    openHand: { icon: "fa-hand", label: "Open Hand" },
    closedFist: { icon: "fa-hand-fist", label: "Closed Fist" },
    pointing: { icon: "fa-hand-pointer", label: "Pointing" },
    lock: { icon: "fa-lock", label: "Lock" },
  };

  const info = gestureLabels[gesture];
  if (!info) return;

  // Don't show duplicate feedback
  if (htState.lastGestureFeedback === gesture && !isConfirmed) return;
  htState.lastGestureFeedback = gesture;

  const icon = el.gestureIcon || badge.querySelector("i");
  if (icon) icon.className = `fa-solid ${info.icon}`;

  text.textContent = isConfirmed
    ? `${info.label} Confirmed!`
    : `${info.label} Detected`;
  badge.className = `gesture-feedback-badge show ${isConfirmed ? "success" : ""}`;

  // Clear previous timeout
  if (htState.gestureFeedbackTimeout) {
    clearTimeout(htState.gestureFeedbackTimeout);
  }

  // Hide after delay
  htState.gestureFeedbackTimeout = setTimeout(
    () => {
      badge.classList.remove("show", "success");
      htState.lastGestureFeedback = null;
    },
    isConfirmed ? 1000 : 500,
  );
}

/**
 * Process gesture state and show appropriate feedback
 */
export function processGestureFeedback(gestureState) {
  if (!gestureState?.hands?.length) return;

  const hand = gestureState.hands[0];

  if (hand?.pinch?.confirmed) {
    showGestureFeedback("pinch", true);
  } else if (hand?.pinch?.detected) {
    showGestureFeedback("pinch", false);
  }

  if (hand?.openHand?.confirmed) {
    showGestureFeedback("openHand", true);
  }

  if (hand?.closedFist?.confirmed) {
    showGestureFeedback("closedFist", true);
  }

  if (hand?.pointing?.confirmed) {
    showGestureFeedback("pointing", true);
  }

  if (hand?.lock?.confirmed) {
    showGestureFeedback("lock", true);
  }
}

/**
 * Hides the hand tracking HUD
 */
export function hideHandTrackingHUD() {
  const hud = document.getElementById("hand-tracking-hud");
  if (hud) {
    hud.classList.remove("show");
  }
}

