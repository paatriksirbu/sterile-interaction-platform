// Estado del suavizado por objeto
const smoothingStates = new Map();

/**
 * Aplica suavizado exponencial + predicción de velocidad
 */
export function smoothAndPredict(id, target, alpha = 0.5, predict = 0.06) {
  if (!smoothingStates.has(id)) {
    smoothingStates.set(id, {
      smoothed: { x: target.x, y: target.y },
      prevSmoothed: { x: target.x, y: target.y },
    });
    return { x: target.x, y: target.y };
  }

  const state = smoothingStates.get(id);
  const prev = state.smoothed;

  // Suavizado exponencial
  const newX = prev.x + alpha * (target.x - prev.x);
  const newY = prev.y + alpha * (target.y - prev.y);

  // Calcular velocidad
  const vx = newX - state.prevSmoothed.x;
  const vy = newY - state.prevSmoothed.y;

  // Predicción basada en velocidad
  const px = newX + predict * vx;
  const py = newY + predict * vy;

  // Actualizar estado
  state.prevSmoothed = { x: newX, y: newY };
  state.smoothed = { x: px, y: py };

  return { x: px, y: py };
}

export function resetSmoothing(id) {
  smoothingStates.delete(id);
}

export function resetAllSmoothing() {
  smoothingStates.clear();
}
