import { CONFIG } from "../config.js";

// ─── Singleton state ──────────────────────────────────────────────────────────
// One MediaPipe instance per page. Keeps camera/hands alive and restarts
// automatically if the frame/results pipeline stalls.
const _s = {
  hands: null,
  camera: null,
  videoElement: null,
  onResultsCallback: null,
  isStarted: false,
  isRestarting: false,
  lastFrameAt: 0,
  lastResultsAt: 0,
  lastHandDetectedAt: 0,
  watchdogTimer: null,
  restartDebounceTimer: null,
};

const STALE_MS = 3000;         // Restart if no results for 3 s
const RESTART_DEBOUNCE_MS = 5000; // Minimum gap between restarts
const LOG_GAP_MS = 2000;       // Throttle noisy per-frame logs

let _lastNoHandLog = 0;
let _lastResultsLog = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _log(msg) {
  console.log(`[HAND_TRACKING] ${msg}`);
}

function _throttleLog(key, msg) {
  const now = Date.now();
  if (key === "noHand") {
    if (now - _lastNoHandLog < LOG_GAP_MS) return;
    _lastNoHandLog = now;
  } else if (key === "results") {
    if (now - _lastResultsLog < LOG_GAP_MS) return;
    _lastResultsLog = now;
  }
  _log(msg);
}

function _dispatch(name) {
  document.dispatchEvent(new CustomEvent("hand-tracking:" + name));
}

// ─── Results interceptor ─────────────────────────────────────────────────────

function _wrappedOnResults(results) {
  _s.lastResultsAt = Date.now();
  _throttleLog("results", "Results received");

  const detected = (results.multiHandLandmarks || []).length > 0;
  if (detected) {
    _s.lastHandDetectedAt = Date.now();
  } else {
    _throttleLog("noHand", "No hand detected");
  }

  _s.onResultsCallback?.(results);
}

// ─── MediaPipe factory ───────────────────────────────────────────────────────

function _buildHands() {
  const perf = CONFIG.PERFORMANCE || {};
  const h = new window.Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
  });
  h.setOptions({
    maxNumHands: 2,
    modelComplexity: perf.MODEL_COMPLEXITY ?? 0,
    minDetectionConfidence: perf.MIN_DETECTION_CONFIDENCE ?? 0.5,
    minTrackingConfidence: perf.MIN_TRACKING_CONFIDENCE ?? 0.5,
  });
  h.onResults(_wrappedOnResults);
  return h;
}

function _buildCamera(videoEl, handsInstance) {
  const perf = CONFIG.PERFORMANCE || {};
  return new window.Camera(videoEl, {
    onFrame: async () => {
      _s.lastFrameAt = Date.now();
      try {
        await handsInstance.send({ image: videoEl });
      } catch (err) {
        console.warn("[HAND_TRACKING] hands.send error:", err.message || err);
      }
    },
    width: perf.CAMERA_WIDTH ?? 480,
    height: perf.CAMERA_HEIGHT ?? 360,
  });
}

// ─── Restart ─────────────────────────────────────────────────────────────────

async function _doRestart() {
  if (_s.isRestarting) return;
  _s.isRestarting = true;
  _log("Stale results detected, restarting camera");
  _dispatch("restarting");

  try {
    if (_s.camera) {
      try { _s.camera.stop(); } catch (_) { /* ignore */ }
      _s.camera = null;
    }
    if (_s.hands) {
      try { _s.hands.close(); } catch (_) { /* ignore */ }
      _s.hands = null;
    }

    await new Promise((r) => setTimeout(r, 400));

    _s.hands = _buildHands();
    _s.camera = _buildCamera(_s.videoElement, _s.hands);

    // Reset timestamps before start to give a fresh grace period
    const now = Date.now();
    _s.lastFrameAt = now;
    _s.lastResultsAt = now;

    await _s.camera.start();
    _log("Camera restart completed");
    _log("Camera started");
    _dispatch("restarted");
  } catch (err) {
    console.error("[HAND_TRACKING] Restart failed:", err.message || err);
  } finally {
    _s.isRestarting = false;
  }
}

function _scheduleRestart() {
  if (_s.restartDebounceTimer) return;            // Already scheduled
  _s.restartDebounceTimer = setTimeout(() => {
    _s.restartDebounceTimer = null;
    if (_s.isStarted && !_s.isRestarting) _doRestart();
  }, RESTART_DEBOUNCE_MS);
}

// ─── Watchdog ────────────────────────────────────────────────────────────────

function _watchdog() {
  if (!_s.isStarted || _s.isRestarting) return;
  if (document.visibilityState !== "visible") return;

  const now = Date.now();
  const ref = _s.lastResultsAt || _s.lastFrameAt;
  if (ref === 0) return; // Camera not started yet

  if (now - ref > STALE_MS) {
    _log(`Stale results detected (${now - ref}ms since last result), scheduling restart`);
    _scheduleRestart();
  }
}

// ─── Visibility change ───────────────────────────────────────────────────────

function _onVisibilityChange() {
  if (document.visibilityState === "visible" && _s.isStarted) {
    // Reset timestamps so the watchdog doesn't immediately trigger
    const now = Date.now();
    _s.lastFrameAt = now;
    _s.lastResultsAt = now;
    _log("Page visible again — timestamps reset");
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize (or re-initialize) MediaPipe on the given video element.
 * Safe to call once per page — subsequent calls tear down the previous instance.
 */
export function initMediaPipe(videoElement, onResultsCallback) {
  if (!window.Hands || !window.Camera) {
    throw new Error(
      "[HAND_TRACKING] Hands/Camera not defined. " +
        "Load hands.js and camera_utils.js before the module.",
    );
  }

  // Tear down any existing instance
  _teardown();

  const perf = CONFIG.PERFORMANCE || {};
  _s.videoElement = videoElement;
  _s.onResultsCallback = onResultsCallback;
  _s.isStarted = true;
  _s.isRestarting = false;
  _s.lastFrameAt = Date.now();
  _s.lastResultsAt = Date.now();
  _s.lastHandDetectedAt = 0;

  _s.hands = _buildHands();
  _s.camera = _buildCamera(videoElement, _s.hands);

  _s.camera.start()
    .then(() => {
      _log("Camera started");
    })
    .catch((err) => {
      console.error("[HAND_TRACKING] Camera start failed:", err.message || err);
    });

  // Watchdog — check every second
  _s.watchdogTimer = setInterval(_watchdog, 1000);

  // Visibility change — reset timestamps on tab-back so watchdog doesn't fire
  document.removeEventListener("visibilitychange", _onVisibilityChange);
  document.addEventListener("visibilitychange", _onVisibilityChange);

  const cx = perf.MODEL_COMPLEXITY ?? 0;
  const cw = perf.CAMERA_WIDTH ?? 480;
  const ch = perf.CAMERA_HEIGHT ?? 360;
  const md = perf.MIN_DETECTION_CONFIDENCE ?? 0.5;
  const mt = perf.MIN_TRACKING_CONFIDENCE ?? 0.5;
  console.log(
    `[HAND_TRACKING] Initialized | complexity=${cx} | ${cw}×${ch} | detection=${md} | tracking=${mt}`,
  );

  return { hands: _s.hands, camera: _s.camera };
}

/**
 * Stop hand tracking and clean up all resources.
 */
export function stopHandTracking() {
  _s.isStarted = false;
  _teardown();
  document.removeEventListener("visibilitychange", _onVisibilityChange);
  _log("Hand tracking stopped");
}

function _teardown() {
  if (_s.watchdogTimer) {
    clearInterval(_s.watchdogTimer);
    _s.watchdogTimer = null;
  }
  if (_s.restartDebounceTimer) {
    clearTimeout(_s.restartDebounceTimer);
    _s.restartDebounceTimer = null;
  }
  if (_s.camera) {
    try { _s.camera.stop(); } catch (_) { /* ignore */ }
    _s.camera = null;
  }
  if (_s.hands) {
    try { _s.hands.close(); } catch (_) { /* ignore */ }
    _s.hands = null;
  }
}
