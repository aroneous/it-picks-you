import { describe, expect, it } from 'vitest';
import { Node } from './state';

const TAU = 2 * Math.PI;

describe('Node', () => {
  const node = new Node('1', 'red', 0, 0, 3, 1000);

  it('stores its tone and placement time', () => {
    expect(node.toneIndex).toBe(3);
    expect(node.placedTime).toBe(1000);
    expect(node.selectedTime).toBeUndefined();
  });

  it('starts with a quarter-circle arc', () => {
    expect(node.getArcStart(0)).toBe(0);
    expect(node.getArcEnd(0)).toBeCloseTo(0.25 * TAU);
  });

  it('fills the arc to a full circle after the fill-in time', () => {
    const elapsed = 1000;
    expect(node.getArcEnd(elapsed) - node.getArcStart(elapsed)).toBeCloseTo(TAU);
    expect(node.getArcEnd(5000) - node.getArcStart(5000)).toBeCloseTo(TAU);
  });

  it('rotates the arc start once per rotation period', () => {
    expect(node.getArcStart(750)).toBeCloseTo(Math.PI);
    expect(node.getArcStart(1500)).toBeCloseTo(0);
  });
});
