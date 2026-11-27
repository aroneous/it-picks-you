/**
 * What a round does. The kinds are shown to the user as modes:
 * - `players` ("Choose"): pick `count` players.
 * - `teams` ("Split"): split everyone into `count` teams.
 * - `rank` ("Rank"): put everyone in a random order. `count` isn't used, but is kept so it
 *   carries over when the knob turns past Rank and back round to Choose.
 */
export type ModeKind = 'players' | 'teams' | 'rank';

export interface Mode {
  kind: ModeKind;
  count: number;
}

/** The order the knob turns through. */
export const MODE_KINDS: readonly ModeKind[] = ['players', 'teams', 'rank'];

export const MAX_COUNT = 5;
export const DEFAULT_MODE: Mode = { kind: 'players', count: 1 };

export function minCount(kind: ModeKind): number {
  return kind === 'teams' ? 2 : 1;
}

/** Whether the mode has a number to choose. */
export function hasCount(kind: ModeKind): boolean {
  return kind !== 'rank';
}

/** The selector's number: counts up and wraps back to the minimum. */
export function nextCount(mode: Mode): Mode {
  const count = mode.count >= MAX_COUNT ? minCount(mode.kind) : mode.count + 1;
  return { ...mode, count };
}

/** The knob: Choose → Split → Rank → Choose, keeping the count where it's still valid. */
export function nextKind(mode: Mode): Mode {
  const kind = MODE_KINDS[(MODE_KINDS.indexOf(mode.kind) + 1) % MODE_KINDS.length];
  return { kind, count: Math.max(mode.count, minCount(kind)) };
}

/** A pick happens once there are more fingers than the chosen number; ranking needs two. */
export function fingersNeeded(mode: Mode): number {
  return mode.kind === 'rank' ? 2 : mode.count + 1;
}

/** The mode's name, shown at the start of the capsule. */
export function modeName(kind: ModeKind): string {
  return { players: 'Choose', teams: 'Split', rank: 'Rank' }[kind];
}

/** The words after the number (or after the name, for Rank). */
export function kindLabel(mode: Mode): string {
  if (mode.kind === 'rank') return 'all players';
  return mode.kind === 'players' && mode.count === 1 ? 'player' : mode.kind;
}

/** Validates a mode read from storage, falling back to the default. */
export function parseMode(value: unknown): Mode {
  if (typeof value === 'object' && value !== null) {
    const { kind, count } = value as Partial<Mode>;
    if (
      kind !== undefined &&
      MODE_KINDS.includes(kind) &&
      Number.isInteger(count) &&
      count! >= minCount(kind) &&
      count! <= MAX_COUNT
    ) {
      return { kind, count: count! };
    }
  }
  return { ...DEFAULT_MODE };
}
