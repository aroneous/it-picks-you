export function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  arcStart: number,
  arcEnd: number
): void {
  const cm = 37.7952755906;
  const nodeRadius = 0.75 * cm;
  const arcInnerRadius = 1 * cm;
  const arcOuterRadius = 1.25 * cm;

  // Draw the node (circle)
  ctx.beginPath();
  ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // Draw the concentric arc
  ctx.beginPath();
  ctx.arc(x, y, arcOuterRadius, arcStart, arcEnd, false);
  ctx.arc(x, y, arcInnerRadius, arcEnd, arcStart, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}