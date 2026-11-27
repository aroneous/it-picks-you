import { expect, test } from './fixtures';
import { alphaAt, Fingers, nextFrames } from './touch';

test.use({ splash: true });

test('is in the static HTML, for search engines and link previews', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('<h1 id="splash-title">');
  expect(html).toContain('Who goes first?');
  expect(html).toMatch(/<meta name="description" content="[^"]+">/);
  expect(html).toContain('<link rel="canonical" href="https://itpicksyou.wily.cc/">');
  expect(html).toContain('og:image');

  expect((await request.get('/robots.txt')).ok()).toBe(true);
  expect(await (await request.get('/sitemap.xml')).text()).toContain('https://itpicksyou.wily.cc/');
  for (const img of ['/og-image.png', '/screenshot-3-players.png']) {
    const res = await request.get(img);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});

test('shows on the first visit in a browser, and Start goes to the app', async ({ page }) => {
  await page.goto('/');
  const splash = page.locator('#splash');
  await expect(splash).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'It Picks You' })).toBeVisible();

  await page.getByRole('button', { name: 'Start' }).click();
  await expect(splash).toBeHidden();

  // The app is underneath and works straight away.
  const fingers = await Fingers.attach(page);
  await fingers.place({ id: 1, x: 100, y: 300 });
  await nextFrames(page);
  expect(await alphaAt(page, 100, 300)).toBe(255);
});

test('stays hidden on later visits once Start has been tapped', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('#splash')).toBeHidden();
  await page.reload();
  await expect(page.locator('#splash')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
});

test('never shows when running as an installed app', async ({ page }) => {
  // Pretend to be launched from the home screen: display-mode is standalone.
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) =>
      q.includes('display-mode: standalone') ? ({ ...real(q), matches: true } as MediaQueryList) : real(q);
  });
  await page.goto('/');
  await expect(page.locator('#splash')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('itpicksyou.splashSeen'))).toBeNull();
});

test('can be reopened from the info overlay', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('#splash')).toBeHidden();

  await page.getByRole('button', { name: 'Show info' }).click();
  await page.getByRole('button', { name: 'About & install' }).click();
  await expect(page.locator('#splash')).toBeVisible();
  await expect(page.locator('.info-overlay')).toBeHidden();
});
