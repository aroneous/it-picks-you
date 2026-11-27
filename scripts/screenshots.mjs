// Regenerates the marketing images in public/ from the production build:
//   public/screenshot-3-players.png  the phone screenshot on the splash page
//   public/og-image.png              the link preview (Open Graph), 1200x630
// Usage: npm run screenshots   (builds first, and again after the phone screenshot)
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const PORT = 4176;
const url = `http://localhost:${PORT}/`;
let server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch();

try {
  // --- Phone screenshot: three players picked from four fingers. ---
  const phone = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await phone.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('itpicksyou.splashSeen', '1');
    localStorage.setItem('itpicksyou.mode', JSON.stringify({ kind: 'players', count: 3 }));
    // Math.random calls, in order: one color per finger placed (index into COLOR_LIST
    // = floor(r * 10): 3 orange, 5 cyan, 6 magenta, 1 blue), then the draw at the pick
    // (0 = in placement order, so the first three fingers win and blue loses).
    const seq = [0.35, 0.55, 0.65, 0.15, 0, 0, 0, 0];
    let i = 0;
    Math.random = () => (i < seq.length ? seq[i++] : 0.5);
  });
  await page.goto(url);
  await page.addStyleTag({ content: '.info-btn { display: none !important; }' });
  const cdp = await phone.newCDPSession(page);
  const fingers = [
    { id: 1, x: 112, y: 236 }, // orange
    { id: 2, x: 286, y: 420 }, // cyan
    { id: 3, x: 132, y: 640 }, // magenta
    { id: 4, x: 300, y: 740 }, // blue: not picked
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers });
  await page.waitForTimeout(2000 + 2 * 300 + 500 + 400); // pick + staggered reveals + swell + settle
  await page.screenshot({ path: 'public/screenshot-3-players.png' });
  await phone.close();

  // --- Link preview: the splash itself at 1200x630. ---
  // Rebuild so dist/ includes the new phone screenshot, then serve that.
  await server.close();
  await build({ logLevel: 'warn' });
  server = await preview({ preview: { port: PORT, strictPort: true } });
  const og = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const ogPage = await og.newPage();
  await ogPage.goto(url);
  // Fit the whole phone into the 630px-tall preview.
  await ogPage.addStyleTag({ content: '.phone { width: 236px; } .splash-footer { display: none; }' });
  await ogPage.locator('.phone img').evaluate(img => img.decode());
  await ogPage.screenshot({ path: 'public/og-image.png' });
  await og.close();
} finally {
  await browser.close();
  await server.close();
}
console.log('Wrote public/screenshot-3-players.png and public/og-image.png');
