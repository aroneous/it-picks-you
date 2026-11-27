import { kindLabel, Mode, nextCount, parseMode, toggleKind } from "./mode";

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

/**
 * The capsule at the top of the screen. The left half shows the number and cycles it on
 * tap. The right half switches between players and teams.
 *
 * `onChange` is asked to apply each new mode and returns whether it did, so the
 * selector never shows a mode that the round didn't accept.
 */
export function createModeSelector(initial: Mode, onChange: (mode: Mode) => boolean): ModeSelector {
  let mode = initial;

  const root = document.createElement('div');
  root.className = 'mode-selector';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'What to pick');

  const countBtn = document.createElement('button');
  countBtn.className = 'mode-count';
  const kindBtn = document.createElement('button');
  kindBtn.className = 'mode-kind';
  root.append(countBtn, kindBtn);
  document.body.appendChild(root);

  function render() {
    countBtn.textContent = String(mode.count);
    countBtn.setAttribute('aria-label', `Number of ${mode.kind}: ${mode.count}. Tap to change.`);
    kindBtn.textContent = kindLabel(mode);
    kindBtn.setAttribute(
      'aria-label',
      `Picking ${mode.kind}. Tap to pick ${mode.kind === 'players' ? 'teams' : 'players'} instead.`
    );
  }

  function update(next: Mode) {
    if (!onChange(next)) return;
    mode = next;
    saveMode(mode);
    render();
  }

  countBtn.addEventListener('click', () => update(nextCount(mode)));
  kindBtn.addEventListener('click', () => update(toggleKind(mode)));
  render();

  return {
    setHidden(hidden: boolean) {
      root.classList.toggle('hidden', hidden);
      root.toggleAttribute('inert', hidden);
    },
  };
}
