import { expect, test } from './fixtures';
import { alphaAt, deterministic, Fingers, nextFrames, rgbaAt } from './touch';

const PICK_TIMEOUT = 2000 + 500 + 2000; // WAIT_DECISION_TIME + HALO_EXPAND_TIME + slack

const A = { id: 1, x: 100, y: 200 };
const B = { id: 2, x: 300, y: 600 };
const C = { id: 3, x: 300, y: 200 };
const CORNER = { x: 5, y: 795 };

// The first entries of COLOR_LIST (finger colors) and TEAM_COLORS, which `deterministic`
// makes the assignment order.
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const GREEN = [0, 128, 0, 255];

test.describe('mode selector', () => {
  test('starts at 1 player, cycles the number and switches to teams', async ({ page }) => {
    await page.goto('/');
    const count = page.locator('.mode-count');
    const kind = page.locator('.mode-kind');
    await expect(count).toHaveText('1');
    await expect(kind).toHaveText('player');

    await count.click();
    await expect(count).toHaveText('2');
    await expect(kind).toHaveText('players');

    await count.click();
    await kind.click();
    await expect(count).toHaveText('3');
    await expect(kind).toHaveText('teams');
  });

  test('remembers the mode across reloads', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-kind').click();
    await expect(page.locator('.mode-count')).toHaveText('2');
    await page.reload();
    await expect(page.locator('.mode-count')).toHaveText('2');
    await expect(page.locator('.mode-kind')).toHaveText('teams');
  });

  test('hides while fingers are on the screen', async ({ page }) => {
    await page.goto('/');
    const selector = page.locator('.mode-selector');
    const fingers = await Fingers.attach(page);
    await fingers.place(A);
    await expect(selector).toHaveClass(/hidden/);
    await fingers.liftAll();
    await expect(selector).not.toHaveClass(/hidden/);
  });
});

test('two players: each winner gets a region, with a gap along the boundary', async ({ page }) => {
  await deterministic(page, { kind: 'players', count: 2 });
  await page.goto('/');
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B, C);

  // Winners are revealed lowest tone first: A (placed first), then B PICK_STAGGER (0.3 s) later.
  // As soon as A's region reaches C's spot, B's region (the corner) is still empty.
  // Poll quickly: the default back-off (up to 1 s between polls) can overshoot the 0.3 s window.
  await expect.poll(() => rgbaAt(page, C.x, C.y), { timeout: PICK_TIMEOUT, intervals: [20] }).toEqual(RED);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0);
  await expect.poll(() => alphaAt(page, CORNER.x, CORNER.y), { timeout: 2000 }).toBe(255);
  await nextFrames(page);

  // A and B win. C is gone, and its spot is in A's (red) region, being closer to A.
  expect(await rgbaAt(page, C.x, C.y)).toEqual(RED);
  // The bottom-left corner is closer to B (blue).
  expect(await rgbaAt(page, CORNER.x, CORNER.y)).toEqual(BLUE);
  // Halfway between A and B is on the boundary, which is left as a gap.
  expect(await alphaAt(page, (A.x + B.x) / 2, (A.y + B.y) / 2)).toBe(0);
});

test('teams: every finger stays and takes its team color, with no background', async ({ page }) => {
  await deterministic(page, { kind: 'teams', count: 2 });
  await page.goto('/');
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B, C);
  await nextFrames(page);
  expect(await rgbaAt(page, C.x, C.y)).toEqual(GREEN);

  // Dealt in turn: A and C on team 1 (red), B on team 2 (blue).
  await expect.poll(() => rgbaAt(page, C.x, C.y), { timeout: PICK_TIMEOUT }).toEqual(RED);
  expect(await rgbaAt(page, A.x, A.y)).toEqual(RED);
  expect(await rgbaAt(page, B.x, B.y)).toEqual(BLUE);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0);

  // Still locked until everyone lifts.
  await fingers.lift(A.id, B.id);
  await nextFrames(page);
  expect(await rgbaAt(page, C.x, C.y)).toEqual(RED);
  await expect(page.locator('.mode-selector')).toHaveClass(/hidden/);
  await fingers.liftAll();
  await expect(page.locator('.mode-selector')).not.toHaveClass(/hidden/);
});
