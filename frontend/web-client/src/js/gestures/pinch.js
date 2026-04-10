import { getLandmarks, getHandSize } from "./base.js";
import { distance3D, distance2D } from "../utils/math.js";
import { CONFIG } from "../config.js";
import { detectSphericalGrip } from "./spherical.js";

let wasPinching = false;

export function detectPinchGesture(landmarks) {
  const l = getLandmarks(landmarks);
  if (!l)
    return {
      isPinching: false,
      distance: null,
      rawDistance: null,
      confidence: 0,
    };

  const handSize = getHandSize(landmarks);
  const pinchDistance = distance3D(l.thumbTip, l.indexTip);
  const normalizedDistance = pinchDistance / handSize;

  // ── VALIDACIÓN 0: No es agarre esférico - los dedos no están curvados hacia dentro────────────────────
  if (detectSphericalGrip(landmarks)) {
    wasPinching = false;
    return {
      isPinching: false,
      distance: normalizedDistance,
      rawDistance: pinchDistance,
      confidence: 0,
      reason: "spherical",
    };
  }

  // ── VALIDACIÓN 0.5: No es puño cerrado ─────────────────────
  const indexCurled =
    distance2D(l.indexTip, l.wrist) < distance2D(l.indexMCP, l.wrist) * 0.95;
  const middleCurled =
    distance2D(l.middleTip, l.wrist) < distance2D(l.middleMCP, l.wrist) * 0.95;
  const ringCurled =
    distance2D(l.ringTip, l.wrist) < distance2D(l.ringMCP, l.wrist) * 0.95;

  // Si el índice Y al menos otros 2 dedos están curvados, probablemente es puño
  const curledCount = [indexCurled, middleCurled, ringCurled].filter(
    Boolean,
  ).length;
  if (indexCurled && curledCount >= 2) {
    wasPinching = false;
    return {
      isPinching: false,
      distance: normalizedDistance,
      rawDistance: pinchDistance,
      confidence: 0,
      reason: "closed_fist_detected",
    };
  }

  // ── VALIDACIÓN 1: Distancia ────────────────────────────────
  const threshold = wasPinching
    ? CONFIG.THRESHOLDS.PINCH_EXIT
    : CONFIG.THRESHOLDS.PINCH_ENTER;

  if (normalizedDistance >= threshold) {
    wasPinching = false;
    return {
      isPinching: false,
      distance: normalizedDistance,
      rawDistance: pinchDistance,
      confidence: 0,
      reason: "distance",
    };
  }

  // ── VALIDACIÓN 2: Índice es el más cercano al pulgar ───────
  const middleDist = distance3D(l.middleTip, l.thumbTip);
  const ringDist = distance3D(l.ringTip, l.thumbTip);
  const pinkyDist = distance3D(l.pinkyTip, l.thumbTip);

  const indexIsClosest =
    pinchDistance <= middleDist * 1.4 &&
    pinchDistance <= ringDist * 1.4 &&
    pinchDistance <= pinkyDist * 1.4;

  if (!indexIsClosest) {
    wasPinching = false;
    return {
      isPinching: false,
      distance: normalizedDistance,
      rawDistance: pinchDistance,
      confidence: 0,
      reason: "index_not_closest",
    };
  }

  // ── PINCH DETECTADO ───────────────────────────────────────
  const distanceScore = 1 - normalizedDistance / threshold;
  const confidence = Math.min(1.0, Math.max(0, 0.5 + distanceScore * 0.5));

  wasPinching = true;

  return {
    isPinching: true,
    distance: normalizedDistance,
    rawDistance: pinchDistance,
    confidence,
  };
}

export function getThumbIndexPinchPositions(landmarks) {
  const l = getLandmarks(landmarks);
  if (!l) return null;

  const pinchResult = detectPinchGesture(landmarks);
  if (!pinchResult.isPinching) return null;

  if (pinchResult.distance >= CONFIG.THRESHOLDS.PINCH_MOVE) return null;

  return {
    x: (l.thumbTip.x + l.indexTip.x) / 2,
    y: (l.thumbTip.y + l.indexTip.y) / 2,
    confidence: pinchResult.confidence,
  };
}
