import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Playwright `test`, but by default the splash page is marked as already seen, so tests
 * start in the app. Splash tests opt back in with `test.use({ splash: true })`.
 */
export const test = base.extend<{ splash: boolean }>({
  splash: [false, { option: true }],
  page: async ({ page, splash }, use) => {
    if (!splash) {
      await page.addInitScript(() => localStorage.setItem('itpicksyou.splashSeen', '1'));
    }
    await use(page);
  },
});
