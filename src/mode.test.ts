import { describe, expect, it } from 'vitest';
import { fingersNeeded, kindLabel, MAX_COUNT, Mode, nextCount, parseMode, toggleKind } from './mode';

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

  it('raises the count to 2 when switching to teams, and keeps it when switching back', () => {
    expect(toggleKind({ kind: 'players', count: 1 })).toEqual({ kind: 'teams', count: 2 });
    expect(toggleKind({ kind: 'players', count: 4 })).toEqual({ kind: 'teams', count: 4 });
    expect(toggleKind({ kind: 'teams', count: 2 })).toEqual({ kind: 'players', count: 2 });
  });

  it('needs one more finger than the count', () => {
    expect(fingersNeeded({ kind: 'players', count: 1 })).toBe(2);
    expect(fingersNeeded({ kind: 'teams', count: 3 })).toBe(4);
  });

  it('labels singular and plural', () => {
    expect(kindLabel({ kind: 'players', count: 1 })).toBe('player');
    expect(kindLabel({ kind: 'players', count: 2 })).toBe('players');
    expect(kindLabel({ kind: 'teams', count: 2 })).toBe('teams');
  });

  it('parses stored modes and rejects invalid ones', () => {
    expect(parseMode({ kind: 'teams', count: 3 })).toEqual({ kind: 'teams', count: 3 });
    for (const bad of [null, 'x', {}, { kind: 'teams', count: 1 }, { kind: 'players', count: MAX_COUNT + 1 },
      { kind: 'players', count: 1.5 }, { kind: 'groups', count: 2 }]) {
      expect(parseMode(bad)).toEqual({ kind: 'players', count: 1 });
    }
  });
});
