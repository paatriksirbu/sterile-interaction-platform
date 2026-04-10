import { getLandmarks, getHandSize } from "./base.js";
import { distance3D } from "../utils/math.js";

export function detectPointingGesture(landmarks) {
  const l = getLandmarks(landmarks);

  // El indice debe estar extendido
  const indexTipToWrist = distance3D(l.indexTip, l.wrist);
  const indexBaseToWrist = distance3D(l.indexMCP, l.wrist);
  const indexExtended = indexTipToWrist > indexBaseToWrist * 1.3;

  // Los otros dedos deben estar doblados (deben estar mas cerca de la muñeca)
  const middleTipToWrist = distance3D(l.middleTip, l.wrist);
  const middleBaseToWrist = distance3D(l.middleMCP, l.wrist);
  const middleCurled = middleTipToWrist < middleBaseToWrist * 0.95;

  const ringTipToWrist = distance3D(l.ringTip, l.wrist);
  const ringBaseToWrist = distance3D(l.ringMCP, l.wrist);
  const ringCurled = ringTipToWrist < ringBaseToWrist * 0.95;

  const pinkyTipToWrist = distance3D(l.pinkyTip, l.wrist);
  const pinkyBaseToWrist = distance3D(l.pinkyMCP, l.wrist);
  const pinkyCurled = pinkyTipToWrist < pinkyBaseToWrist * 0.95;

  // 3. El pulgar debe estar separado del índice (no hacer pinza)
  const thumbTipToWrist = distance3D(l.thumbTip, l.wrist);
  const thumbBaseToWrist = distance3D(l.thumbMCP, l.wrist);
  const thumbExtended = thumbTipToWrist > thumbBaseToWrist * 0.9;

  //Verificar que el indice esta mas lejos que los otros dedos
  const indexDiff =
    indexTipToWrist -
    Math.max(middleTipToWrist, ringTipToWrist, pinkyTipToWrist);

  const handSize = getHandSize(landmarks);
  const normalizedThumbIndexDiff = indexDiff / handSize;
  const indexClearlyOut = normalizedThumbIndexDiff > 0.4;

  const allThreeCurled = middleCurled && ringCurled && pinkyCurled;
  return indexExtended && allThreeCurled && thumbExtended && indexClearlyOut;
}

export function getPointingDirection(landmarks) {
  const l = getLandmarks(landmarks);
  if (!l) return null;

  const dx = l.indexTip.x - l.indexMCP.x;
  const dy = l.indexTip.y - l.indexMCP.y;

  const angle = Math.atan2(dy, dx);

  return {
    angle,
    direction: {
      x: Math.cos(angle),
      y: Math.sin(angle),
    },
    tip: l.indexTip,
    base: l.indexMCP,
  };
}
