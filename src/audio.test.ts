import { describe, expect, it } from 'vitest';
import { frequencyForNodeIndex, frequencyForTone } from './audio';
import { MAX_TONES } from './round';

describe('frequencyForNodeIndex', () => {
  it('is A440 at zero semitones', () => {
    expect(frequencyForNodeIndex(0)).toBe(440);
  });

  it('doubles per octave', () => {
    expect(frequencyForNodeIndex(12)).toBeCloseTo(880);
    expect(frequencyForNodeIndex(-12)).toBeCloseTo(220);
  });
});

describe('frequencyForTone', () => {
  it('rises with every tone index a finger can be given', () => {
    // round.ts reveals winners in tone-index order, relying on this.
    for (let i = 1; i < MAX_TONES; i++) {
      expect(frequencyForTone(i)).toBeGreaterThan(frequencyForTone(i - 1));
    }
  });
});
