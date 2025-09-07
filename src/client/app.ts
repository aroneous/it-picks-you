import { drawNode } from "./draw";

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

    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawNode(ctx, width / 2, height / 2, 'blue',
          Math.random() * 2 * Math.PI,
          Math.random() * 2 * Math.PI);
    }
}