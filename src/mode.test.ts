import { describe, expect, it } from 'vitest';
import {
  countOptions, DEFAULT_SETTINGS, fingersNeeded, kindLabel, knobSteps, MAX_COUNT, ModeSettings, modeName, modeOf,
  nextCount, nextKind, otherKinds, parseSettings, withCount, withKind,
} from './mode';

const settings = (kind: ModeSettings['kind'], players = 1, teams = 2): ModeSettings => ({ kind, counts: { players, teams } });

describe('mode', () => {
  it('cycles the player count from 1 up to the max and back', () => {
    let s = settings('players');
    const seen = [s.counts.players];
    for (let i = 0; i < MAX_COUNT; i++) {
      s = nextCount(s);
      seen.push(s.counts.players);
    }
    expect(seen).toEqual([...Array.from({ length: MAX_COUNT }, (_, i) => i + 1), 1]);
  });

  it('cycles the team count from 2, never 1', () => {
    expect(nextCount(settings('teams', 1, MAX_COUNT)).counts.teams).toBe(2);
  });

  it('changes only the current mode’s number', () => {
    expect(nextCount(settings('players', 3, 4))).toEqual(settings('players', 4, 4));
    expect(nextCount(settings('teams', 3, 4))).toEqual(settings('teams', 3, 5));
    expect(nextCount(settings('rank', 3, 4))).toEqual(settings('rank', 3, 4));
  });

  it('turns through Choose, Split and Rank, each keeping its own number', () => {
    let s = settings('players', 1, 4);
    expect(modeOf(s)).toEqual({ kind: 'players', count: 1 });
    s = nextKind(s);
    expect(modeOf(s)).toEqual({ kind: 'teams', count: 4 });
    s = nextKind(s);
    expect(modeOf(s)).toEqual({ kind: 'rank', count: 1 });
    s = nextKind(s);
    expect(modeOf(s)).toEqual({ kind: 'players', count: 1 });
    expect(['players', 'teams', 'rank'].map(k => modeName(k as ModeSettings['kind']))).toEqual(['Choose', 'Split', 'Rank']);
  });

  it('needs one more finger than the count', () => {
    expect(fingersNeeded({ kind: 'players', count: 1 })).toBe(2);
    expect(fingersNeeded({ kind: 'teams', count: 3 })).toBe(4);
  });

  it('ranks once there are two fingers', () => {
    expect(fingersNeeded({ kind: 'rank', count: 1 })).toBe(2);
  });

  it('labels singular and plural', () => {
    expect(kindLabel({ kind: 'players', count: 1 })).toBe('player');
    expect(kindLabel({ kind: 'players', count: 2 })).toBe('players');
    expect(kindLabel({ kind: 'teams', count: 2 })).toBe('teams');
    expect(kindLabel({ kind: 'rank', count: 1 })).toBe('all players');
  });

  it('parses stored settings, keeping valid numbers and defaulting invalid ones', () => {
    expect(parseSettings(settings('teams', 4, 3))).toEqual(settings('teams', 4, 3));
    expect(parseSettings({ kind: 'rank', counts: { players: 9, teams: 1 } })).toEqual(settings('rank'));
    expect(parseSettings({ kind: 'players', counts: { players: 2.5, teams: 5 } })).toEqual(settings('players', 1, 5));
    for (const bad of [null, 'x', {}, { kind: 'groups', counts: { players: 2, teams: 2 } }]) {
      expect(parseSettings(bad)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('reads the older single-number format as the current mode’s number', () => {
    expect(parseSettings({ kind: 'players', count: 3 })).toEqual(settings('players', 3));
    expect(parseSettings({ kind: 'teams', count: 3 })).toEqual(settings('teams', 1, 3));
    expect(parseSettings({ kind: 'teams', count: 1 })).toEqual(settings('teams'));
    expect(parseSettings({ kind: 'players', count: MAX_COUNT + 1 })).toEqual(settings('players'));
  });

  describe('long-press pickers', () => {
    it('jumps to a mode, keeping each mode’s number', () => {
      expect(withKind(settings('players', 3, 4), 'rank')).toEqual(settings('rank', 3, 4));
      expect(withKind(settings('rank', 3, 4), 'teams')).toEqual(settings('teams', 3, 4));
    });

    it('sets only the current mode’s number, within its range', () => {
      expect(withCount(settings('players', 1, 4), 5)).toEqual(settings('players', 5, 4));
      expect(withCount(settings('teams', 1, 4), 3)).toEqual(settings('teams', 1, 3));
      expect(withCount(settings('teams', 1, 4), 1)).toEqual(settings('teams', 1, 2));
      expect(withCount(settings('players', 1, 4), MAX_COUNT + 3)).toEqual(settings('players', MAX_COUNT, 4));
      expect(withCount(settings('rank', 1, 4), 3)).toEqual(settings('rank', 1, 4));
    });

    it('lists every number a mode can have', () => {
      expect(countOptions('players')).toEqual(Array.from({ length: MAX_COUNT }, (_, i) => i + 1));
      expect(countOptions('teams')).toEqual(Array.from({ length: MAX_COUNT - 1 }, (_, i) => i + 2));
      expect(countOptions('rank')).toEqual([]);
    });

    it('lists the other modes in reverse knob order, the next one last', () => {
      expect(otherKinds('players')).toEqual(['rank', 'teams']);
      expect(otherKinds('teams')).toEqual(['players', 'rank']);
      expect(otherKinds('rank')).toEqual(['teams', 'players']);
    });

    it('counts knob steps forward between modes', () => {
      expect(knobSteps('players', 'teams')).toBe(1);
      expect(knobSteps('players', 'rank')).toBe(2);
      expect(knobSteps('rank', 'players')).toBe(1);
      expect(knobSteps('teams', 'teams')).toBe(0);
    });
  });
});
