import { Draft, DraftPlayer } from "./draft";
import { labelColorOn } from "./draw";

/** How long the finished pick takes to fly down into the history. */
const FLY_TIME = 420; // ms
/** How long the next player's card takes to fade in once the flight lands. */
const CARD_FADE_IN_TIME = 250; // ms
/** How long the draft screen takes to fade out after Done. Matches `.draft` in styles.css. */
const CLOSE_TIME = 250; // ms

function reduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

export interface RankActions {
  /** Shows the buttons (and makes them tappable), or hides them. */
  setVisible(visible: boolean): void;
}

/** The Done and Start draft buttons shown under a finished rank. */
export function createRankActions(onDone: () => void, onStartDraft: () => void): RankActions {
  const root = document.createElement('div');
  root.className = 'rank-actions hidden';
  root.inert = true;
  root.append(
    button('pill-btn secondary', 'Done', onDone),
    button('pill-btn primary', 'Start draft', onStartDraft),
  );
  document.body.appendChild(root);
  let shown = false;
  return {
    setVisible(visible: boolean) {
      if (visible === shown) return;
      shown = visible;
      root.classList.toggle('hidden', !visible);
      root.inert = !visible;
    },
  };
}

export interface DraftViewOptions {
  /** Called whenever a player becomes the one to pick, including the first. */
  onTurn?(player: DraftPlayer): void;
  /** Called once the draft screen has closed. */
  onClose?(): void;
}

/**
 * The full-screen draft: a large card in the color of the player whose turn it is, with
 * their rank in big type, and above it a history of picks so far as small rounded squares.
 * Next (or tapping the card) ends the pick: the card flies down into its place in the
 * history and the next player's card fades in. Done fades the whole screen out.
 */
export function openDraft(players: readonly DraftPlayer[], opts: DraftViewOptions = {}): void {
  const draft = new Draft(players);

  const root = document.createElement('div');
  root.className = 'draft';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Draft');

  const history = document.createElement('ol');
  history.className = 'draft-history';
  history.setAttribute('aria-label', 'Picks so far');
  history.hidden = true;

  const stage = document.createElement('div');
  stage.className = 'draft-stage';
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'draft-card';
  card.setAttribute('aria-live', 'polite');
  const pickLabel = document.createElement('span');
  pickLabel.className = 'draft-card-pick';
  const number = document.createElement('span');
  number.className = 'draft-card-number';
  card.append(pickLabel, number);
  stage.appendChild(card);

  const actions = document.createElement('div');
  actions.className = 'draft-actions';
  actions.append(
    button('pill-btn secondary', 'Done', close),
    button('pill-btn primary draft-next', 'Next', advance),
  );
  card.addEventListener('click', advance);

  root.append(history, stage, actions);
  document.body.appendChild(root);
  showCurrent();
  opts.onTurn?.(draft.current);
  if (!reduceMotion()) {
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: CARD_FADE_IN_TIME, easing: 'ease-out' });
  }

  function showCurrent() {
    const player = draft.current;
    card.style.background = player.color;
    card.style.color = labelColorOn(player.color);
    pickLabel.textContent = `Pick ${draft.pick + 1}`;
    number.textContent = String(player.rank);
    card.setAttribute('aria-label', `Pick ${draft.pick + 1}: player ${player.rank}. Tap for the next pick.`);
  }

  function historyChip(player: DraftPlayer, pick: number): HTMLLIElement {
    const chip = document.createElement('li');
    chip.className = 'draft-chip';
    chip.style.background = player.color;
    chip.style.color = labelColorOn(player.color);
    chip.textContent = String(player.rank);
    chip.setAttribute('aria-label', `Pick ${pick}: player ${player.rank}`);
    return chip;
  }

  /** Finishes any animation still running from the previous Next, right away. */
  let settle: (() => void) | null = null;
  let closed = false;

  function advance() {
    if (closed) return;
    settle?.();
    const from = card.getBoundingClientRect();
    const fromFont = parseFloat(getComputedStyle(number).fontSize);
    const done = draft.next();
    const chip = historyChip(done, draft.pick);
    history.hidden = false;
    history.appendChild(chip);
    history.scrollTop = history.scrollHeight;
    showCurrent();
    opts.onTurn?.(draft.current);
    if (reduceMotion()) return;

    // The new chip (and any new row of them) is laid out now, so we know where to fly to.
    const to = chip.getBoundingClientRect();
    const toFont = parseFloat(getComputedStyle(chip).fontSize);
    const toRadius = getComputedStyle(chip).borderRadius;
    chip.style.visibility = 'hidden';
    card.style.opacity = '0';

    const flyer = document.createElement('div');
    flyer.className = 'draft-flyer';
    flyer.style.background = done.color;
    flyer.style.color = labelColorOn(done.color);
    flyer.textContent = String(done.rank);
    root.appendChild(flyer);

    const box = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const fly = flyer.animate(
      [
        { ...box(from), fontSize: `${fromFont}px`, borderRadius: getComputedStyle(card).borderRadius },
        { ...box(to), fontSize: `${toFont}px`, borderRadius: toRadius },
      ],
      { duration: FLY_TIME, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' },
    );
    let fadeIn: Animation | null = null;

    const land = () => {
      flyer.remove();
      chip.style.visibility = '';
      card.style.opacity = '';
    };
    const finish = () => {
      if (settle !== finish) return;
      settle = null;
      fly.cancel();
      fadeIn?.cancel();
      land();
    };
    settle = finish;

    fly.finished.then(() => {
      if (settle !== finish) return;
      land();
      fadeIn = card.animate(
        [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
        { duration: CARD_FADE_IN_TIME, easing: 'ease-out' },
      );
      fadeIn.finished.then(() => settle === finish && (settle = null), () => {});
    }, () => {});
  }

  function close() {
    if (closed) return;
    closed = true;
    settle?.();
    root.inert = true;
    root.classList.add('closing');
    const remove = () => {
      root.remove();
      opts.onClose?.();
    };
    if (reduceMotion()) remove();
    else setTimeout(remove, CLOSE_TIME);
  }
}
