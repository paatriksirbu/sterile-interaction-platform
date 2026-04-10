/**
 * Dibuja un arco de progreso circular
 */
export function drawProgressArc(
  ctx,
  x,
  y,
  radius,
  progress,
  color = "#00FF00",
) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0) return;

  const startAngle = -Math.PI / 2; // Empieza arriba
  const endAngle = startAngle + clamped * Math.PI * 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}
