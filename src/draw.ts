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

/** Finger colors light enough that dark text reads better on them than white. */
const LIGHT_COLORS = new Set(['yellow', 'lime', 'cyan', 'orange', 'pink']);

/** How many times the label repeats around a chip's edge. */
export const CHIP_LABEL_REPEATS = 8;

/**
 * A ranked finger, drawn like a poker chip: a solid disc with an inner ring, and the label
 * repeated around the edge band, each copy rotated so its top faces outward.
 */
export function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  label: string
): void {
  const innerRadius = 0.66 * radius;
  const labelRadius = 0.83 * radius;

  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, 0, 2 * Math.PI);
  ctx.lineWidth = 0.04 * radius;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.stroke();

  ctx.fillStyle = LIGHT_COLORS.has(color) ? 'rgba(0, 0, 0, 0.8)' : '#fff';
  ctx.font = `700 ${0.26 * radius}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < CHIP_LABEL_REPEATS; i++) {
    ctx.save();
    ctx.rotate((i * 2 * Math.PI) / CHIP_LABEL_REPEATS);
    ctx.fillText(label, 0, -labelRadius);
    ctx.restore();
  }

  ctx.restore();
}
