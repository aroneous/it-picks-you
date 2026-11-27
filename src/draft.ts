/**
 * Draft order from the Thue–Morse sequence, generalised to any number of players
 * (Prouhet's construction): pick `k` (from 0) goes to seat `(sum of the base-n digits of k) mod n`.
 *
 * With two players that's the Thue–Morse sequence itself: A B B A B A A B … Whoever picks
 * first in one round picks later in the next, so neither side keeps an edge. For n players,
 * every block of n^m picks (from the start) gives each seat the same number of picks, and
 * the same sum of pick positions (and of their squares, and so on up to the (m−1)th powers).
 */
export function draftSeat(players: number, pick: number): number {
  if (players < 2) return 0;
  let sum = 0;
  for (let k = pick; k > 0; k = Math.floor(k / players)) sum += k % players;
  return sum % players;
}

/** A drafting player: their place in the ranking (1 = first) and their finger's color and note. */
export interface DraftPlayer {
  rank: number;
  color: string;
  toneIndex: number;
}

/**
 * A draft in progress. Players are ordered by rank: seat 0 is first place. `current` is
 * whoever picks now; `history` is everyone who has picked so far, in order.
 */
export class Draft {
  private readonly players: DraftPlayer[];
  private _pick = 0;

  constructor(players: readonly DraftPlayer[]) {
    if (players.length === 0) throw new Error('A draft needs at least one player');
    this.players = [...players].sort((a, b) => a.rank - b.rank);
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

  /** The player who picks at 0-based pick `k`. */
  at(k: number): DraftPlayer {
    return this.players[draftSeat(this.players.length, k)];
  }

  /** Ends the current pick. Returns the player who just picked. */
  next(): DraftPlayer {
    const done = this.current;
    this._pick++;
    return done;
  }
}
