import { distance3D } from "../utils/math.js";

export function getLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;
  return {
    wrist: landmarks[0],
    thumbCMC: landmarks[1],
    thumbMCP: landmarks[2],
    thumbPIP: landmarks[3],
    thumbTip: landmarks[4],
    indexMCP: landmarks[5],
    indexPIP: landmarks[6],
    indexDIP: landmarks[7],
    indexTip: landmarks[8],
    middleMCP: landmarks[9],
    middlePIP: landmarks[10],
    middleDIP: landmarks[11],
    middleTip: landmarks[12],
    ringMCP: landmarks[13],
    ringPIP: landmarks[14],
    ringDIP: landmarks[15],
    ringTip: landmarks[16],
    pinkyMCP: landmarks[17],
    pinkyPIP: landmarks[18],
    pinkyDIP: landmarks[19],
    pinkyTip: landmarks[20],
  };
}

// Calcular tamaño de mano
export function getHandSize(landmarks) {
  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const pinkyBase = landmarks[17];
  const handWidth = distance3D(indexBase, pinkyBase);
  const handLength = distance3D(wrist, landmarks[9]); // hasta base del medio

  return (handWidth + handLength) / 2;
}

// Calcula la profundidad de la mano en el eje Z
export function getHandDepth(landmarks) {
  if (!landmarks || landmarks.length < 21) return 0;

  // Usar puntos clave de la palma para estimar profundidad
  // (wrist, palm base points son más estables que fingertips)
  const palmPoints = [0, 5, 9, 13, 17]; // wrist + base de cada dedo
  let totalZ = 0;
  let validPoints = 0;

  for (const idx of palmPoints) {
    if (landmarks[idx] && typeof landmarks[idx].z === "number") {
      totalZ += landmarks[idx].z;
      validPoints++;
    }
  }

  return validPoints > 0 ? totalZ / validPoints : 0;
}

// Calcula un score de proximidad, mayor = más cerca, basado en tamaño y profundidad de la mano
export function getHandProximityScore(
  landmarks,
  weights = { SIZE: 0.5, DEPTH: 0.35, CONFIDENCE: 0.15 },
  confidence = 1,
) {
  if (!landmarks || landmarks.length < 21) {
    return {
      score: 0,
      size: 0,
      depth: 0,
      normalizedSize: 0,
      normalizedDepth: 0,
    };
  }

  const size = getHandSize(landmarks);
  const depth = getHandDepth(landmarks);

  // Normalizar tamaño: rango típico 0.05-0.25, mapeamos a 0-1
  // Una mano que ocupa más espacio está más cerca
  const normalizedSize = Math.min(1, Math.max(0, (size - 0.03) / 0.22));

  // Normalizar profundidad: Z típico va de -0.3 (muy cerca) a 0.1 (lejos)
  // Invertimos para que mayor = más cerca
  const normalizedDepth = Math.min(1, Math.max(0, (0.15 - depth) / 0.45));

  // Calcular score ponderado
  const score =
    normalizedSize * weights.SIZE +
    normalizedDepth * weights.DEPTH +
    confidence * weights.CONFIDENCE;

  return {
    score,
    size,
    depth,
    normalizedSize,
    normalizedDepth,
    confidence,
  };
}
