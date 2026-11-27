import { hasCount, kindLabel, Mode, MODE_KINDS, modeName, nextCount, nextKind, parseMode } from "./mode";

const STORAGE_KEY = 'itpicksyou.mode';

export function loadMode(): Mode {
  try {
    return parseMode(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return parseMode(null);
  }
}

function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
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
/** The knob turns this far for each mode. */
const KNOB_STEP = 360 / MODE_KINDS.length; // degrees

/**
 * The selector at the top of the screen: a knob that turns through the modes (Choose,
 * Split, Rank) and, to its right, a capsule describing the current one. In Choose and
 * Split the capsule's number cycles on tap.
 *
 * Changing mode swaps the capsule: the old one slides down, shrinks and fades out while
 * the new one comes in from above. The capsule's slot animates to the new width so the
 * centered selector doesn't jump.
 *
 * `onChange` is asked to apply each new mode and returns whether it did, so the
 * selector never shows a mode that the round didn't accept.
 */
export function createModeSelector(initial: Mode, onChange: (mode: Mode) => boolean): ModeSelector {
  let mode = initial;
  let knobAngle = MODE_KINDS.indexOf(mode.kind) * KNOB_STEP;

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
  document.body.appendChild(root);

  let capsule = buildCapsule();
  slot.appendChild(capsule);
  renderKnob();
  fitSlot();
  // Only animate width changes after the first layout.
  requestAnimationFrame(() => slot.classList.add('animated'));

  function buildCapsule(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'mode-capsule';
    const name = document.createElement('span');
    name.className = 'mode-name';
    name.textContent = modeName(mode.kind);
    el.appendChild(name);
    if (hasCount(mode.kind)) {
      const count = document.createElement('button');
      count.className = 'mode-count';
      count.addEventListener('click', () => update(nextCount(mode), false));
      el.appendChild(count);
    }
    const kind = document.createElement('span');
    kind.className = 'mode-kind';
    el.appendChild(kind);
    fillCapsule(el);
    return el;
  }

  /** Updates the parts of the capsule that change within a mode: the number and its noun. */
  function fillCapsule(el: HTMLElement) {
    const count = el.querySelector('.mode-count');
    if (count) {
      count.textContent = String(mode.count);
      count.setAttribute('aria-label', `Number of ${mode.kind}: ${mode.count}. Tap to change.`);
    }
    el.querySelector('.mode-kind')!.textContent = kindLabel(mode);
  }

  function renderKnob() {
    dial.style.transform = `rotate(${knobAngle}deg)`;
    const next = modeName(nextKind(mode).kind);
    const count = hasCount(mode.kind) ? `${mode.count} ` : '';
    knob.setAttribute('aria-label', `Mode: ${modeName(mode.kind)} ${count}${kindLabel(mode)}. Tap for ${next}.`);
  }

  function fitSlot() {
    slot.style.width = `${capsule.offsetWidth}px`;
  }

  function swapCapsule() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const old = capsule;
    old.classList.add('leaving');
    old.setAttribute('aria-hidden', 'true');
    old.inert = true;
    old.getAnimations().forEach(a => a.cancel());
    capsule = buildCapsule();
    slot.appendChild(capsule);
    fitSlot();
    if (reduceMotion) {
      old.remove();
      return;
    }
    const away = 'translateY(14px) scale(0.8)';
    const above = 'translateY(-14px) scale(0.8)';
    old.animate(
      [{ transform: 'none', opacity: 1 }, { transform: away, opacity: 0 }],
      { duration: CAPSULE_ANIMATION_TIME, easing: 'ease-in', fill: 'forwards' }
    ).finished.then(() => old.remove(), () => old.remove());
    capsule.animate(
      [{ transform: above, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: CAPSULE_ANIMATION_TIME, delay: CAPSULE_ANIMATION_TIME / 3, easing: 'ease-out', fill: 'backwards' }
    );
  }

  function update(next: Mode, kindChanged: boolean) {
    if (!onChange(next)) return;
    mode = next;
    saveMode(mode);
    if (kindChanged) {
      knobAngle += KNOB_STEP;
      swapCapsule();
    } else {
      fillCapsule(capsule);
      fitSlot();
    }
    renderKnob();
  }

  knob.addEventListener('click', () => update(nextKind(mode), true));

  return {
    setHidden(hidden: boolean) {
      root.classList.toggle('hidden', hidden);
      root.toggleAttribute('inert', hidden);
    },
  };
}
