import type { CDPSession, Page } from '@playwright/test';

export interface Point {
  id: number;
  x: number;
  y: number;
}

/**
 * Multi-touch driver using the Chrome DevTools Protocol. Playwright's own touchscreen
 * API only supports single taps, so this sends `Input.dispatchTouchEvent`. A touchStart
 * carries every finger currently down; Chromium fires touchstart for the new ones.
 */
export class Fingers {
  private readonly down = new Map<number, Point>();

  private constructor(private readonly cdp: CDPSession) {}

  static async attach(page: Page): Promise<Fingers> {
    return new Fingers(await page.context().newCDPSession(page));
  }

  async place(...points: Point[]): Promise<void> {
    for (const p of points) this.down.set(p.id, p);
    await this.send('touchStart');
  }

  async lift(...ids: number[]): Promise<void> {
    const lifted = ids.map(id => this.down.get(id)).filter((p): p is Point => !!p);
    for (const p of lifted) this.down.delete(p.id);
    // touchEnd releases the listed fingers (or all of them when the list is empty).
    // Releasing by sending a touchMove without them also works, but Chromium holds
    // that touchend back until the next input event.
    await this.send('touchEnd', lifted);
  }

  async liftAll(): Promise<void> {
    this.down.clear();
    await this.send('touchEnd', []);
  }

  private async send(type: 'touchStart' | 'touchEnd', points = [...this.down.values()]): Promise<void> {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(p => ({ id: p.id, x: p.x, y: p.y })),
    });
  }
}

/** Alpha of the canvas pixel at a CSS-pixel position. 0 means nothing is drawn there. */
export async function alphaAt(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(([x, y]) => {
    const canvas = document.querySelector('canvas')!;
    const dpr = canvas.width / canvas.clientWidth;
    const ctx = canvas.getContext('2d')!;
    return ctx.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data[3];
  }, [x, y] as const);
}

/** Wait for the next couple of animation frames so the canvas reflects the latest state. */
export async function nextFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
}

/** RGBA of the canvas pixel at a CSS-pixel position. */
export async function rgbaAt(page: Page, x: number, y: number): Promise<[number, number, number, number]> {
  return page.evaluate(([x, y]) => {
    const canvas = document.querySelector('canvas')!;
    const dpr = canvas.width / canvas.clientWidth;
    const d = canvas.getContext('2d')!.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data;
    return [d[0], d[1], d[2], d[3]] as [number, number, number, number];
  }, [x, y] as const);
}

/**
 * Sets up the page before the app loads: `Math.random` always returning 0 (so the first
 * finger wins, colors are assigned in COLOR_LIST order, and teams are dealt in turn),
 * and optionally a stored mode. Call before `page.goto`/`page.reload`.
 */
export async function deterministic(page: Page, mode?: { kind: 'players' | 'teams'; count: number }): Promise<void> {
  await page.addInitScript(m => {
    Math.random = () => 0;
    if (m) localStorage.setItem('itpicksyou.mode', JSON.stringify(m));
  }, mode);
}
