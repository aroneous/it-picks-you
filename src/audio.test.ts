import { describe, expect, it } from 'vitest';
import { frequencyForNodeIndex } from './audio';

describe('frequencyForNodeIndex', () => {
  it('is A440 at zero semitones', () => {
    expect(frequencyForNodeIndex(0)).toBe(440);
  });

  it('doubles per octave', () => {
    expect(frequencyForNodeIndex(12)).toBeCloseTo(880);
    expect(frequencyForNodeIndex(-12)).toBeCloseTo(220);
  });
});
