import { playScaleTone } from "./audio";
import { Node } from "./state";

const WAIT_DECISION_TIME = 2000; // ms
const TONE_DURATION = 600; // ms

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
    const h1 = document.createElement('h1');
    h1.textContent = 'Initialized';
    canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
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