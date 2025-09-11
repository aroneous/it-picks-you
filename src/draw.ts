export function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  arcStart: number,
  arcEnd: number
): void {
  const nodeRadius = 0.6 * radius;
  const arcInnerRadius = 0.8 * radius;
  const arcOuterRadius = radius;

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

export function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r1: number,
  r2: number,
  color: string) {
    ctx.beginPath();
    ctx.arc(x, y, r2, 0, 2 * Math.PI, false);
    ctx.arc(x, y, r1, 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }