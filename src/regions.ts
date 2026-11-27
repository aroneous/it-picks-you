import type { Node } from "./state";
import { roundedPolygonPath, voronoiCells } from "./voronoi";

/** How long each winner's colour takes to expand out to fill its region. */
export const HALO_EXPAND_TIME = 500; // ms
/** Width of the gap left between neighbouring regions. */
export const BOUNDARY_WIDTH = 4; // px
/** Corner rounding of each region. */
export const CORNER_RADIUS = 14; // px
/** Clear space around each winner's ring, as a multiple of the ring radius. */
const HOLE_RADIUS = 1.2;
/**
 * The regions are computed over a rect this much bigger than the screen, so their
 * outer edges and rounded corners fall off-screen and only the inner boundaries show.
 */
const OFFSCREEN_MARGIN = 40; // px

/**
 * Fills the screen with one region per winner: the area closer to that winner than to
 * any other (a Voronoi diagram), in the winner's colour. Neighbouring regions are
 * separated by a thin gap and have slightly rounded corners. Each region's colour
 * expands outwards from its winner when the pick is made.
 */
export function drawRegions(
  ctx: CanvasRenderingContext2D,
  winners: readonly Node[],
  width: number,
  height: number,
  radius: number,
  now: number
): void {
  const cells = voronoiCells(
    winners,
    {
      x: -OFFSCREEN_MARGIN,
      y: -OFFSCREEN_MARGIN,
      width: width + 2 * OFFSCREEN_MARGIN,
      height: height + 2 * OFFSCREEN_MARGIN,
    },
    BOUNDARY_WIDTH / 2
  );
  const hole = radius * HOLE_RADIUS;
  const maxRadius = Math.hypot(width, height) + OFFSCREEN_MARGIN;

  winners.forEach((node, i) => {
    const cell = cells[i];
    if (cell.length === 0) return;
    // Before a winner's reveal time this is 0: its region stays empty until its turn.
    const progress = Math.min(Math.max((now - (node.selectedTime ?? now)) / HALO_EXPAND_TIME, 0), 1);
    const haloRadius = hole + (maxRadius - hole) * progress;

    const clip = new Path2D();
    roundedPolygonPath(clip, cell, CORNER_RADIUS);
    ctx.save();
    ctx.clip(clip);
    ctx.beginPath();
    ctx.arc(node.x, node.y, haloRadius, 0, 2 * Math.PI, false);
    ctx.arc(node.x, node.y, hole, 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.restore();
  });
}
