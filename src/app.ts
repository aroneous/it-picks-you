import { playScaleSelectedTone, playScaleTone, resumeAudioContext } from "./audio";
import { modeOf } from "./mode";
import { createRankActions, openDraft, RankActions } from "./draftView";
import { createModeSelector, loadSettings, ModeSelector } from "./modeSelector";
import { drawRegions } from "./regions";
import { PICK_STAGGER, PickResult, Round } from "./round";
import { showSplash } from "./splash";

const TONE_DURATION = 600; // ms
const SELECTED_TONE_DURATION = 1200; // ms
const REMOVE_TOUCH_DURATION = 100; // ms
/** The single note played when teams are picked (A440 in the scale). */
const TEAMS_PICK_TONE = 5;

const modeSettings = loadSettings();

const round = new Round({
    onPlace: node => playScaleTone(node.toneIndex, TONE_DURATION),
    onLift: node => playScaleSelectedTone(node.toneIndex, REMOVE_TOUCH_DURATION),
    onPick: playPickSound,
    mode: modeOf(modeSettings),
});

/**
 * Players: each winner's own note, one after another (lowest first) in step with its
 * region appearing. Rank: each finger's note as its rank appears, first place first.
 * Teams: one note.
 */
function playPickSound(result: PickResult) {
    if (result.kind === 'teams') {
        playScaleSelectedTone(TEAMS_PICK_TONE, SELECTED_TONE_DURATION);
        return;
    }
    const nodes = result.kind === 'players' ? result.winners : result.ranking;
    nodes.forEach((node, i) => {
        const play = () => playScaleSelectedTone(node.toneIndex, SELECTED_TONE_DURATION);
        if (i === 0) return play();
        // Skip notes still pending if everyone has already lifted and the round reset.
        setTimeout(() => round.result === result && play(), i * PICK_STAGGER);
    });
}

let selector: ModeSelector | null = null;
let rankActions: RankActions | null = null;
let infoButton: HTMLElement | null = null;
/** True while the draft screen is open (including while it fades out). */
let drafting = false;

/** The rank's Done button: fade the chips out and go back to idle. */
function finishRank() {
    round.finishRank();
}

/** The rank's Start draft button: fade the chips out under the draft screen and open it. */
function startDraft() {
    const ranking = round.finishRank();
    if (!ranking) return;
    drafting = true;
    openDraft(
        ranking.map(node => ({ rank: node.rank!, color: node.color, toneIndex: node.toneIndex })),
        {
            onTurn: player => playScaleTone(player.toneIndex, TONE_DURATION),
            onClose: () => (drafting = false),
        },
    );
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    resumeAudioContext();
    for (const t of Array.from(e.changedTouches)) {
        round.touchStart(t.identifier, t.clientX, t.clientY);
    }
}

function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
        round.touchMove(t.identifier, t.clientX, t.clientY);
    }
}

function handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
        round.touchEnd(t.identifier);
    }
    if (e.touches.length === 0) round.noTouchesRemaining();
}

function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

function step() {
    if (canvas && ctx) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        ctx.clearRect(0, 0, width, height);
        const radius = Math.min(width, height) / 8;
        if (round.result?.kind === 'players') {
            drawRegions(ctx, round.nodes, width, height, radius, performance.now());
        }
        ctx.globalAlpha = round.opacityAt(performance.now());
        for (const node of round.nodes) {
            node.draw(ctx, radius);
        }
        ctx.globalAlpha = 1;
    }
    const choosing = !drafting && round.rankSettled(performance.now());
    rankActions?.setVisible(choosing);
    // The info button sits where the rank's buttons go on narrow screens.
    infoButton?.classList.toggle('hidden', choosing);
    selector?.setHidden(!round.idle || drafting);
    requestAnimationFrame(step);
}

export function initializeApp() {
    canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.background = 'linear-gradient(#1e1f25 0%, #16161a 100%)';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    selector = createModeSelector(modeSettings, mode => round.setMode(mode));
    rankActions = createRankActions(finishRank, startDraft);
    requestAnimationFrame(step);
    // Prevent scrolling on touch
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';

    // --- Info Button and Overlay ---
    const infoBtn = document.createElement('button');
    infoBtn.className = 'info-btn';
    infoBtn.setAttribute('aria-label', 'Show info');
    infoBtn.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="13" stroke="#bbb" stroke-width="2" fill="none"/>
        <rect x="13" y="11" width="2" height="8" rx="1" fill="#bbb"/>
        <rect x="13" y="7" width="2" height="2" rx="1" fill="#bbb"/>
      </svg>
    `;
    document.body.appendChild(infoBtn);
    infoButton = infoBtn;

    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'info-overlay';
    infoOverlay.innerHTML = `
      <div class="info-bubble">
        <a class="info-github-link" href="https://github.com/aroneous/it-picks-you" target="_blank" rel="noopener" aria-label="GitHub repository">
          <img src="github-mark-white.svg" alt="GitHub" width="28" height="28" />
        </a>
        <div class="info-bubble-arrow"></div>
        <div class="info-bubble-content">
          <h2>What is this?</h2>
          <p>The eternal question: who will go first in the game? This provides the answer!
          All players lay a finger on the screen, and wait a couple of seconds. Your fate will
          be determined.</p>
          <p>Turn the knob at the top to change what it does: <strong>Choose</strong> one or
          more players, <strong>Split</strong> everyone into teams, or <strong>Rank</strong>
          everyone in order. Tap the number to change it.</p>
          <p>After a rank, <strong>Start draft</strong> takes turns picking in a fair order:
          each pick goes to whoever is furthest behind, so going first in one round means
          going later in the next.</p>
          <p><button type="button" class="info-about">About &amp; install</button></p>
        </div>
      </div>
    `;
    document.body.appendChild(infoOverlay);
    infoOverlay.style.display = 'none';

    infoBtn.addEventListener('click', () => {
      infoOverlay.style.display = 'flex';
      setTimeout(() => infoOverlay.classList.add('open'), 10);
    });
    const closeInfo = () => {
      infoOverlay.classList.remove('open');
      setTimeout(() => (infoOverlay.style.display = 'none'), 200);
    };
    infoOverlay.querySelector('.info-about')!.addEventListener('click', () => {
      closeInfo();
      showSplash();
    });
    infoOverlay.addEventListener('click', (e) => {
      if (e.target === infoOverlay) closeInfo();
    });
}
