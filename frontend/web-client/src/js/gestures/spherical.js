import { getLandmarks, getHandSize } from "./base.js";
import { distance3D, distance2D } from "../utils/math.js";

export function detectSphericalGrip(landmarks) {
  const l = getLandmarks(landmarks);
  const handSize = getHandSize(landmarks);

  function isTipFlexed(tip, pip, mcp, wrist) {
    const mcpToWrist = distance2D(mcp, wrist);
    const pipToWrist = distance2D(pip, wrist);
    const tipToWrist = distance2D(tip, wrist);
    // Palma abierta: mcpToWrist y pipToWrist grandes
    // Solo la yema doblada: tipToWrist < pipToWrist*0.85 pero tipToWrist > mcpToWrist*0.35
    return (
      mcpToWrist > handSize * 0.35 &&
      pipToWrist > handSize * 0.32 &&
      tipToWrist < pipToWrist * 0.85 &&
      tipToWrist > mcpToWrist * 0.35
    );
  }

  const index = isTipFlexed(l.indexTip, l.indexPIP, l.indexMCP, l.wrist);
  const middle = isTipFlexed(l.middleTip, l.middlePIP, l.middleMCP, l.wrist);
  const ring = isTipFlexed(l.ringTip, l.ringPIP, l.ringMCP, l.wrist);
  const pinky = isTipFlexed(l.pinkyTip, l.pinkyPIP, l.pinkyMCP, l.wrist);

  // El pulgar debe estar alejado y extendido
  const thumbTipToWrist = distance3D(l.thumbTip, l.wrist);
  const thumbBaseToWrist = distance3D(l.thumbMCP, l.wrist);
  const thumbExtended = thumbTipToWrist > thumbBaseToWrist * 1.2;

  // El pulgar debe estar lejos de la palma para no confundirlo con closedFist
  const thumToPalm = distance3D(l.thumbTip, l.middleMCP);
  const thumbAway = thumToPalm > handSize * 0.4;

  const indexToMiddle = distance3D(l.indexTip, l.middleTip);
  const middleToRing = distance3D(l.middleTip, l.ringTip);
  const ringToPinky = distance3D(l.ringTip, l.pinkyTip);
  const avgSeparation = (indexToMiddle + middleToRing + ringToPinky) / 3;
  const normalizedSeparation = avgSeparation / handSize;
  const fingersSeparated = normalizedSeparation > 0.12;

  const flexedCount = [index, middle, ring, pinky].filter(Boolean).length;
  // Al menos 3 dedos deben estar flexionados, y deben estar separados, pulgar extendido y alejado
  return flexedCount >= 3 && fingersSeparated && thumbExtended && thumbAway;
}
