import { CONFIG } from "../config.js";

export function initMediaPipe(videoElement, onResultsCallback) {
  const HandsCtor = window.Hands;
  const CameraCtor = window.Camera;

  if (!HandsCtor || !CameraCtor) {
    throw new Error(
      "[mediapipeSetup] Hands/Camera no están definidos. " +
        "Carga hands.js y camera_utils.js en el HTML antes del módulo.",
    );
  }

  // Get performance settings from config
  const perf = CONFIG.PERFORMANCE || {};
  const modelComplexity = perf.MODEL_COMPLEXITY ?? 0; // Default to lite model for speed
  const minDetection = perf.MIN_DETECTION_CONFIDENCE ?? 0.6;
  const minTracking = perf.MIN_TRACKING_CONFIDENCE ?? 0.6;
  const cameraWidth = perf.CAMERA_WIDTH ?? 480;
  const cameraHeight = perf.CAMERA_HEIGHT ?? 360;

  const hands = new HandsCtor({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: modelComplexity, // 0=lite (faster), 1=full
    minDetectionConfidence: minDetection,
    minTrackingConfidence: minTracking,
  });

  hands.onResults(onResultsCallback);

  const camera = new CameraCtor(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: cameraWidth,
    height: cameraHeight,
  });

  camera.start();

  console.log(
    `[MediaPipe] Initialized: complexity=${modelComplexity}, ${cameraWidth}x${cameraHeight}`,
  );

  return { hands, camera };
}
