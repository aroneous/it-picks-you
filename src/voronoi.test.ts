import { describe, expect, it } from 'vitest';
import { clipHalfPlane, Point, roundedPolygonPath, voronoiCells } from './voronoi';

const RECT = { x: 0, y: 0, width: 100, height: 100 };

function area(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function contains(poly: Point[], p: Point): boolean {
  // Convex polygon: p is on the same side of every edge.
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross !== 0) {
      if (sign !== 0 && Math.sign(cross) !== sign) return false;
      sign = Math.sign(cross);
    }
  }
  return true;
}

describe('clipHalfPlane', () => {
  it('cuts a square in half', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(area(clipHalfPlane(square, 1, 0, 5))).toBeCloseTo(50);
    expect(clipHalfPlane(square, 1, 0, 20)).toEqual([]);
  });
});

describe('voronoiCells', () => {
  it('gives a single site the whole rect', () => {
    const [cell] = voronoiCells([{ x: 30, y: 30 }], RECT, 2);
    expect(area(cell)).toBeCloseTo(100 * 100);
  });

  it('splits between two sites along their bisector', () => {
    const [a, b] = voronoiCells([{ x: 25, y: 50 }, { x: 75, y: 50 }], RECT);
    expect(area(a)).toBeCloseTo(5000);
    expect(area(b)).toBeCloseTo(5000);
    expect(Math.max(...a.map(p => p.x))).toBeCloseTo(50);
  });

  it('leaves a gap of twice the inset between neighbours', () => {
    const [a, b] = voronoiCells([{ x: 25, y: 50 }, { x: 75, y: 50 }], RECT, 2);
    expect(Math.max(...a.map(p => p.x))).toBeCloseTo(48);
    expect(Math.min(...b.map(p => p.x))).toBeCloseTo(52);
  });

  it('puts every site inside its own cell and the cells tile the rect', () => {
    const sites = [{ x: 10, y: 10 }, { x: 80, y: 20 }, { x: 50, y: 50 }, { x: 20, y: 90 }, { x: 90, y: 90 }];
    const cells = voronoiCells(sites, RECT);
    cells.forEach((cell, i) => expect(contains(cell, sites[i])).toBe(true));
    expect(cells.reduce((sum, c) => sum + area(c), 0)).toBeCloseTo(100 * 100);
  });

  it('still separates sites closer together than the gap', () => {
    const [a, b] = voronoiCells([{ x: 50, y: 50 }, { x: 51, y: 50 }], RECT, 2);
    expect(Math.max(...a.map(p => p.x))).toBeCloseTo(48.5);
    expect(Math.min(...b.map(p => p.x))).toBeCloseTo(52.5);
  });

  it('does not split the rect between sites at the same position', () => {
    const cells = voronoiCells([{ x: 50, y: 50 }, { x: 50, y: 50 }], RECT, 2);
    expect(cells.map(area)).toEqual([10000, 10000]);
  });
});

describe('roundedPolygonPath', () => {
  it('rounds each corner, clamped to half the shortest adjacent edge', () => {
    const calls: number[] = [];
    const sink = { moveTo() {}, closePath() {}, arcTo: (_a: number, _b: number, _c: number, _d: number, r: number) => calls.push(r) };
    roundedPolygonPath(sink, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 0, y: 10 }], 14);
    expect(calls).toEqual([5, 5, 5, 5]);
  });
});
