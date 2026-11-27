import {
  hasCount, kindLabel, MAX_COUNT, minCount, Mode, MODE_KINDS, modeName, modeOf, ModeSettings, nextCount, nextKind,
  parseSettings,
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
/** The knob turns this far for each mode. */
const KNOB_STEP = 360 / MODE_KINDS.length; // degrees

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
 * `onChange` is asked to apply each new mode and returns whether it did, so the
 * selector never shows a mode that the round didn't accept.
 */
export function createModeSelector(initial: ModeSettings, onChange: (mode: Mode) => boolean): ModeSelector {
  let settings = initial;
  let knobAngle = MODE_KINDS.indexOf(settings.kind) * KNOB_STEP;

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

  function buildCapsule(mode: Mode): HTMLElement {
    const el = document.createElement('div');
    el.className = 'mode-capsule';
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
      const count = document.createElement('button');
      count.className = 'mode-count';
      count.addEventListener('click', () => update(nextCount(settings), false));
      el.appendChild(count);
    }
    const kind = document.createElement('span');
    kind.className = 'mode-kind';
    el.appendChild(kind);
    fillCapsule(el, mode);
    return el;
  }

  /** Updates the parts of the capsule that change within a mode: the number and its noun. */
  function fillCapsule(el: HTMLElement, mode: Mode) {
    const count = el.querySelector('.mode-count');
    if (count) {
      count.textContent = String(mode.count);
      count.setAttribute('aria-label', `Number of ${mode.kind}: ${mode.count}. Tap to change.`);
    }
    el.querySelector('.mode-kind')!.textContent = kindLabel(mode);
  }

  function renderKnob() {
    dial.style.transform = `rotate(${knobAngle}deg)`;
    const mode = modeOf(settings);
    const next = modeName(nextKind(settings).kind);
    const count = hasCount(mode.kind) ? `${mode.count} ` : '';
    const into = mode.kind === 'teams' ? 'into ' : '';
    knob.setAttribute('aria-label', `Mode: ${modeName(mode.kind)} ${into}${count}${kindLabel(mode)}. Tap for ${next}.`);
  }

  function swapCapsule() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const old = capsule;
    old.classList.add('leaving');
    old.setAttribute('aria-hidden', 'true');
    old.inert = true;
    old.getAnimations().forEach(a => a.cancel());
    capsule = buildCapsule(modeOf(settings));
    slot.appendChild(capsule);
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

  function update(next: ModeSettings, kindChanged: boolean) {
    if (!onChange(modeOf(next))) return;
    settings = next;
    saveSettings(settings);
    if (kindChanged) {
      knobAngle += KNOB_STEP;
      swapCapsule();
    } else {
      fillCapsule(capsule, modeOf(settings));
    }
    renderKnob();
  }

  knob.addEventListener('click', () => update(nextKind(settings), true));

  return {
    setHidden(hidden: boolean) {
      root.classList.toggle('hidden', hidden);
      root.toggleAttribute('inert', hidden);
    },
  };
}
