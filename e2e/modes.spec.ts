import type { Page } from '@playwright/test';
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
  // While a capsule animates out it stays in the DOM, marked `leaving`.
  const capsule = (page: Page) => page.locator('.mode-capsule:not(.leaving)');

  test('starts at Choose 1 player, cycles the number, and the knob turns through the modes', async ({ page }) => {
    await page.goto('/');
    const count = capsule(page).locator('.mode-count');
    const kind = capsule(page).locator('.mode-kind');
    await expect(capsule(page)).toHaveText(/Choose\s*1\s*player$/);

    await count.click();
    await expect(count).toHaveText('2');
    await expect(kind).toHaveText('players');

    await count.click();
    await page.locator('.mode-knob').click();
    await expect(capsule(page)).toHaveText(/Split\s*into\s*2\s*teams/);

    await page.locator('.mode-knob').click();
    await expect(capsule(page)).toHaveText(/Rank\s*all players/);
    await expect(count).toHaveCount(0);

    await page.locator('.mode-knob').click();
    await expect(capsule(page)).toHaveText(/Choose\s*3\s*players/);
    // The old capsules have animated away.
    await expect(page.locator('.mode-capsule')).toHaveCount(1);
  });

  test('remembers the mode across reloads', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-knob').click();
    await expect(capsule(page)).toHaveText(/Split\s*into\s*2\s*teams/);
    await page.reload();
    await expect(capsule(page)).toHaveText(/Split\s*into\s*2\s*teams/);
  });

  test('Choose and Split keep their own numbers', async ({ page }) => {
    await page.goto('/');
    const knob = page.locator('.mode-knob');
    const count = capsule(page).locator('.mode-count');
    await count.click();
    await count.click();
    await expect(capsule(page)).toHaveText(/Choose\s*3\s*players/);
    await knob.click();
    await expect(capsule(page)).toHaveText(/Split\s*into\s*2\s*teams/);
    await count.click();
    await count.click();
    await expect(capsule(page)).toHaveText(/Split\s*into\s*4\s*teams/);
    await knob.click();
    await knob.click();
    await expect(capsule(page)).toHaveText(/Choose\s*3\s*players/);
    await page.reload();
    await knob.click();
    await expect(capsule(page)).toHaveText(/Split\s*into\s*4\s*teams/);
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

test('rank: every finger stays in its color and is ranked in turn from first place', async ({ page }) => {
  await deterministic(page, { kind: 'rank', count: 1 });
  await page.goto('/');
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B, C);

  // A point in the gap between a finger's disc and its ring (radius = 400 / 8 = 50), which a
  // ranked finger's chip fills in.
  const gap = (f: { x: number; y: number }) => alphaAt(page, f.x + 35, f.y);
  await nextFrames(page);
  expect(await gap(A)).toBe(0);

  // With random = 0 the ranking is placement order: A first, then B 0.3 s later, then C.
  await expect.poll(() => gap(A), { timeout: PICK_TIMEOUT, intervals: [20] }).toBe(255);
  expect(await gap(B)).toBe(0);
  await expect.poll(() => gap(B), { timeout: 2000, intervals: [20] }).toBe(255);
  expect(await gap(C)).toBe(0);
  await expect.poll(() => gap(C), { timeout: 2000 }).toBe(255);
  await nextFrames(page);

  // Colors are kept, and there's no background.
  expect(await rgbaAt(page, A.x, A.y)).toEqual(RED);
  expect(await rgbaAt(page, B.x, B.y)).toEqual(BLUE);
  expect(await rgbaAt(page, C.x, C.y)).toEqual(GREEN);
  expect(await alphaAt(page, CORNER.x, CORNER.y)).toBe(0);

  // The chips stay up after everyone lifts, with Done and Start draft offered.
  const actions = page.locator('.rank-actions');
  await expect(actions).toHaveClass(/hidden/);
  await fingers.liftAll();
  await expect(actions).not.toHaveClass(/hidden/);
  await page.waitForTimeout(1500);
  expect(await rgbaAt(page, A.x, A.y)).toEqual(RED);
  await expect(page.locator('.mode-selector')).toHaveClass(/hidden/);

  // Done fades the chips out and goes back to idle.
  await actions.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(actions).toHaveClass(/hidden/);
  await expect.poll(() => alphaAt(page, A.x, A.y), { timeout: 2000 }).toBe(0);
  await expect(page.locator('.mode-selector')).not.toHaveClass(/hidden/);
});

test('draft: picks follow the Thue–Morse order, building a history', async ({ page }) => {
  await deterministic(page, { kind: 'rank', count: 1 });
  await page.goto('/');
  const fingers = await Fingers.attach(page);
  await fingers.place(A, B, C);
  await expect.poll(() => alphaAt(page, C.x + 35, C.y), { timeout: PICK_TIMEOUT }).toBe(255);
  await fingers.liftAll();
  await page.locator('.rank-actions').getByRole('button', { name: 'Start draft' }).click();

  const draft = page.locator('.draft');
  const card = draft.locator('.draft-card');
  const chips = draft.locator('.draft-chip');
  await expect(draft).toBeVisible();
  await expect(card).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // first place: A, red
  await expect(card.locator('.draft-card-number')).toHaveText('1');
  await expect(chips).toHaveCount(0);

  // With three players the order is 1 2 3, 2 3 1, 3 1 2. Next and tapping the card both advance.
  await draft.getByRole('button', { name: 'Next', exact: true }).click();
  await card.click();
  await draft.getByRole('button', { name: 'Next', exact: true }).click();
  await draft.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(chips).toHaveText(['1', '2', '3', '2']);
  await expect(card.locator('.draft-card-number')).toHaveText('3');
  await expect(card).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // C, green
  await expect(chips.nth(1)).toHaveCSS('background-color', 'rgb(0, 0, 255)'); // B, blue
  // Each chip lands in place once its flight finishes.
  await expect(draft.locator('.draft-flyer')).toHaveCount(0);
  await expect(chips.last()).toBeVisible();

  // The mode selector stays hidden under the draft; Done closes it and returns to idle.
  await expect(page.locator('.mode-selector')).toHaveClass(/hidden/);
  await draft.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(draft).toHaveCount(0);
  await expect(page.locator('.mode-selector')).not.toHaveClass(/hidden/);
  expect(await alphaAt(page, A.x, A.y)).toBe(0);
});

test('the knob stays put when the mode changes', async ({ page }) => {
  await page.goto('/');
  const knob = page.locator('.mode-knob');
  const before = await knob.boundingBox();
  for (let i = 0; i < 3; i++) {
    await knob.click();
    await expect(knob).toHaveCount(1);
    expect(await knob.boundingBox()).toEqual(before);
  }
});
