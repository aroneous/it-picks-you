import { describe, expect, it } from 'vitest';
import { Draft, FairShareOrder } from './draft';

const letters = (n: number, picks: number) =>
  new FairShareOrder(n).prefix(picks).map(s => String.fromCharCode(65 + s)).join('');

/** Splits a sequence into rounds of two passes (2n picks) for readability. */
const rounds = (n: number, count: number) => letters(n, 2 * n * count).match(new RegExp(`.{${2 * n}}`, 'g'));

describe('FairShareOrder', () => {
  it('is the Thue–Morse sequence for two players', () => {
    expect(letters(2, 16)).toBe('ABBABAABBAABABBA');
  });

  // The opening rounds of the published fair-share tables.
  it.each([
    [3, ['ABCCBA', 'CBAABC', 'BCAACB', 'ACBBCA']],
    [4, ['ABCDDCBA', 'DCBAABCD', 'CBDAADBC', 'ADBCCBDA']],
    [5, ['ABCDEEDCBA', 'EDCBAABCDE', 'CDBEAAEBDC', 'BAEDCCDEAB']],
    [7, ['ABCDEFGGFEDCBA', 'GFEDCBAABCDEFG', 'DECFBGAAGBFCED', 'BAFGCEDDECGFAB']],
    [10, ['ABCDEFGHIJJIHGFEDCBA', 'JIHGFEDCBAABCDEFGHIJ', 'FEGDHCIBJAAJBICHDGEF', 'BCIAHJDGEFFEGDJHAICB']],
  ])('matches the published table for %i players', (n, expected) => {
    expect(rounds(n, expected.length)).toEqual(expected);
  });

  it('always gives a single player every pick', () => {
    expect(letters(1, 5)).toBe('AAAAA');
  });

  it('plays each round as an order and then its reverse, so pick positions even out every round', () => {
    for (let n = 2; n <= 12; n++) {
      const seats = new FairShareOrder(n).prefix(2 * n * 40);
      for (let r = 0; r < seats.length; r += 2 * n) {
        const there = seats.slice(r, r + n);
        const back = seats.slice(r + n, r + 2 * n);
        expect(new Set(there).size).toBe(n);
        expect(back).toEqual([...there].reverse());
      }
    }
  });

  it('gives the same answer however far it has been extended', () => {
    const order = new FairShareOrder(4);
    const later = order.seat(99);
    expect(new FairShareOrder(4).prefix(100)[99]).toBe(later);
    expect(order.prefix(100)).toEqual(new FairShareOrder(4).prefix(100));
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
    for (let i = 0; i < 12; i++) order.push(draft.next().rank);
    expect(order).toEqual([1, 2, 3, 3, 2, 1, 3, 2, 1, 1, 2, 3]);
    expect(draft.pick).toBe(12);
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
