import { describe, expect, it } from 'vitest';
import { fingersNeeded, kindLabel, MAX_COUNT, Mode, modeName, nextCount, nextKind, parseMode } from './mode';

describe('mode', () => {
  it('cycles the player count from 1 up to the max and back', () => {
    let mode: Mode = { kind: 'players', count: 1 };
    const seen = [mode.count];
    for (let i = 0; i < MAX_COUNT; i++) {
      mode = nextCount(mode);
      seen.push(mode.count);
    }
    expect(seen).toEqual([...Array.from({ length: MAX_COUNT }, (_, i) => i + 1), 1]);
  });

  it('cycles the team count from 2, never 1', () => {
    expect(nextCount({ kind: 'teams', count: MAX_COUNT })).toEqual({ kind: 'teams', count: 2 });
  });

  it('turns through Choose, Split and Rank, raising the count to 2 for teams and keeping it otherwise', () => {
    expect(nextKind({ kind: 'players', count: 1 })).toEqual({ kind: 'teams', count: 2 });
    expect(nextKind({ kind: 'players', count: 4 })).toEqual({ kind: 'teams', count: 4 });
    expect(nextKind({ kind: 'teams', count: 3 })).toEqual({ kind: 'rank', count: 3 });
    expect(nextKind({ kind: 'rank', count: 3 })).toEqual({ kind: 'players', count: 3 });
    expect(['players', 'teams', 'rank'].map(k => modeName(k as Mode['kind']))).toEqual(['Choose', 'Split', 'Rank']);
  });

  it('needs one more finger than the count', () => {
    expect(fingersNeeded({ kind: 'players', count: 1 })).toBe(2);
    expect(fingersNeeded({ kind: 'teams', count: 3 })).toBe(4);
  });

  it('ranks once there are two fingers, whatever the count', () => {
    expect(fingersNeeded({ kind: 'rank', count: 1 })).toBe(2);
    expect(fingersNeeded({ kind: 'rank', count: 5 })).toBe(2);
  });

  it('labels singular and plural', () => {
    expect(kindLabel({ kind: 'players', count: 1 })).toBe('player');
    expect(kindLabel({ kind: 'players', count: 2 })).toBe('players');
    expect(kindLabel({ kind: 'teams', count: 2 })).toBe('teams');
    expect(kindLabel({ kind: 'rank', count: 1 })).toBe('all players');
  });

  it('parses stored modes and rejects invalid ones', () => {
    expect(parseMode({ kind: 'teams', count: 3 })).toEqual({ kind: 'teams', count: 3 });
    expect(parseMode({ kind: 'rank', count: 2 })).toEqual({ kind: 'rank', count: 2 });
    for (const bad of [null, 'x', {}, { kind: 'teams', count: 1 }, { kind: 'players', count: MAX_COUNT + 1 },
      { kind: 'players', count: 1.5 }, { kind: 'groups', count: 2 }]) {
      expect(parseMode(bad)).toEqual({ kind: 'players', count: 1 });
    }
  });
});
