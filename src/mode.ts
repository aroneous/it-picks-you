/**
 * What a round does. The kinds are shown to the user as modes:
 * - `players` ("Choose"): pick `count` players.
 * - `teams` ("Split"): split everyone into `count` teams.
 * - `rank` ("Rank"): put everyone in a random order. `count` isn't used (always 1).
 */
export type ModeKind = 'players' | 'teams' | 'rank';

export interface Mode {
  kind: ModeKind;
  count: number;
}

/** The order the knob turns through. */
export const MODE_KINDS: readonly ModeKind[] = ['players', 'teams', 'rank'];

/** The modes that have a number. */
export type CountedKind = Exclude<ModeKind, 'rank'>;

/**
 * What the selector remembers: the current mode, and a number for each mode that has one,
 * kept separately so changing one doesn't change the other.
 */
export interface ModeSettings {
  kind: ModeKind;
  counts: Record<CountedKind, number>;
}

export const MAX_COUNT = 5;
export const DEFAULT_SETTINGS: ModeSettings = { kind: 'players', counts: { players: 1, teams: 2 } };
export const DEFAULT_MODE: Mode = modeOf(DEFAULT_SETTINGS);

export function minCount(kind: ModeKind): number {
  return kind === 'teams' ? 2 : 1;
}

/** Whether the mode has a number to choose. */
export function hasCount(kind: ModeKind): kind is CountedKind {
  return kind !== 'rank';
}

/** The mode a round should use for these settings. */
export function modeOf(settings: ModeSettings): Mode {
  const { kind, counts } = settings;
  return { kind, count: hasCount(kind) ? counts[kind] : 1 };
}

/** The capsule's number: counts up and wraps back to the minimum. Only this mode's number changes. */
export function nextCount(settings: ModeSettings): ModeSettings {
  const { kind, counts } = settings;
  if (!hasCount(kind)) return settings;
  const count = counts[kind] >= MAX_COUNT ? minCount(kind) : counts[kind] + 1;
  return { kind, counts: { ...counts, [kind]: count } };
}

/** The knob: Choose → Split → Rank → Choose. Each mode keeps its own number. */
export function nextKind(settings: ModeSettings): ModeSettings {
  const kind = MODE_KINDS[(MODE_KINDS.indexOf(settings.kind) + 1) % MODE_KINDS.length];
  return { ...settings, kind };
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

function validCount(kind: CountedKind, count: unknown): count is number {
  return Number.isInteger(count) && (count as number) >= minCount(kind) && (count as number) <= MAX_COUNT;
}

/**
 * Validates settings read from storage, falling back to defaults for anything invalid.
 * Also reads the older `{ kind, count }` format, which had one number shared by all modes:
 * that number becomes the current mode's.
 */
export function parseSettings(value: unknown): ModeSettings {
  const settings: ModeSettings = { kind: DEFAULT_SETTINGS.kind, counts: { ...DEFAULT_SETTINGS.counts } };
  if (typeof value !== 'object' || value === null) return settings;
  const { kind, count, counts } = value as { kind?: unknown; count?: unknown; counts?: unknown };
  if (!MODE_KINDS.includes(kind as ModeKind)) return settings;
  settings.kind = kind as ModeKind;
  if (typeof counts === 'object' && counts !== null) {
    for (const k of ['players', 'teams'] as const) {
      const c = (counts as Record<string, unknown>)[k];
      if (validCount(k, c)) settings.counts[k] = c;
    }
  } else if (hasCount(settings.kind) && validCount(settings.kind, count)) {
    settings.counts[settings.kind] = count;
  }
  return settings;
}
