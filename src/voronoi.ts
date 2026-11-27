export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Clips a convex polygon to the half-plane where `nx * x + ny * y >= c`
 * (one step of Sutherland–Hodgman).
 */
export function clipHalfPlane(poly: Point[], nx: number, ny: number, c: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a.x + ny * a.y - c;
    const db = nx * b.x + ny * b.y - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * The Voronoi cell of each site within `rect`, as a convex polygon: the points closer to
 * that site than to any other. Each cell is shrunk by `inset` from every boundary it
 * shares with another cell (not from the rect's edges), leaving a gap of `2 * inset`
 * between neighbours. Sites at exactly the same position don't split the rect between
 * them, so each gets the cell it would have alone.
 */
export function voronoiCells(sites: readonly Point[], rect: Rect, inset = 0): Point[][] {
  const box: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return sites.map((p, i) => {
    let cell = box;
    for (let j = 0; j < sites.length && cell.length > 0; j++) {
      if (j === i) continue;
      const q = sites[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue; // coincident sites: leave them overlapping
      const nx = dx / len;
      const ny = dy / len;
      // Keep the side of the perpendicular bisector facing p, moved `inset` towards p.
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      cell = clipHalfPlane(cell, nx, ny, nx * mx + ny * my + inset);
    }
    return cell.length >= 3 ? cell : [];
  });
}

type PathSink = Pick<CanvasPath, 'moveTo' | 'arcTo' | 'closePath'>;

/** Adds a polygon to a path with its corners rounded to (at most) `radius`. */
export function roundedPolygonPath(path: PathSink, poly: readonly Point[], radius: number): void {
  const n = poly.length;
  if (n < 3) return;
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(poly[n - 1], poly[0]);
  path.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const corner = poly[i];
    const next = poly[(i + 1) % n];
    // Never round more than half of either adjacent edge, or arcs would overlap.
    const r = Math.min(
      radius,
      Math.hypot(corner.x - prev.x, corner.y - prev.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2
    );
    path.arcTo(corner.x, corner.y, next.x, next.y, r);
  }
  path.closePath();
}
