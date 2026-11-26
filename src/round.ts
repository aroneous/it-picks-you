import { Node } from "./state";

/** How long fingers must stay still (no fingers added or lifted) before a pick. */
export const WAIT_DECISION_TIME = 2000; // ms

export const COLOR_LIST = [
  'red', 'blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'yellow', 'lime', 'pink'
];

export const MAX_TONES = 10;

export interface RoundOptions {
  /** Called when a finger joins the round. */
  onPlace?(node: Node): void;
  /** Called when a finger leaves before a pick has been made. */
  onLift?(node: Node): void;
  /** Called once when the winner is picked. */
  onPick?(winner: Node): void;
  /** Random source in [0, 1). Defaults to Math.random. */
  random?: () => number;
  /** Clock used for node timestamps. Defaults to performance.now. */
  now?: () => number;
  decisionTime?: number;
}

/**
 * The game state for one screen of fingers, independent of the DOM, canvas and audio.
 *
 * Lifecycle: fingers are placed → once there are at least two and nothing has
 * changed for `decisionTime`, one is picked and the round locks → the round
 * unlocks only after *every* finger (winner, losers, and any placed while
 * locked) has been lifted.
 */
export class Round {
  /** Nodes currently drawn on screen. */
  readonly nodes: Node[] = [];

  /** Touches that are participating (before a pick) or the winner (after). */
  private readonly touches = new Map<number, Node>();
  /** Touches still down after a pick that aren't the winner; they must lift before the next round. */
  private readonly lingering = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _locked = false;
  private _winner: Node | null = null;

  private readonly opts: RoundOptions;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly decisionTime: number;

  constructor(opts: RoundOptions = {}) {
    this.opts = opts;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? (() => performance.now());
    this.decisionTime = opts.decisionTime ?? WAIT_DECISION_TIME;
  }

  get locked(): boolean {
    return this._locked;
  }

  get winner(): Node | null {
    return this._winner;
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
    this._winner = null;
  }

  private updateTimer(): void {
    this.clearTimer();
    if (this.nodes.length >= 2) {
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
    if (this.nodes.length < 2) return;
    const winner = this.nodes[Math.floor(this.random() * this.nodes.length)];
    for (const [id, node] of this.touches) {
      if (node !== winner) {
        this.touches.delete(id);
        this.lingering.add(id);
      }
    }
    this.nodes.length = 0;
    this.nodes.push(winner);
    winner.selectedTime = this.now();
    this._winner = winner;
    this._locked = true;
    this.opts.onPick?.(winner);
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
