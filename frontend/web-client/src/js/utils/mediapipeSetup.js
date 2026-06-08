import { CONFIG } from "../config.js";

export function initMediaPipe(videoElement, onResultsCallback) {
  if (!window.Hands || !window.Camera) {
    throw new Error(
      "[HAND_TRACKING] Hands/Camera not defined. " +
        "Load hands.js and camera_utils.js before the module.",
    );
  }

  const perf = CONFIG.PERFORMANCE || {};
  const modelComplexity = perf.MODEL_COMPLEXITY ?? 0;
  const minDetection = perf.MIN_DETECTION_CONFIDENCE ?? 0.5;
  const minTracking = perf.MIN_TRACKING_CONFIDENCE ?? 0.5;
  const cameraWidth = perf.CAMERA_WIDTH ?? 480;
  const cameraHeight = perf.CAMERA_HEIGHT ?? 360;

  const hands = new window.Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity,
    minDetectionConfidence: minDetection,
    minTrackingConfidence: minTracking,
  });

  hands.onResults(onResultsCallback);

  const camera = new window.Camera(videoElement, {
    onFrame: async () => {
      try {
        await hands.send({ image: videoElement });
      } catch (err) {
        console.error("[HAND_TRACKING] Error:", err.message || err);
      }
    },
    width: cameraWidth,
    height: cameraHeight,
  });

  camera.start();

  console.log(
    `[HAND_TRACKING] Initialized | complexity=${modelComplexity} | ${cameraWidth}×${cameraHeight} | detection=${minDetection} | tracking=${minTracking}`,
  );

  return { hands, camera };
}
