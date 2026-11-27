/** What a round picks: some number of players, or a split into some number of teams. */
export type ModeKind = 'players' | 'teams';

export interface Mode {
  kind: ModeKind;
  count: number;
}

export const MAX_COUNT = 5;
export const DEFAULT_MODE: Mode = { kind: 'players', count: 1 };

export function minCount(kind: ModeKind): number {
  return kind === 'teams' ? 2 : 1;
}

/** The selector's number: counts up and wraps back to the minimum. */
export function nextCount(mode: Mode): Mode {
  const count = mode.count >= MAX_COUNT ? minCount(mode.kind) : mode.count + 1;
  return { ...mode, count };
}

/** Switches between players and teams, keeping the count where it's still valid. */
export function toggleKind(mode: Mode): Mode {
  const kind: ModeKind = mode.kind === 'players' ? 'teams' : 'players';
  return { kind, count: Math.max(mode.count, minCount(kind)) };
}

/** A pick happens once there are more fingers than the chosen number. */
export function fingersNeeded(mode: Mode): number {
  return mode.count + 1;
}

/** The word shown next to the number: "player", "players" or "teams". */
export function kindLabel(mode: Mode): string {
  return mode.kind === 'players' && mode.count === 1 ? 'player' : mode.kind;
}

/** Validates a mode read from storage, falling back to the default. */
export function parseMode(value: unknown): Mode {
  if (typeof value === 'object' && value !== null) {
    const { kind, count } = value as Partial<Mode>;
    if (
      (kind === 'players' || kind === 'teams') &&
      Number.isInteger(count) &&
      count! >= minCount(kind) &&
      count! <= MAX_COUNT
    ) {
      return { kind, count: count! };
    }
  }
  return { ...DEFAULT_MODE };
}
