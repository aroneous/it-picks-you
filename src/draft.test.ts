import { describe, expect, it } from 'vitest';
import { Draft, draftSeat } from './draft';

const seats = (players: number, picks: number) => Array.from({ length: picks }, (_, k) => draftSeat(players, k));

describe('draftSeat', () => {
  it('is the Thue–Morse sequence for two players', () => {
    expect(seats(2, 16).join('')).toBe('0110100110010110');
  });

  it('generalises to more players by base-n digit sums', () => {
    expect(seats(3, 9).join('')).toBe('012120201');
    expect(seats(4, 8).join('')).toBe('01231230');
  });

  it('always gives a single player every pick', () => {
    expect(seats(1, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('balances pick counts and position sums over each block of n^m picks', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      for (const m of [1, 2, 3]) {
        const block = n ** m;
        const counts = new Array(n).fill(0);
        const sums = new Array(n).fill(0);
        seats(n, block).forEach((s, k) => {
          counts[s]++;
          sums[s] += k;
        });
        expect(new Set(counts).size).toBe(1);
        if (m >= 2) expect(new Set(sums).size).toBe(1);
      }
    }
  });
});

describe('Draft', () => {
  const players = [
    { rank: 2, color: 'blue', toneIndex: 1 },
    { rank: 1, color: 'red', toneIndex: 0 },
    { rank: 3, color: 'green', toneIndex: 2 },
  ];

  it('starts with first place and follows the draft order by rank', () => {
    const draft = new Draft(players);
    expect(draft.current.rank).toBe(1);
    const order = [];
    for (let i = 0; i < 9; i++) order.push(draft.next().rank);
    expect(order).toEqual([1, 2, 3, 2, 3, 1, 3, 1, 2]);
    expect(draft.pick).toBe(9);
    expect(draft.history.map(p => p.rank)).toEqual(order);
  });

  it('returns the player who just picked from next()', () => {
    const draft = new Draft(players.slice(0, 2));
    expect(draft.next().color).toBe('red');
    expect(draft.current.color).toBe('blue');
    expect(draft.next().color).toBe('blue');
    expect(draft.current.color).toBe('blue'); // A B B A
  });
});
