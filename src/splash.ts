import { resumeAudioContext } from "./audio";

/**
 * The welcome page in index.html. Whether it starts visible is decided by an inline
 * script in <head> (hidden when installed or already seen), so it never flashes up.
 * This module only handles leaving and re-opening it.
 */
export const SPLASH_SEEN_KEY = 'itpicksyou.splashSeen';
const HIDDEN_CLASS = 'no-splash';
const LEAVE_MS = 250;

function root(): HTMLElement {
  return document.documentElement;
}

export function initSplash(): void {
  document.getElementById('splash-start')?.addEventListener('click', hideSplash);
}

function hideSplash(): void {
  // Starting is a user gesture: a good moment to unlock audio, especially on iOS.
  resumeAudioContext();
  try {
    localStorage.setItem(SPLASH_SEEN_KEY, '1');
  } catch {
    // Can't remember it (private browsing etc.): the splash will show again next visit.
  }
  root().classList.add('splash-leaving');
  setTimeout(() => {
    root().classList.add(HIDDEN_CLASS);
    root().classList.remove('splash-leaving');
  }, LEAVE_MS);
}

/** Shows the splash again, e.g. from the info overlay. */
export function showSplash(): void {
  root().classList.remove(HIDDEN_CLASS);
  document.getElementById('splash')?.scrollTo(0, 0);
  document.getElementById('splash-start')?.focus();
}
