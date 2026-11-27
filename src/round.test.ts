import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLOR_LIST, PICK_STAGGER, PickResult, Round, RoundOptions, TEAM_COLORS, WAIT_DECISION_TIME } from './round';
import { MAX_COUNT } from './mode';
import { Node } from './state';

function winners(round: Round): string[] {
  const r = round.result;
  return r?.kind === 'players' ? r.winners.map(n => n.id) : [];
}

function makeRound(opts: RoundOptions = {}) {
  const onPlace = vi.fn<(n: Node) => void>();
  const onLift = vi.fn<(n: Node) => void>();
  const onPick = vi.fn<(r: PickResult) => void>();
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
    expect(winners(round)).toEqual(['3']);
    expect(round.nodes.map(n => n.id)).toEqual(['3']);
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
    const result = onPick.mock.calls[0][0];
    expect(result.kind).toBe('players');
    const winner = (result as Extract<PickResult, { kind: 'players' }>).winners[0];
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
    expect(winners(round)).toEqual(['1']);

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
    expect(round.result).toBeNull();

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

  it('gives each finger a distinct color while colors remain', () => {
    const { round } = makeRound({ random: () => 0.5 });
    COLOR_LIST.forEach((_, i) => round.touchStart(i, 0, 0));
    expect(new Set(round.nodes.map(n => n.color)).size).toBe(COLOR_LIST.length);
    round.touchStart(100, 0, 0); // more fingers than colors still works
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

  describe('several players', () => {
    it('waits for more fingers than the number of players', () => {
      const { round, onPick } = makeRound({ mode: { kind: 'players', count: 3 } });
      [1, 2, 3].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME * 2);
      expect(onPick).not.toHaveBeenCalled();
      round.touchStart(4, 0, 0);
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      expect(onPick).toHaveBeenCalledTimes(1);
    });

    it('keeps exactly that many distinct winners on screen', () => {
      const { round } = makeRound({ mode: { kind: 'players', count: 2 }, random: () => 0.5 });
      [1, 2, 3, 4, 5].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      const ids = winners(round);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
      expect(round.nodes.map(n => n.id).sort()).toEqual([...ids].sort());
      expect(round.nodes.every(n => n.selectedTime !== undefined)).toBe(true);
    });

    it('reveals winners lowest tone first, PICK_STAGGER apart', () => {
      // random = 0.99 picks the last fingers placed, i.e. the highest tones, in reverse order.
      const { round, onPick } = makeRound({ mode: { kind: 'players', count: 3 }, random: () => 0.99, now: () => 1000 });
      [1, 2, 3, 4, 5].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      const result = onPick.mock.calls[0][0] as Extract<PickResult, { kind: 'players' }>;
      expect(result.winners.map(n => n.toneIndex)).toEqual([2, 3, 4]);
      expect(result.winners.map(n => n.selectedTime)).toEqual([1000, 1000 + PICK_STAGGER, 1000 + 2 * PICK_STAGGER]);
    });

    it('stays locked until losers and winners have all lifted', () => {
      const { round } = makeRound({ mode: { kind: 'players', count: 2 } });
      [1, 2, 3].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      expect(winners(round)).toEqual(['1', '2']);
      round.touchEnd(1);
      expect(round.nodes.map(n => n.id)).toEqual(['2']);
      round.touchEnd(2);
      expect(round.locked).toBe(true); // finger 3 lost but is still down
      round.touchEnd(3);
      expect(round.locked).toBe(false);
    });
  });

  describe('teams', () => {
    it('waits for more fingers than teams', () => {
      const { round, onPick } = makeRound({ mode: { kind: 'teams', count: 3 } });
      [1, 2, 3].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME * 2);
      expect(onPick).not.toHaveBeenCalled();
      round.touchStart(4, 0, 0);
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      expect(onPick).toHaveBeenCalledTimes(1);
    });

    it('keeps every finger and splits them into teams as evenly as possible', () => {
      const { round } = makeRound({ mode: { kind: 'teams', count: 3 }, random: () => 0.7 });
      [1, 2, 3, 4, 5, 6, 7].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      const result = round.result;
      expect(result?.kind).toBe('teams');
      const teams = (result as Extract<PickResult, { kind: 'teams' }>).teams;
      expect(teams.map(t => t.length).sort()).toEqual([2, 2, 3]);
      expect(teams.flat().map(n => n.id).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(round.nodes).toHaveLength(7);
    });

    it('gives each team one color, different from the other teams', () => {
      const { round } = makeRound({ mode: { kind: 'teams', count: 2 }, random: () => 0.3 });
      [1, 2, 3, 4, 5].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      const teams = (round.result as Extract<PickResult, { kind: 'teams' }>).teams;
      const teamColors = teams.map(team => new Set(team.map(n => n.color)));
      expect(teamColors.every(c => c.size === 1)).toBe(true);
      expect(new Set(teamColors.map(c => [...c][0])).size).toBe(2);
    });

    it('deals fingers out in turn (deterministic with random = 0)', () => {
      const { round } = makeRound({ mode: { kind: 'teams', count: 2 } });
      [1, 2, 3].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      const teams = (round.result as Extract<PickResult, { kind: 'teams' }>).teams;
      expect(teams.map(t => t.map(n => n.id))).toEqual([['1', '3'], ['2']]);
      expect(teams.map(t => t[0].color)).toEqual([TEAM_COLORS[0], TEAM_COLORS[1]]);
    });

    it('marks every finger as picked at the same moment', () => {
      const { round } = makeRound({ mode: { kind: 'teams', count: 2 }, now: () => 1000 });
      [1, 2, 3, 4].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      expect(round.nodes.map(n => n.selectedTime)).toEqual([1000, 1000, 1000, 1000]);
    });

    it('unlocks once every team member has lifted', () => {
      const { round } = makeRound({ mode: { kind: 'teams', count: 2 } });
      [1, 2, 3].forEach(id => round.touchStart(id, 0, 0));
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      round.touchEnd(1);
      round.touchEnd(2);
      expect(round.locked).toBe(true);
      expect(round.nodes).toHaveLength(1);
      round.touchEnd(3);
      expect(round.locked).toBe(false);
    });
  });

  describe('setMode', () => {
    it('applies while idle', () => {
      const { round } = makeRound();
      expect(round.setMode({ kind: 'teams', count: 2 })).toBe(true);
      expect(round.mode).toEqual({ kind: 'teams', count: 2 });
    });

    it('is refused while fingers are down or the round is locked', () => {
      const { round } = makeRound();
      round.touchStart(1, 0, 0);
      expect(round.setMode({ kind: 'teams', count: 2 })).toBe(false);
      round.touchStart(2, 0, 0);
      vi.advanceTimersByTime(WAIT_DECISION_TIME);
      round.touchEnd(1);
      expect(round.setMode({ kind: 'teams', count: 2 })).toBe(false);
      round.touchEnd(2);
      expect(round.setMode({ kind: 'teams', count: 2 })).toBe(true);
    });
  });

  it('has enough team colors for the largest team count', () => {
    expect(new Set(TEAM_COLORS).size).toBeGreaterThanOrEqual(MAX_COUNT);
    expect(TEAM_COLORS.every(c => COLOR_LIST.includes(c))).toBe(true);
  });
});
