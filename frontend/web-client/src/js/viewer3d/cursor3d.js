// src/js/viewer3d/Cursor3d.js

const Cursor = (() => {
  let hasTarget = false;
  let targetNorm = { x: 0, y: 0 };
  let active = false;

  // ownership + capture
  let ownerId = null;
  let captured = false;

  // smoothing
  let sm = null;
  let prevSm = null;
  let lastSeenTs = 0;

  const TUNING = {
    alpha: 0.55,
    predict: 0.08,
    hideAfterMs: 220,
  };

  function reset() {
    hasTarget = false;
    sm = null;
    prevSm = null;
    active = false;
    lastSeenTs = 0;
    ownerId = null;
    captured = false;
  }

  function capture(handId) {
    ownerId = handId;
    captured = true;
  }

  function release(handId) {
    if (!ownerId) return;
    if (handId !== ownerId) return;
    ownerId = null;
    captured = false;
  }

  function update(handId, xNorm, yNorm, isActive) {
    const now = performance.now();

    if (!ownerId && !captured) {
      ownerId = handId;
    }
    if (handId !== ownerId) return;

    hasTarget = true;
    targetNorm.x = xNorm;
    targetNorm.y = yNorm;
    active = !!isActive;
    lastSeenTs = now;
  }

  function smooth(px) {
    if (!sm) {
      sm = { x: px.x, y: px.y };
      prevSm = { x: px.x, y: px.y };
      return sm;
    }

    const a = TUNING.alpha;
    const p = TUNING.predict;

    const nx = sm.x + a * (px.x - sm.x);
    const ny = sm.y + a * (px.y - sm.y);

    const vx = nx - prevSm.x;
    const vy = ny - prevSm.y;

    prevSm.x = nx;
    prevSm.y = ny;

    sm.x = nx + p * vx;
    sm.y = ny + p * vy;

    return sm;
  }

  function draw(ctx, canvas, { mirror = false } = {}) {
    if (!ctx || !canvas) return;

    const now = performance.now();
    if (!hasTarget || now - lastSeenTs > TUNING.hideAfterMs) {
      ownerId = null;
      captured = false;
      return;
    }

    const xRaw = targetNorm.x * canvas.width;
    const yPx = targetNorm.y * canvas.height;
    const xPx = mirror ? canvas.width - xRaw : xRaw;

    const pos = smooth({ x: xPx, y: yPx });

    const base = "#2EA8FF";
    const glow = "rgba(46,168,255,0.35)";
    const white = "rgba(255,255,255,0.72)";

    const pulse = active ? 1 + 0.08 * Math.sin(now * 0.02) : 1;
    const ringR = 18 * pulse;
    const dotR = active ? 4 : 3;

    ctx.save();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ringR + 12, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = base;
    ctx.shadowColor = base;
    ctx.shadowBlur = active ? 22 : 14;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = white;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pos.x - 10, pos.y);
    ctx.lineTo(pos.x + 10, pos.y);
    ctx.moveTo(pos.x, pos.y - 10);
    ctx.lineTo(pos.x, pos.y + 10);
    ctx.stroke();

    ctx.fillStyle = active ? base : white;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  return { update, draw, reset, capture, release };
})();

export const handCursor = Cursor;

export function clearOverlay(ctx, canvas) {
  if (!ctx || !canvas) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
