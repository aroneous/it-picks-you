import { playScaleSelectedTone, playScaleTone } from "./audio";
import { Node } from "./state";

const WAIT_DECISION_TIME = 2000; // ms
const TONE_DURATION = 600; // ms
const SELECTED_TONE_DURATION = 1200; // ms
const REMOVE_TOUCH_DURATION = 100; // ms

let decisionTimer: number | null = null;
let decisionLocked = false;
let winnerNode: Node | null = null;

function startDecisionTimer() {
  if (decisionTimer !== null) clearTimeout(decisionTimer);
  decisionTimer = window.setTimeout(() => {
    if (nodes.length >= 2) {
      // Pick a winner randomly
      const winnerIdx = Math.floor(Math.random() * nodes.length);
      winnerNode = nodes[winnerIdx];
      // Remove all other nodes
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i] !== winnerNode) {
          // Remove from touchIdToNode as well
          for (const [id, node] of touchIdToNode.entries()) {
            if (node === nodes[i]) touchIdToNode.delete(id);
          }
          nodes.splice(i, 1);
        }
      }
      winnerNode.selectedTime = performance.now();
      playScaleSelectedTone(assignedTones.get(winnerIdx) || 0, SELECTED_TONE_DURATION);
      decisionLocked = true;
    }
    decisionTimer = null;
  }, WAIT_DECISION_TIME);
}

function resetDecisionTimerIfNeeded() {
  if (nodes.length >= 2) {
    startDecisionTimer();
  } else {
    if (decisionTimer !== null) {
      clearTimeout(decisionTimer);
      decisionTimer = null;
    }
    if (touchIdToNode.size < 1) {
      decisionLocked = false;
      winnerNode = null;
    }
  }
}

function handleTouchStart(e: TouchEvent) {
  if (decisionLocked) return;
  origHandleTouchStart(e);
  resetDecisionTimerIfNeeded();
}

function handleTouchEnd(e: TouchEvent) {
  origHandleTouchEnd(e);
  resetDecisionTimerIfNeeded();
}
const nodes: Node[] = [];
const touchIdToNode: Map<number, Node> = new Map();

const COLOR_LIST = [
    'red', 'blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'yellow', 'lime', 'pink'
];

function getAvailableColor(): string {
    // Try to keep colors unique among active nodes
    const usedColors = new Set(nodes.map(n => n.color));
    const startIdx = Math.floor(Math.random() * COLOR_LIST.length);
    for (let i = 0; i < COLOR_LIST.length; i++) {
      const color = COLOR_LIST[(startIdx + i) % COLOR_LIST.length];
      if (!usedColors.has(color)) return color;
    }
    // If all colors are used, pick randomly
    return COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

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

export function initializeApp() {
    console.log('Client application initialized');
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
    if (ctx) {
        ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    }
    // Touch event handlers
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
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

          <h2>Isn't this just Chwazi but less full-featured?</h2>
          <p>...yes, but Chwazi went away, so now you have this.</p>
        </div>
      </div>
    `;
    document.body.appendChild(infoOverlay);
    infoOverlay.style.display = 'none';

    infoBtn.addEventListener('click', () => {
      infoOverlay.style.display = 'flex';
      setTimeout(() => infoOverlay.classList.add('open'), 10);
    });
    infoOverlay.addEventListener('click', (e) => {
      if (e.target === infoOverlay) {
        infoOverlay.classList.remove('open');
        setTimeout(() => (infoOverlay.style.display = 'none'), 200);
      }
    });
}

const MAX_TONES = 10; // or set to the number of tones you support
const assignedTones: Map<number, number> = new Map(); // touchId -> toneIndex

function getAvailableToneIndex(): number {
    const used = new Set(assignedTones.values());
    for (let i = 0; i < MAX_TONES; i++) {
        if (!used.has(i)) return i;
    }
    return 0; // fallback, should not happen if MAX_TONES >= max touches
}

function origHandleTouchStart(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (!touchIdToNode.has(t.identifier)) {
            const color = getAvailableColor();
            const toneIndex = getAvailableToneIndex();
            assignedTones.set(t.identifier, toneIndex);
            const node = new Node(String(t.identifier), color, t.clientX, t.clientY);
            nodes.push(node);
            touchIdToNode.set(t.identifier, node);
            playScaleTone(toneIndex, TONE_DURATION);
        }
    }
}

function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const node = touchIdToNode.get(t.identifier);
        if (node) {
            node.x = t.clientX;
            node.y = t.clientY;
        }
    }
}

function origHandleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const node = touchIdToNode.get(t.identifier);
        if (node) {
            const idx = nodes.indexOf(node);
            if (idx !== -1) nodes.splice(idx, 1);
            touchIdToNode.delete(t.identifier);
            if (!decisionLocked) playScaleSelectedTone(assignedTones.get(t.identifier) || 0, REMOVE_TOUCH_DURATION);
        }
        assignedTones.delete(t.identifier);
    }
}

function step(timestamp: DOMHighResTimeStamp) {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    const radius = Math.min(width, height) / 8;
    
    for (const node of nodes) {
        node.draw(ctx, radius);
    }
    
    requestAnimationFrame(step);
}