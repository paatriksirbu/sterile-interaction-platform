import { getLandmarks, getHandSize } from "./base.js";
import { distance2D, distance3D } from "../utils/math.js";

export function detectOpenHand(landmarks) {
  const l = getLandmarks(landmarks);
  if (!l) return { isOpen: false };

  const handSize = getHandSize(landmarks);

  // Todos los dedos deben estar extendidos (TIP más lejos de la muñeca que MCP)
  const indexExtended =
    distance2D(l.indexTip, l.wrist) > distance2D(l.indexMCP, l.wrist) * 1.1;
  const middleExtended =
    distance2D(l.middleTip, l.wrist) > distance2D(l.middleMCP, l.wrist) * 1.1;
  const ringExtended =
    distance2D(l.ringTip, l.wrist) > distance2D(l.ringMCP, l.wrist) * 1.1;
  const pinkyExtended =
    distance2D(l.pinkyTip, l.wrist) > distance2D(l.pinkyMCP, l.wrist) * 1.1;

  // El pulgar debe estar extendido (alejado de la palma)
  const thumbToIndex = distance3D(l.thumbTip, l.indexMCP);
  const thumbExtended = thumbToIndex > handSize * 0.4;

  // Los dedos deben estar relativamente separados (no juntos como en puño)
  const indexToMiddle = distance3D(l.indexTip, l.middleTip);
  const middleToRing = distance3D(l.middleTip, l.ringTip);
  const ringToPinky = distance3D(l.ringTip, l.pinkyTip);
  const avgSeparation = (indexToMiddle + middleToRing + ringToPinky) / 3;
  const fingersSpread = avgSeparation / handSize > 0.12; // Reducido para ser menos estricto

  // Verificar que los dedos están rectos (DIP entre PIP y TIP)
  const indexStraight = isFingerStraight(l.indexMCP, l.indexDIP, l.indexTip);
  const middleStraight = isFingerStraight(
    l.middleMCP,
    l.middleDIP,
    l.middleTip,
  );
  const ringStraight = isFingerStraight(l.ringMCP, l.ringDIP, l.ringTip);
  const pinkyStraight = isFingerStraight(l.pinkyMCP, l.pinkyDIP, l.pinkyTip);

  const allFingersStraight =
    indexStraight && middleStraight && ringStraight && pinkyStraight;
  const allFingersExtended =
    indexExtended && middleExtended && ringExtended && pinkyExtended;

  const isOpen =
    allFingersExtended && thumbExtended && fingersSpread && allFingersStraight;

  // Calcular centro de la palma para tracking de scroll
  const palmCenter = {
    x:
      (l.wrist.x + l.middleMCP.x + l.indexMCP.x + l.ringMCP.x + l.pinkyMCP.x) /
      5,
    y:
      (l.wrist.y + l.middleMCP.y + l.indexMCP.y + l.ringMCP.y + l.pinkyMCP.y) /
      5,
    z:
      (l.wrist.z + l.middleMCP.z + l.indexMCP.z + l.ringMCP.z + l.pinkyMCP.z) /
      5,
  };

  return {
    isOpen,
    palmCenter,
    handSize,
  };
}

function isFingerStraight(mcp, dip, tip) {
  const directDistance = distance2D(mcp, tip);
  const throughDIP = distance2D(mcp, dip) + distance2D(dip, tip);

  return directDistance / throughDIP > 0.55;
}
