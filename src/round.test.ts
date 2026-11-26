import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLOR_LIST, Round, RoundOptions, WAIT_DECISION_TIME } from './round';
import { Node } from './state';

function makeRound(opts: RoundOptions = {}) {
  const onPlace = vi.fn<(n: Node) => void>();
  const onLift = vi.fn<(n: Node) => void>();
  const onPick = vi.fn<(n: Node) => void>();
  const round = new Round({ onPlace, onLift, onPick, random: () => 0, now: () => 0, ...opts });
  return { round, onPlace, onLift, onPick };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Round', () => {
  it('never picks with a single finger', () => {
    const { round, onPick } = makeRound();
    round.touchStart(1, 10, 10);
    vi.advanceTimersByTime(WAIT_DECISION_TIME * 5);
    expect(onPick).not.toHaveBeenCalled();
    expect(round.locked).toBe(false);
  });

  it('picks one winner after the wait with two or more fingers', () => {
    const { round, onPick } = makeRound({ random: () => 0.99 });
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    round.touchStart(3, 0, 0);
    vi.advanceTimersByTime(WAIT_DECISION_TIME - 1);
    expect(onPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(round.locked).toBe(true);
    expect(round.winner?.id).toBe('3');
    expect(round.nodes).toEqual([round.winner]);
  });

  it('restarts the wait whenever a finger is added or lifted', () => {
    const { round, onPick } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    vi.advanceTimersByTime(1500);
    round.touchStart(3, 0, 0);
    vi.advanceTimersByTime(1500);
    round.touchEnd(3);
    vi.advanceTimersByTime(1500);
    expect(onPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('cancels the pick when fewer than two fingers remain', () => {
    const { round, onPick } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    vi.advanceTimersByTime(1000);
    round.touchEnd(2);
    vi.advanceTimersByTime(WAIT_DECISION_TIME * 2);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("passes the winner's own tone to onPick", () => {
    // Regression: the winner tone used to be looked up by index into the node list.
    const { round, onPick } = makeRound({ random: () => 0.6 });
    round.touchStart(17, 0, 0); // tone 0
    round.touchStart(42, 0, 0); // tone 1
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    const winner = onPick.mock.calls[0][0];
    expect(winner.id).toBe('42');
    expect(winner.toneIndex).toBe(1);
  });

  it('plays lift sounds before the pick but not after', () => {
    const { round, onLift } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    round.touchStart(3, 0, 0);
    round.touchEnd(3);
    expect(onLift).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    round.touchEnd(1);
    round.touchEnd(2);
    expect(onLift).toHaveBeenCalledTimes(1);
  });

  it('stays locked until every finger, including the losers, has lifted', () => {
    const { round, onPlace } = makeRound({ random: () => 0 });
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    expect(round.winner?.id).toBe('1');

    round.touchEnd(1); // winner lifts, loser still down
    expect(round.locked).toBe(true);
    expect(round.nodes).toHaveLength(0);

    round.touchStart(3, 0, 0); // ignored while locked
    expect(onPlace).toHaveBeenCalledTimes(2);
    expect(round.nodes).toHaveLength(0);

    round.touchEnd(2);
    expect(round.locked).toBe(true); // finger 3 is still down
    round.touchEnd(3);
    expect(round.locked).toBe(false);
    expect(round.winner).toBeNull();

    round.touchStart(4, 0, 0);
    expect(round.nodes).toHaveLength(1);
  });

  it('starts a fresh round after all fingers lift', () => {
    const { round, onPick } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    round.touchEnd(2);
    round.touchEnd(1);
    round.touchStart(5, 0, 0);
    round.touchStart(6, 0, 0);
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it('recovers from missed touchend events via noTouchesRemaining', () => {
    const { round } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    expect(round.locked).toBe(true);
    round.noTouchesRemaining();
    expect(round.locked).toBe(false);
    expect(round.nodes).toHaveLength(0);
  });

  it('noTouchesRemaining also cancels a pending pick', () => {
    const { round, onPick } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    round.noTouchesRemaining();
    vi.advanceTimersByTime(WAIT_DECISION_TIME);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('ignores duplicate touchstart for the same id', () => {
    const { round, onPlace } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(1, 5, 5);
    expect(round.nodes).toHaveLength(1);
    expect(onPlace).toHaveBeenCalledTimes(1);
  });

  it('moves nodes with their touch', () => {
    const { round } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchMove(1, 30, 40);
    round.touchMove(99, 1, 1); // unknown touch is ignored
    expect(round.nodes[0]).toMatchObject({ x: 30, y: 40 });
  });

  it('gives each finger a distinct colour while colours remain', () => {
    const { round } = makeRound({ random: () => 0.5 });
    COLOR_LIST.forEach((_, i) => round.touchStart(i, 0, 0));
    expect(new Set(round.nodes.map(n => n.color)).size).toBe(COLOR_LIST.length);
    round.touchStart(100, 0, 0); // more fingers than colours still works
    expect(round.nodes).toHaveLength(COLOR_LIST.length + 1);
  });

  it('assigns the lowest free tone and reuses freed tones', () => {
    const { round } = makeRound();
    round.touchStart(1, 0, 0);
    round.touchStart(2, 0, 0);
    round.touchStart(3, 0, 0);
    expect(round.nodes.map(n => n.toneIndex)).toEqual([0, 1, 2]);
    round.touchEnd(2);
    round.touchStart(4, 0, 0);
    expect(round.nodes.find(n => n.id === '4')?.toneIndex).toBe(1);
  });
});
