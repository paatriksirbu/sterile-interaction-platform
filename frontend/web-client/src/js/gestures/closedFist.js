import { getLandmarks, getHandSize } from "./base.js";
import { distance3D, distance2D } from "../utils/math.js";
import { detectSphericalGrip } from "./spherical.js";
import { CONFIG } from "../config.js";

export function detectClosedFist(landmarks) {
  const l = getLandmarks(landmarks);
  if (!l) return false;

  const handSize = getHandSize(landmarks);

  // DEDOS CURVADOS
  const indexCurled =
    distance2D(l.indexTip, l.wrist) < distance2D(l.indexMCP, l.wrist) * 0.95;
  const middleCurled =
    distance2D(l.middleTip, l.wrist) < distance2D(l.middleMCP, l.wrist) * 0.95;
  const ringCurled =
    distance2D(l.ringTip, l.wrist) < distance2D(l.ringMCP, l.wrist) * 0.95;
  const pinkyCurled =
    distance2D(l.pinkyTip, l.wrist) < distance2D(l.pinkyMCP, l.wrist) * 0.95;

  // Contar dedos curvados
  const curledCount = [
    indexCurled,
    middleCurled,
    ringCurled,
    pinkyCurled,
  ].filter(Boolean).length;
  const enoughFingersCurled = curledCount >= 3;

  // PULGAR DOBLADO HACIA LA PALMA
  const thumbTipToWrist = distance2D(l.thumbTip, l.wrist);
  const thumbBaseToWrist = distance2D(l.thumbMCP, l.wrist);
  const thumbBent = thumbTipToWrist < thumbBaseToWrist * 1.4;

  // El pulgar debe estar cerca de ALGUNA parte de los dedos curvados
  const thumbToIndexPIP = distance3D(l.thumbTip, l.indexPIP);
  const thumbToMiddlePIP = distance3D(l.thumbTip, l.middlePIP);
  const thumbToMiddleTip = distance3D(l.thumbTip, l.middleTip);
  const thumbToRingPIP = distance3D(l.thumbTip, l.ringPIP);
  const thumbToRingTip = distance3D(l.thumbTip, l.ringTip);
  const thumbToPinkyPIP = distance3D(l.thumbTip, l.pinkyPIP);
  const thumbToPinkyTip = distance3D(l.thumbTip, l.pinkyTip);

  // Umbrales muy permisivos para la posición del pulgar
  const thumbNearFingers =
    thumbToIndexPIP < handSize * 0.5 ||
    thumbToMiddlePIP < handSize * 0.5 ||
    thumbToMiddleTip < handSize * 0.5 ||
    thumbToRingPIP < handSize * 0.55 ||
    thumbToRingTip < handSize * 0.55 ||
    thumbToPinkyPIP < handSize * 0.6 ||
    thumbToPinkyTip < handSize * 0.6;

  const thumbToIndexTip = distance3D(l.thumbTip, l.indexTip);
  const thumbNotPinching = thumbToIndexTip > handSize * 0.18;

  const notSpherical = !detectSphericalGrip(landmarks);

  return (
    enoughFingersCurled &&
    thumbBent &&
    thumbNearFingers &&
    thumbNotPinching &&
    notSpherical
  );
}
