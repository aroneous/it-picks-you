import { DEFAULT_MODE, fingersNeeded, Mode } from "./mode";
import { Node } from "./state";

export type PickResult =
  /**
   * The chosen players, in reveal order. Everyone else is removed from the screen. Winners
   * are revealed one at a time, lowest tone (pitch) first, `PICK_STAGGER` apart. Each
   * winner's `selectedTime` is its reveal time, which drives both its sound and its region.
   */
  | { kind: 'players'; winners: Node[] }
  /** Every finger, split into teams as evenly as possible. Each node takes its team's colour. */
  | { kind: 'teams'; teams: Node[][] };

/** How long fingers must stay still (no fingers added or lifted) before a pick. */
export const WAIT_DECISION_TIME = 2000; // ms

/** Time between revealing one winner and the next when picking several players. */
export const PICK_STAGGER = 500; // ms

export const COLOR_LIST = [
  'red', 'blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'yellow', 'lime', 'pink'
];

/**
 * Team colours: a subset of COLOR_LIST chosen to be easy to tell apart (no red/orange,
 * green/lime or magenta/pink pairs). Needs at least MAX_COUNT entries.
 */
export const TEAM_COLORS = ['red', 'blue', 'yellow', 'lime', 'magenta'];

export const MAX_TONES = 10;

export interface RoundOptions {
  /** Called when a finger joins the round. */
  onPlace?(node: Node): void;
  /** Called when a finger leaves before a pick has been made. */
  onLift?(node: Node): void;
  /** Called once when the pick is made. */
  onPick?(result: PickResult): void;
  /** Initial mode. Defaults to picking one player. */
  mode?: Mode;
  /** Random source in [0, 1). Defaults to Math.random. */
  random?: () => number;
  /** Clock used for node timestamps. Defaults to performance.now. */
  now?: () => number;
  decisionTime?: number;
}

/**
 * The game state for one screen of fingers, independent of the DOM, canvas and audio.
 *
 * Lifecycle: fingers are placed → once there are more fingers than the mode's
 * count and nothing has changed for `decisionTime`, the pick is made and the
 * round locks → the round unlocks only after *every* finger (picked or not, and
 * any placed while locked) has been lifted.
 */
export class Round {
  /** Nodes currently drawn on screen. */
  readonly nodes: Node[] = [];

  /** Touches that are participating (before a pick) or still shown (after). */
  private readonly touches = new Map<number, Node>();
  /** Touches still down after a pick that aren't shown; they must lift before the next round. */
  private readonly lingering = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _locked = false;
  private _result: PickResult | null = null;
  private _mode: Mode;

  private readonly opts: RoundOptions;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly decisionTime: number;

  constructor(opts: RoundOptions = {}) {
    this.opts = opts;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? (() => performance.now());
    this.decisionTime = opts.decisionTime ?? WAIT_DECISION_TIME;
    this._mode = { ...(opts.mode ?? DEFAULT_MODE) };
  }

  get locked(): boolean {
    return this._locked;
  }

  /** The pick, while the round is locked; otherwise null. */
  get result(): PickResult | null {
    return this._result;
  }

  get mode(): Mode {
    return { ...this._mode };
  }

  /** True when no fingers are down and nothing is shown. */
  get idle(): boolean {
    return !this._locked && this.touches.size === 0 && this.lingering.size === 0;
  }

  /** Changes the mode. Only allowed while idle; returns whether it took effect. */
  setMode(mode: Mode): boolean {
    if (!this.idle) return false;
    this._mode = { ...mode };
    return true;
  }

  touchStart(id: number, x: number, y: number): void {
    if (this._locked) {
      this.lingering.add(id);
      return;
    }
    if (this.touches.has(id)) return;
    const node = new Node(String(id), this.pickColor(), x, y, this.pickToneIndex(), this.now());
    this.nodes.push(node);
    this.touches.set(id, node);
    this.opts.onPlace?.(node);
    this.updateTimer();
  }

  touchMove(id: number, x: number, y: number): void {
    const node = this.touches.get(id);
    if (node) {
      node.x = x;
      node.y = y;
    }
  }

  touchEnd(id: number): void {
    this.lingering.delete(id);
    const node = this.touches.get(id);
    if (node) {
      this.touches.delete(id);
      this.removeNode(node);
      if (!this._locked) this.opts.onLift?.(node);
    }
    if (this._locked) {
      if (this.touches.size === 0 && this.lingering.size === 0) this.reset();
    } else {
      this.updateTimer();
    }
  }

  /**
   * Call when the browser reports no touches on the screen at all. Clears any
   * state left behind by touch events the browser never delivered, so a lost
   * touchend can't leave the round stuck.
   */
  noTouchesRemaining(): void {
    if (this.touches.size > 0 || this.lingering.size > 0 || this._locked) this.reset();
  }

  private reset(): void {
    this.clearTimer();
    this.touches.clear();
    this.lingering.clear();
    this.nodes.length = 0;
    this._locked = false;
    this._result = null;
  }

  private updateTimer(): void {
    this.clearTimer();
    if (this.nodes.length >= fingersNeeded(this._mode)) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pick();
      }, this.decisionTime);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private pick(): void {
    if (this.nodes.length < fingersNeeded(this._mode)) return;
    const order = this.draw(this.nodes);
    const now = this.now();
    let shown: Node[];
    if (this._mode.kind === 'players') {
      // Tone indexes rise with pitch (see audio.ts), so this reveals lowest note first.
      shown = order.slice(0, this._mode.count).sort((a, b) => a.toneIndex - b.toneIndex);
      shown.forEach((node, i) => (node.selectedTime = now + i * PICK_STAGGER));
      this._result = { kind: 'players', winners: shown };
    } else {
      const colors = this.draw(TEAM_COLORS);
      const teams: Node[][] = Array.from({ length: this._mode.count }, () => []);
      order.forEach((node, i) => teams[i % teams.length].push(node));
      teams.forEach((team, t) => team.forEach(node => (node.color = colors[t % colors.length])));
      shown = order;
      for (const node of shown) node.selectedTime = now;
      this._result = { kind: 'teams', teams };
    }
    for (const [id, node] of this.touches) {
      if (!shown.includes(node)) {
        this.touches.delete(id);
        this.lingering.add(id);
      }
    }
    this.nodes.length = 0;
    this.nodes.push(...shown);
    this._locked = true;
    this.opts.onPick?.(this._result);
  }

  /**
   * The items in random order, each drawn uniformly from those left. A random source
   * that always returns 0 keeps the original order, which tests rely on.
   */
  private draw<T>(items: readonly T[]): T[] {
    const left = [...items];
    const out: T[] = [];
    while (left.length > 0) {
      out.push(left.splice(Math.floor(this.random() * left.length), 1)[0]);
    }
    return out;
  }

  private removeNode(node: Node): void {
    const idx = this.nodes.indexOf(node);
    if (idx !== -1) this.nodes.splice(idx, 1);
  }

  /** A colour not used by any node on screen, starting from a random point in the list. */
  private pickColor(): string {
    const used = new Set(this.nodes.map(n => n.color));
    const start = Math.floor(this.random() * COLOR_LIST.length);
    for (let i = 0; i < COLOR_LIST.length; i++) {
      const color = COLOR_LIST[(start + i) % COLOR_LIST.length];
      if (!used.has(color)) return color;
    }
    return COLOR_LIST[start];
  }

  /** The lowest tone index not used by any node on screen. */
  private pickToneIndex(): number {
    const used = new Set(this.nodes.map(n => n.toneIndex));
    for (let i = 0; i < MAX_TONES; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }
}
