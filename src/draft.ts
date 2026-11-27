/**
 * The fair-share draft order: each pick goes to whoever is furthest behind.
 *
 * Imagine every pick is worth a little less than the one before: pick k (from 1) is worth
 * x^k for some x just under 1. A player's total is the sum of their picks' worth, and the
 * next pick goes to the player with the smallest total in the limit as x → 1 (ties, which
 * only happen in the first round, go to the earlier seat).
 *
 * With two players this is the Thue–Morse sequence, A B B A B A A B. With more, each round
 * of 2n picks is an order followed by its reverse (A B C D D C B A, D C B A A B C D, …), so
 * everyone's pick positions add up to the same total after every two rounds, and the
 * order changes from round to round to keep the finer imbalances small.
 *
 * Comparing totals as x → 1 means comparing their Taylor coefficients at x = 1 in turn:
 * with t = 1 − x, x^k = Σ_j C(k, j)(−t)^j, so a player's j-th coefficient is
 * (−1)^j Σ C(k, j) over their picks k. The first coefficient that differs decides: fewer
 * picks is further behind; then a larger sum of pick positions; and so on.
 */

/**
 * How many Taylor coefficients to compare. Two players' totals can agree on the first
 * few coefficients (to roughly log2 of the number of picks), so this covers any draft.
 */
const DEPTH = 32;

/** Generates the fair-share order for `players` seats, extending it as far as asked. */
export class FairShareOrder {
  readonly players: number;
  private readonly seats: number[] = [];
  private readonly totals: bigint[][];

  constructor(players: number) {
    if (players < 1) throw new Error('Needs at least one player');
    this.players = players;
    this.totals = Array.from({ length: players }, () => new Array<bigint>(DEPTH + 1).fill(0n));
  }

  /** The seat (0-based) that makes 0-based pick `k`. */
  seat(k: number): number {
    while (this.seats.length <= k) this.extend();
    return this.seats[k];
  }

  /** The first `length` picks. */
  prefix(length: number): number[] {
    if (length > 0) this.seat(length - 1);
    return this.seats.slice(0, length);
  }

  private extend(): void {
    let best = 0;
    for (let p = 1; p < this.players; p++) {
      if (compare(this.totals[p], this.totals[best]) < 0) best = p;
    }
    const k = BigInt(this.seats.length + 1);
    const total = this.totals[best];
    let binomial = 1n; // C(k, j)
    for (let j = 0; j <= DEPTH; j++) {
      total[j] += j % 2 === 0 ? binomial : -binomial;
      binomial = (binomial * (k - BigInt(j))) / BigInt(j + 1);
    }
    this.seats.push(best);
  }
}

function compare(a: bigint[], b: bigint[]): number {
  for (let j = 0; j < a.length; j++) {
    if (a[j] !== b[j]) return a[j] < b[j] ? -1 : 1;
  }
  return 0;
}

/** A drafting player: their place in the ranking (1 = first) and their finger's color and note. */
export interface DraftPlayer {
  rank: number;
  color: string;
  toneIndex: number;
}

/**
 * A draft in progress. Players are seated by rank: seat 0 is first place. `current` is
 * whoever picks now; `history` is everyone who has picked so far, in order.
 */
export class Draft {
  private readonly players: DraftPlayer[];
  private readonly order: FairShareOrder;
  private _pick = 0;

  constructor(players: readonly DraftPlayer[]) {
    if (players.length === 0) throw new Error('A draft needs at least one player');
    this.players = [...players].sort((a, b) => a.rank - b.rank);
    this.order = new FairShareOrder(this.players.length);
  }

  /** How many picks have been made (and the 0-based number of the current pick). */
  get pick(): number {
    return this._pick;
  }

  get current(): DraftPlayer {
    return this.at(this._pick);
  }

  get history(): DraftPlayer[] {
    return Array.from({ length: this._pick }, (_, k) => this.at(k));
  }

  /** The player who makes 0-based pick `k`. */
  at(k: number): DraftPlayer {
    return this.players[this.order.seat(k)];
  }

  /** Ends the current pick. Returns the player who just picked. */
  next(): DraftPlayer {
    const done = this.current;
    this._pick++;
    return done;
  }
}
