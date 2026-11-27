import { expect, test } from '@playwright/test';
import { alphaAt, deterministic, Fingers, nextFrames } from './touch';

// Matches WAIT_DECISION_TIME in src/round.ts plus the halo expansion (HALO_EXPAND_TIME).
const PICK_DELAY = 2000;
const HALO_TIME = 500;

const A = { id: 1, x: 100, y: 200 };
const B = { id: 2, x: 300, y: 600 };
const C = { id: 3, x: 300, y: 200 };
const CORNER = { x: 5, y: 795 };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
});

test('draws a ring under each finger and clears it on lift', async ({ page }) => {
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B);
  await nextFrames(page);
  expect(await alphaAt(page, A.x, A.y)).toBe(255);
  expect(await alphaAt(page, B.x, B.y)).toBe(255);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0);

  await fingers.lift(A.id);
  await nextFrames(page);
  expect(await alphaAt(page, A.x, A.y)).toBe(0);
  expect(await alphaAt(page, B.x, B.y)).toBe(255);
});

test('picks a winner whose halo fills the screen', async ({ page }) => {
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B);
  await page.waitForTimeout(PICK_DELAY - 500);
  await nextFrames(page);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0); // no pick yet

  await expect.poll(() => alphaAt(page, CORNER.x, CORNER.y), { timeout: 500 + HALO_TIME + 2000 }).toBe(255);
});

test('a single finger is never picked', async ({ page }) => {
  const fingers = await Fingers.attach(page);
  await fingers.place(A);
  await page.waitForTimeout(PICK_DELAY + HALO_TIME + 200);
  await nextFrames(page);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0);
  expect(await alphaAt(page, A.x, A.y)).toBe(255);
});

test('stays locked until every finger has lifted', async ({ page }) => {
  // Make the first finger win so we know which one to lift.
  await deterministic(page);
  await page.reload();
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B);
  await expect.poll(() => alphaAt(page, CORNER.x, CORNER.y), { timeout: PICK_DELAY + 2000 }).toBe(255);

  await fingers.lift(A.id); // winner lifts, loser B is still down
  await nextFrames(page);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0);

  await fingers.place(C); // ignored: B hasn't lifted
  await nextFrames(page);
  expect(await alphaAt(page, C.x, C.y)).toBe(0);

  await fingers.liftAll();
  await fingers.place(C); // a fresh round
  await nextFrames(page);
  expect(await alphaAt(page, C.x, C.y)).toBe(255);
});

test('info button opens and closes the overlay', async ({ page }) => {
  const overlay = page.locator('.info-overlay');
  await expect(overlay).toBeHidden();
  await page.getByRole('button', { name: 'Show info' }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole('heading', { name: 'What is this?' })).toBeVisible();
  await overlay.click({ position: { x: 5, y: 5 } });
  await expect(overlay).toBeHidden();
});

test('serves a manifest and registers a service worker', async ({ page, request }) => {
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await (await request.get(manifestHref!)).json();
  expect(manifest).toMatchObject({ short_name: 'It Picks You', display: 'standalone' });

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(new URL('/', page.url()).href);
});
