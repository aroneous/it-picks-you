import { drawNode } from "./draw";
import { Node } from "./state";

const nodes:Node[] = [];

export function initializeApp() {
    console.log('Client application initialized');
    const h1 = document.createElement('h1');
    h1.textContent = 'Initialized';
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // const cm = 37.7952755906;
    const radius = Math.min(width, height) / 8;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const node = new Node('1', 'red', width / 2, height / 2);
        nodes.push(node);
        // node.draw(ctx, radius);
        // drawNode(ctx, width / 2, height / 2, radius, 'blue',
        //   Math.random() * 2 * Math.PI,
        //   Math.random() * 2 * Math.PI);
    }
    
    requestAnimationFrame(step);
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