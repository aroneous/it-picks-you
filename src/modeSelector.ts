import {
  countOptions, hasCount, kindLabel, knobSteps, MAX_COUNT, minCount, Mode, MODE_KINDS, ModeKind, modeName, modeOf,
  ModeSettings, nextCount, nextKind, otherKinds, parseSettings, withCount, withKind,
} from "./mode";

const STORAGE_KEY = 'itpicksyou.mode';

/** The remembered mode and numbers. Stored as `{ kind, counts: { players, teams } }`. */
export function loadSettings(): ModeSettings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return parseSettings(null);
  }
}

function saveSettings(settings: ModeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private browsing, blocked site data). The mode just isn't remembered.
  }
}

export interface ModeSelector {
  /** Hides the selector (and makes it untappable), e.g. while fingers are on the screen. */
  setHidden(hidden: boolean): void;
}

/** How long a capsule takes to slide out, and the next one to slide in. */
const CAPSULE_ANIMATION_TIME = 220; // ms
/** How long a chosen mode takes to move up from the menu into the capsule's place. */
const MENU_SELECT_TIME = 280; // ms
/** Delay between one menu capsule (or number) appearing and the next. */
const MENU_STAGGER = 40; // ms
/** How long the number pane takes to unroll, or roll back up. */
const PANE_ANIMATION_TIME = 200; // ms
/** How long a press must last to count as a long press. */
const LONG_PRESS_TIME = 450; // ms
/** A press that moves further than this isn't a long press. */
const LONG_PRESS_SLOP = 10; // px
/** The knob turns this far for each mode. */
const KNOB_STEP = 360 / MODE_KINDS.length; // degrees

/** Where a capsule goes when it leaves, and comes from when it arrives in the menu. */
const BELOW = 'translateY(14px) scale(0.8)';
const ABOVE = 'translateY(-14px) scale(0.8)';

function reduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** A press that's still down when its long press fires: which pointer, and where it is now. */
interface Press {
  id: number;
  x: number;
  y: number;
}

/**
 * Set when a long press fires: the click that ends it is swallowed wherever it lands. It
 * can land on the element pressed, on a picker option now under the pointer, or (with a
 * mouse, pressed on one element and released over another) on their common ancestor.
 * Cleared by the next press, in case no click comes.
 */
let swallowClick = false;
let swallowInstalled = false;

function installClickSwallow(): void {
  if (swallowInstalled) return;
  swallowInstalled = true;
  document.addEventListener('pointerdown', () => (swallowClick = false), true);
  document.addEventListener('click', e => {
    if (!swallowClick || !e.isTrusted) return;
    swallowClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
}

/**
 * Calls `onLongPress` when `el` is held still for `LONG_PRESS_TIME`, passing the press if
 * it's still down (so a drag can carry on into the picker), and swallows the click that
 * follows so the element's tap action doesn't also run. A right click (or a long press
 * the browser reports as `contextmenu`) opens it too.
 */
function addLongPress(el: HTMLElement, onLongPress: (press: Press | null) => void): void {
  installClickSwallow();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start = { x: 0, y: 0 };
  let press: Press | null = null;
  /** The long press for the current press has fired. */
  let fired = false;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const fire = () => {
    fired = true;
    swallowClick = press !== null;
    navigator.vibrate?.(10);
    onLongPress(press);
  };
  el.addEventListener('pointerdown', e => {
    fired = false;
    press = null;
    if (!e.isPrimary || e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    press = { id: e.pointerId, ...start };
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fire();
    }, LONG_PRESS_TIME);
  });
  el.addEventListener('pointermove', e => {
    if (press?.id === e.pointerId) press = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (timer !== null && Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_SLOP) cancel();
  });
  const release = () => {
    cancel();
    press = null;
  };
  for (const type of ['pointerup', 'pointercancel'] as const) el.addEventListener(type, release);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (fired) return;
    // The browser can call a long press a context menu before our timer does.
    cancel();
    fire();
  });
}

/**
 * The selector at the top of the screen: a knob that turns through the modes (Choose,
 * Split, Rank) and, to its right, a capsule describing the current one. In Choose and
 * Split the capsule's number cycles on tap; each of those modes keeps its own number.
 *
 * Changing mode swaps the capsule: the old one slides down, shrinks and fades out while
 * the new one comes in from above. The capsule's slot is as wide as the widest capsule, so
 * the knob stays in the same place whatever the mode; narrower capsules leave space on the
 * right.
 *
 * Long presses open pickers. On the knob: the other two modes' capsules grow in below the
 * current one, and tapping one moves it up into place (the others leave as on a knob tap).
 * On the number: it unrolls into a column of every number the mode allows, with the current
 * one highlighted; tapping one sets it and rolls the column back up. Tapping anywhere else
 * closes either picker without a change.
 *
 * `onChange` is asked to apply each new mode and returns whether it did, so the
 * selector never shows a mode that the round didn't accept.
 */
export function createModeSelector(initial: ModeSettings, onChange: (mode: Mode) => boolean): ModeSelector {
  let settings = initial;
  let knobAngle = MODE_KINDS.indexOf(settings.kind) * KNOB_STEP;
  let hidden = false;

  const root = document.createElement('div');
  root.className = 'mode-selector';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Mode');

  const knob = document.createElement('button');
  knob.className = 'mode-knob';
  const dial = document.createElement('span');
  dial.className = 'mode-knob-dial';
  dial.setAttribute('aria-hidden', 'true');
  knob.appendChild(dial);

  const slot = document.createElement('div');
  slot.className = 'mode-slot';
  root.append(knob, slot);

  /** Under the selector while a picker is open: a tap anywhere else closes it. */
  const backdrop = document.createElement('div');
  backdrop.className = 'mode-backdrop';
  backdrop.hidden = true;
  backdrop.addEventListener('click', () => closePickers());
  document.body.append(backdrop, root);

  let capsule = buildCapsule(modeOf(settings));
  slot.appendChild(capsule);
  renderKnob();
  fitSlot();
  document.fonts?.ready.then(fitSlot);

  /** Sizes the slot to the widest capsule any mode can show. */
  function fitSlot() {
    let widest = 0;
    for (const kind of MODE_KINDS) {
      for (let count = minCount(kind); count <= MAX_COUNT; count++) {
        const probe = buildCapsule({ kind, count });
        probe.style.visibility = 'hidden';
        slot.appendChild(probe);
        widest = Math.max(widest, probe.offsetWidth);
        probe.remove();
        if (!hasCount(kind)) break;
      }
    }
    slot.style.width = `${widest}px`;
  }

  /**
   * A capsule for `mode`. The live one's number is a button; a menu option is a single
   * button whose number is just shown.
   */
  function buildCapsule(mode: Mode, asOption = false): HTMLElement {
    const el = document.createElement(asOption ? 'button' : 'div');
    el.className = asOption ? 'mode-capsule mode-option' : 'mode-capsule';
    const name = document.createElement('span');
    name.className = 'mode-name';
    name.textContent = modeName(mode.kind);
    el.appendChild(name);
    if (mode.kind === 'teams') {
      // "Split into 3 teams"
      const into = document.createElement('span');
      into.className = 'mode-joiner';
      into.textContent = 'into';
      el.appendChild(into);
    }
    if (hasCount(mode.kind)) {
      const count = document.createElement(asOption ? 'span' : 'button');
      count.className = 'mode-count';
      if (!asOption) {
        count.addEventListener('click', () => {
          if (pane) return closeCountPane();
          update(nextCount(settings), false);
        });
        addLongPress(count, openCountPane);
      }
      el.appendChild(count);
    }
    const kind = document.createElement('span');
    kind.className = 'mode-kind';
    el.appendChild(kind);
    fillCapsule(el, mode);
    if (asOption) {
      const into = mode.kind === 'teams' ? 'into ' : '';
      const count = hasCount(mode.kind) ? `${mode.count} ` : '';
      el.setAttribute('aria-label', `${modeName(mode.kind)} ${into}${count}${kindLabel(mode)}`);
    }
    return el;
  }

  /** Updates the parts of the capsule that change within a mode: the number and its noun. */
  function fillCapsule(el: HTMLElement, mode: Mode) {
    const count = el.querySelector('.mode-count');
    if (count) {
      count.textContent = String(mode.count);
      if (count instanceof HTMLButtonElement) {
        count.setAttribute('aria-label', `Number of ${mode.kind}: ${mode.count}. Tap to change, or press and hold to choose.`);
      }
    }
    el.querySelector('.mode-kind')!.textContent = kindLabel(mode);
  }

  function renderKnob() {
    dial.style.transform = `rotate(${knobAngle}deg)`;
    const mode = modeOf(settings);
    const next = modeName(nextKind(settings).kind);
    const count = hasCount(mode.kind) ? `${mode.count} ` : '';
    const into = mode.kind === 'teams' ? 'into ' : '';
    knob.setAttribute(
      'aria-label',
      `Mode: ${modeName(mode.kind)} ${into}${count}${kindLabel(mode)}. Tap for ${next}, or press and hold to choose.`,
    );
  }

  /** Sends a capsule away: down, shrinking and fading. It's removed once gone. */
  function leave(el: HTMLElement, delay = 0) {
    el.classList.add('leaving');
    el.setAttribute('aria-hidden', 'true');
    el.inert = true;
    el.getAnimations().forEach(a => a.cancel());
    if (reduceMotion()) return el.remove();
    el.animate(
      [{ transform: 'none', opacity: 1 }, { transform: BELOW, opacity: 0 }],
      { duration: CAPSULE_ANIMATION_TIME, delay, easing: 'ease-in', fill: 'forwards' }
    ).finished.then(() => el.remove(), () => el.remove());
  }

  /** Replaces the capsule with one for the current settings, coming in from above. */
  function swapCapsule() {
    leave(capsule);
    capsule = buildCapsule(modeOf(settings));
    slot.appendChild(capsule);
    if (reduceMotion()) return;
    capsule.animate(
      [{ transform: ABOVE, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: CAPSULE_ANIMATION_TIME, delay: CAPSULE_ANIMATION_TIME / 3, easing: 'ease-out', fill: 'backwards' }
    );
  }

  /** Applies new settings if the round accepts them. Returns whether it did. */
  function apply(next: ModeSettings): boolean {
    if (!onChange(modeOf(next))) return false;
    const steps = knobSteps(settings.kind, next.kind);
    settings = next;
    saveSettings(settings);
    knobAngle += steps * KNOB_STEP;
    renderKnob();
    return true;
  }

  function update(next: ModeSettings, kindChanged: boolean) {
    if (!apply(next)) return;
    if (kindChanged) swapCapsule();
    else fillCapsule(capsule, modeOf(settings));
  }

  function setPickerOpen(open: boolean) {
    backdrop.hidden = !open;
    root.classList.toggle('picking', open);
  }

  function closePickers(instant = false) {
    closeModeMenu(instant);
    closeCountPane(instant);
  }

  /**
   * After a long press opens `picker` with the press still down: sliding onto an option
   * highlights it, and letting go there chooses it. Letting go without having moved leaves
   * the picker open for a tap.
   */
  function dragToChoose(picker: HTMLElement, press: Press | null) {
    if (!press) return;
    let dragging = false;
    let hover: HTMLElement | null = null;
    const optionAt = (x: number, y: number) => {
      const option = document.elementFromPoint(x, y)?.closest<HTMLElement>('.mode-option, .mode-count-option');
      return option && picker.contains(option) && !option.classList.contains('leaving') ? option : null;
    };
    const setHover = (option: HTMLElement | null) => {
      hover?.classList.remove('hover');
      hover = option;
      hover?.classList.add('hover');
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== press.id) return;
      if (!dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_SLOP) dragging = true;
      if (dragging) setHover(optionAt(e.clientX, e.clientY));
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== press.id) return;
      setHover(null);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      const open = picker === menu || picker === pane;
      if (e.type === 'pointerup' && dragging && open) optionAt(e.clientX, e.clientY)?.click();
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
  }

  // ---- The knob's long-press menu: every mode as a capsule ----

  let menu: HTMLElement | null = null;

  function openModeMenu(press: Press | null = null) {
    if (menu || hidden) return;
    closeCountPane(true);
    const el = document.createElement('div');
    el.className = 'mode-menu';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Choose a mode');
    otherKinds(settings.kind).forEach((kind, i) => {
      const option = buildCapsule(modeOf(withKind(settings, kind)), true);
      option.addEventListener('click', () => chooseKind(kind, option));
      el.appendChild(option);
      if (!reduceMotion()) {
        // The reverse of leaving: up from below, growing and fading in.
        option.animate(
          [{ transform: BELOW, opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: CAPSULE_ANIMATION_TIME, delay: i * MENU_STAGGER, easing: 'ease-out', fill: 'backwards' },
        );
      }
    });
    slot.appendChild(el);
    menu = el;
    setPickerOpen(true);
    dragToChoose(el, press);
    (el.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  }

  /** Closes the menu: the options leave as capsules do, the last one first. */
  function closeModeMenu(instant = false) {
    const el = menu;
    if (!el) return;
    menu = null;
    setPickerOpen(false);
    el.inert = true;
    const options = Array.from(el.querySelectorAll<HTMLElement>('.mode-option'));
    if (instant || reduceMotion() || options.length === 0) return el.remove();
    options.reverse().forEach((option, i) => leave(option, i * MENU_STAGGER));
    setTimeout(() => el.remove(), CAPSULE_ANIMATION_TIME + options.length * MENU_STAGGER);
  }

  /** A mode was tapped in the menu: it moves up into the capsule's place, and the rest leave. */
  function chooseKind(kind: ModeKind, option: HTMLElement) {
    const el = menu;
    if (!el) return;
    const from = option.getBoundingClientRect();
    if (!apply(withKind(settings, kind))) return closeModeMenu();
    leave(capsule);
    capsule = buildCapsule(modeOf(settings));
    slot.appendChild(capsule);
    if (!reduceMotion()) {
      const to = capsule.getBoundingClientRect();
      capsule.animate(
        [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }],
        { duration: MENU_SELECT_TIME, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      );
    }
    // The new capsule has taken the option's place; the menu closes around it.
    option.remove();
    closeModeMenu();
  }

  // ---- The number's long-press pane: every number the mode allows ----

  let pane: HTMLElement | null = null;

  function openCountPane(press: Press | null = null) {
    if (pane || hidden || !hasCount(settings.kind)) return;
    closeModeMenu(true);
    const chip = capsule.querySelector<HTMLElement>('.mode-count');
    if (!chip) return;
    const { kind } = settings;
    const current = settings.counts[kind];
    const el = document.createElement('div');
    el.className = 'mode-count-pane';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', `Number of ${kind}`);
    countOptions(kind).forEach(count => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'mode-count-option';
      option.textContent = String(count);
      option.setAttribute('aria-pressed', String(count === current));
      option.classList.toggle('current', count === current);
      option.addEventListener('click', () => chooseCount(count));
      el.appendChild(option);
    });
    // Unrolls downward from the number itself: the first option sits where the number was.
    const chipBox = chip.getBoundingClientRect();
    const slotBox = slot.getBoundingClientRect();
    el.style.left = `${chipBox.left - slotBox.left}px`;
    el.style.top = `${chipBox.top - slotBox.top}px`;
    el.style.minWidth = `${chipBox.width}px`;
    slot.appendChild(el);
    pane = el;
    setPickerOpen(true);
    dragToChoose(el, press);
    (el.querySelector<HTMLElement>('.current') ?? el.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
    if (reduceMotion()) return;
    el.animate(
      [{ clipPath: rolledUp(el, chipBox.height) }, { clipPath: 'inset(0 round 18px)' }],
      { duration: PANE_ANIMATION_TIME, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
    Array.from(el.children).forEach((option, i) => {
      option.animate(
        [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
        { duration: PANE_ANIMATION_TIME, delay: i * (MENU_STAGGER / 2), easing: 'ease-out', fill: 'backwards' },
      );
    });
  }

  /** The pane clipped back to the number's size, at its top. */
  function rolledUp(el: HTMLElement, height: number): string {
    return `inset(0 0 ${Math.max(0, el.offsetHeight - height)}px 0 round 18px)`;
  }

  function closeCountPane(instant = false) {
    const el = pane;
    if (!el) return;
    pane = null;
    setPickerOpen(false);
    el.inert = true;
    if (instant || reduceMotion()) return el.remove();
    const chip = capsule.querySelector<HTMLElement>('.mode-count');
    el.animate(
      [{ clipPath: 'inset(0 round 18px)', opacity: 1 }, { clipPath: rolledUp(el, chip?.offsetHeight ?? 34), opacity: 0 }],
      { duration: PANE_ANIMATION_TIME, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
    ).finished.then(() => el.remove(), () => el.remove());
  }

  function chooseCount(count: number) {
    if (apply(withCount(settings, count))) fillCapsule(capsule, modeOf(settings));
    closeCountPane();
  }

  knob.addEventListener('click', () => {
    if (menu || pane) return closePickers();
    update(nextKind(settings), true);
  });
  addLongPress(knob, openModeMenu);
  // Taps on the selector outside any button (the capsule is inert while picking) close a picker.
  root.addEventListener('click', e => {
    if ((menu || pane) && (e.target === root || e.target === slot)) closePickers();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (menu || pane)) {
      closePickers();
      knob.focus();
    }
  });

  return {
    setHidden(hide: boolean) {
      if (hide === hidden) return;
      hidden = hide;
      if (hide) closePickers(true);
      root.classList.toggle('hidden', hide);
      root.toggleAttribute('inert', hide);
    },
  };
}
