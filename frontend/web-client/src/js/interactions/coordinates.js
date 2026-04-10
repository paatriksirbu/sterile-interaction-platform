import { CONFIG } from "../config.js";
import { getThumbIndexPinchPositions } from "../gestures/pinch.js";

// Devuelve la primera posicion del pinch
export function getFirstPinchPos(hands) {
  for (let i = 0; i < (hands?.length || 0); i++) {
    const pos = getThumbIndexPinchPositions(hands[i]);
    if (pos) return pos;
  }
  return null;
}

export function pinchToClientInContainer(
  posNorm,
  container,
  mirror = CONFIG.MIRROR,
) {
  const rect = container.getBoundingClientRect();
  const xPx = posNorm.x * rect.width;
  const yPx = posNorm.y * rect.height;

  const clientX = rect.left + (mirror ? rect.width - xPx : xPx);
  const clientY = rect.top + yPx;

  return { clientX, clientY };
}
