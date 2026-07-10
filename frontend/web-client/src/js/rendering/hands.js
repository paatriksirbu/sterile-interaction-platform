import { CONFIG } from "../config.js";
import { drawPoint, drawLine } from "../utils/canvas.js";
import { landmarkToPx } from "../utils/transforms.js";

/**
 * Conexiones de los dedos para dibujar el esqueleto (SOLO MANOS, 21 landmarks)
 */
const HAND_CONNECTIONS = [
  // Pulgar
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Índice
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Medio
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Anular
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Meñique
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palma
  [5, 9],
  [9, 13],
  [13, 17],
];

// Dibuja el esqueleto de la mano con líneas entre los landmarks
export function drawHandSkeleton(ctx, landmarks, canvas, handType = "Unknown") {
  // Validar que sean exactamente 21 landmarks de mano
  if (landmarks?.length !== 21) return;

  const color = CONFIG.COLORS[handType] || CONFIG.COLORS.Unknown;

  // Convertir landmarks a píxeles
  const landmarksPx = landmarks.map((lm) =>
    landmarkToPx(lm, canvas, CONFIG.MIRROR),
  );

  // Dibujar conexiones (líneas del esqueleto)
  HAND_CONNECTIONS.forEach(([start, end]) => {
    const p1 = landmarksPx[start];
    const p2 = landmarksPx[end];
    drawLine(ctx, p1.x, p1.y, p2.x, p2.y, color, 2);
  });
}

/**
 * Dibuja todas las manos detectadas (solo líneas)
 */
export function drawAllHands(ctx, multiHandLandmarks, multiHandedness, canvas) {
  if (!multiHandLandmarks) return;

  multiHandLandmarks.forEach((landmarks, index) => {
    // Solo dibujar si son exactamente 21 landmarks (mano)
    if (landmarks?.length === 21) {
      const handType = multiHandedness?.[index]?.label || "Unknown";
      drawHandSkeleton(ctx, landmarks, canvas, handType);
    }
  });
}

// Dibuja un landmark específico resaltado
export function drawHighlightedLandmark(
  ctx,
  landmark,
  canvas,
  color = "yellow",
  radius = 8,
) {
  if (!landmark) return;

  // Coloca el punto respetando el mirror
  const pos = landmarkToPx(landmark, canvas, CONFIG.MIRROR);

  drawPoint(ctx, pos.x, pos.y, radius + 4, `${color}33`);
  drawPoint(ctx, pos.x, pos.y, radius, color);
}
