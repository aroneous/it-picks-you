# It Picks You: developer notes

A start-player picker. Everyone puts a finger on the screen and after a short wait one of them is chosen at random. A selector at the top can change this to several players, or to splitting everyone into teams. It copies the behaviour of the retired app Chwazi. It's a static, client-only PWA with no backend. In production it's served from https://itpicksyou.wily.cc/ on Cloudflare Pages (see Deployment).

## Stack and commands

- TypeScript 7 (strict) + Vite 8 + `vite-plugin-pwa` 2 (Workbox `generateSW`; `workbox-build` and `workbox-window` are direct dev dependencies, as v2 requires). Vitest 4, Playwright. There's no UI framework: everything is drawn on a full-screen `<canvas>`, and the info button and overlay are added with plain DOM calls.
- Node version: `.nvmrc` (24). CI uses the same version.
- `npm run dev`: dev server on `0.0.0.0` over HTTPS (`vite-plugin-mkcert` makes a local cert, for the dev server only; `vite preview` and builds don't use it). You need HTTPS to open the dev server from a phone on the LAN, because service workers and some audio features only work in a secure context. The service worker is also turned on in dev (`devOptions.enabled`). Its output goes to `dev-dist/`, which is gitignored.
- `npm run build`: runs `tsc` (type-check only; `noEmit` is set), then `vite build`, and writes to `dist/`.
- `npm run preview`: serves `dist/` locally.
- `npm run typecheck`: `tsc` on its own. Test files, `e2e/` and `playwright.config.ts` are type-checked too. TypeScript 7 removed `moduleResolution: node`, so the project uses `Bundler`. It also no longer picks up `@types/*` packages automatically: `tsconfig.json` lists `types: ["node"]`, which Playwright's config needs for `process`.
- `npm test`: runs the Vitest suite once. `npm run test:watch` runs it in watch mode.
- `npm run test:e2e`: builds, then runs the Playwright E2E tests against `vite preview`. Run `npx playwright install chromium` once first. After a build, `npx playwright test` skips rebuilding.

## Source layout (`src/`)

| File | Role |
|---|---|
| `index.ts` | Entry point. On `DOMContentLoaded` it checks for touch support (shows a "needs touch" message if there isn't any, but still starts the app) and calls `initializeApp()`. |
| `app.ts` | The browser side: creates the canvas, forwards touch events to a `Round`, plays sounds from the `Round` callbacks, runs the render loop, and builds the info button and overlay. |
| `round.ts` | The game rules, with no DOM, canvas or audio: which fingers are in, the decision timer, the pick (players or teams), locking, and colour and tone assignment. The RNG and clock can be injected, so it's fully unit-tested. |
| `mode.ts` | Pure mode rules: `{ kind: 'players' \| 'teams', count }`, the count range (players 1–`MAX_COUNT`, teams 2–`MAX_COUNT`), cycling, labels, how many fingers a pick needs, and validating a stored mode. |
| `modeSelector.ts` | The capsule at the top (DOM). Tapping the number cycles it; tapping the word toggles players/teams. Remembers the mode in `localStorage` (`itpicksyou.mode`), hides while the round isn't idle, and only shows a mode once `Round.setMode` has accepted it. |
| `voronoi.ts` | Pure geometry: Voronoi cells as convex polygons (half-plane clipping), shrunk by an inset along shared edges, and a rounded-corner polygon path. |
| `regions.ts` | Draws the result of a multi-player pick: each winner's Voronoi region in its colour, with a gap (`BOUNDARY_WIDTH`) between regions, rounded corners (`CORNER_RADIUS`), and the colour expanding out from the winner (`HALO_EXPAND_TIME`). Regions are computed over a rect bigger than the screen so only inner boundaries show. |
| `state.ts` | The `Node` class, one per finger. It holds position, colour, tone, and timestamps, and draws the ring (spinning arc that fills in, and a pulse that freezes at the pick). |
| `draw.ts` | Pure canvas helper `drawNode` (disc plus arc ring). |
| `audio.ts` | Web Audio synth. It uses one lazily created `AudioContext` that feeds a master gain and then a compressor/limiter. `playTone` is the "finger down" blip and `playSelectedTone` is the winner and finger-up sound. Tones are picked from a fixed scale (`SCALE_SEMITONES`) relative to A440. |
| `styles.css` | Styles for the info button and overlay only. |

`public/` holds static assets that are copied as-is: the icons, the favicon, and the GitHub mark used in the overlay. The PWA manifest is generated from the `manifest` block in `vite.config.ts`. There's no static manifest file.

## How a round works (`round.ts`)

1. `touchStart`: if the round isn't locked, each new touch gets a `Node` with a colour (unique among nodes on screen where possible) and a tone index (lowest free, up to `MAX_TONES`), and `onPlace` fires. `app.ts` calls `resumeAudioContext()` on every touchstart, because the browser autoplay policy requires a user gesture.
2. Every time a finger is added or lifted, the 2 s timer (`WAIT_DECISION_TIME`) restarts as long as there are more fingers than the mode's count (`fingersNeeded`: 2 for one player, 4 for three teams). With fewer it's cancelled. A lift before the pick fires `onLift`.
3. When the timer fires, the fingers are put in random order (`draw()`: each drawn uniformly from those left; a random source that always returns 0 keeps the original order, which the tests rely on). Then:
   - **players**: the first `count` win. Everyone else moves from `touches` to `lingering` and disappears.
   - **teams**: everyone stays. Fingers are dealt into `count` teams in turn (sizes differ by at most one), and each team's nodes take a colour from `TEAM_COLORS`, a distinct-looking subset of `COLOR_LIST`, in random order.
   Every kept node gets `selectedTime`, the round locks, `result` is set, and `onPick(result)` fires.
4. While the round is locked, new touches are added to `lingering` and never become nodes. The round unlocks only once every touch has lifted, kept or not, and including any placed while locked.
5. When a touch event reports `e.touches.length === 0`, `app.ts` calls `round.noTouchesRemaining()`. That resets any leftover state, so a touchend the browser never delivered can't leave the round stuck.

`setMode` only works while the round is `idle` (no fingers down, not locked); the selector is hidden otherwise.

`app.ts` draws `regions.ts` under the nodes when the result is `players` (one region per remaining winner, recomputed every frame so regions follow moving fingers; with one winner that's a full-screen halo). Teams have no background. Pick sounds: each winner's own note for players; one note per team for teams. The ring radius is `min(width, height) / 8`.

Timing constants: `WAIT_DECISION_TIME` in `round.ts`, tone durations in `app.ts`, ring animation in `state.ts`, region animation and styling in `regions.ts`.

## Known issues and rough edges

- The PWA has `registerType: 'autoUpdate'`, so a new deploy takes over on the next load after the service worker sees the new `sw.js`. The extra `CacheFirst` runtime cache for documents and scripts is mostly redundant with precaching, and for anything not precached it could keep stale copies for up to 90 days.
- `npm audit` reports 4 moderate advisories, all in `minimatch` via `workbox-build`. They only affect the build and don't reach the shipped bundle. The only fix npm offers is downgrading `workbox-build`, so leave them until Workbox updates its dependency.
- The E2E tests run only in Chromium. Safari on iOS is the most likely place for touch or audio differences, so check changes to `app.ts` or `audio.ts` on an iPhone or iPad too.

## Testing

**Unit tests (Vitest)** run in the Node environment, with no DOM. They live next to the code as `src/*.test.ts`.

- `round.test.ts` covers the game rules with fake timers and an injected `random`/`now`. Add a test here for any change to the rules.
- `mode.test.ts` covers the selector rules. `voronoi.test.ts` covers the cell geometry (areas, insets, containment). `state.test.ts` covers the arc and fill maths. `audio.test.ts` covers the frequency maths.
- Keep new game logic in pure modules like `round.ts` rather than `app.ts`, so it can be tested without a browser.

**E2E tests (Playwright, `e2e/`)** run headless Chromium with touch emulation against the production build. They cover the `app.ts` glue (touch events → `Round` → canvas), the mode selector, multi-player regions and team colours (`modes.spec.ts`), the info overlay, and the manifest and service worker.

- Multi-touch: `e2e/touch.ts` has a `Fingers` helper built on CDP `Input.dispatchTouchEvent`, because Playwright's `touchscreen` only taps. `touchStart` sends every finger that's down; `touchEnd` lists the fingers being lifted. Don't release fingers by sending a `touchMove` without them: Chromium holds that touchend back until the next input event.
- Assertions read canvas pixels with `alphaAt(x, y)`: alpha 0 means nothing is drawn there. The background is a CSS gradient, not drawn on the canvas. A ring is opaque at its finger's position, and after a pick the winner's halo fills the screen, so a corner pixel becomes opaque.
- To make a test deterministic, call `deterministic(page, mode?)` from `e2e/touch.ts` before `page.goto` (or before a reload). It makes `Math.random` return 0, so the first fingers win, colours come in `COLOR_LIST`/`TEAM_COLORS` order, and teams are dealt in turn. It can also store a mode. `Round` keeps its own reference to `Math.random` when it's created, so overriding it after the page loads has no effect. `rgbaAt` reads a pixel's colour for checks like "this finger turned red".
- Wait for state changes with `expect.poll(...)`, not fixed timeouts, except when checking that something *doesn't* happen.

## CI/CD

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request: `npm ci`, `npm test`, `npm run build`, then the Playwright E2E tests. If those fail, it uploads the traces as an artifact (open them with `npx playwright show-trace`). Finally it deploys to Cloudflare Pages with `wrangler pages deploy dist`. Nothing deploys unless every test passes.

- A push to `main` deploys to production. The Pages project's production branch must be `main`.
- A pull request from a branch in this repo deploys a preview, and its URL appears in the run summary. Pull requests from forks are built and tested but never deployed, because they can't see the secrets.
- The deploy step is skipped until the repository **variable** `CLOUDFLARE_PAGES_PROJECT` is set. It also needs the repository **secrets** `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit) and `CLOUDFLARE_ACCOUNT_ID`.
- Dependabot (`.github/dependabot.yml`) opens weekly PRs: one grouped PR for npm minor and patch updates, separate PRs for npm majors, and one for GitHub Actions. It ignores major updates to `@types/node`, which tracks the Node major in `.nvmrc`; bump both together by hand. CI runs every Dependabot PR through the full test suite and deploys a preview.
- Cloudflare's own Git integration is not used. GitHub Actions builds the site and uploads it ("Direct Upload"), so deploys don't count against the free plan's monthly build limit.

## Deployment

Production is the Cloudflare Pages project `it-picks-you` (https://it-picks-you.pages.dev), with `itpicksyou.wily.cc` as its custom domain. DNS for `wily.cc` stays at DigitalOcean: `itpicksyou` is a CNAME to `it-picks-you.pages.dev` (TTL 12 h), and Cloudflare issues the TLS certificate. Moving the zone to Cloudflare isn't needed for a subdomain. The site used to be served by an Apache vhost on the shared `wily.cc` server. That vhost is no longer in the request path.

Deploys are automatic (see CI/CD). There's no manual deploy step. To roll back, open the project in the Cloudflare dashboard → Deployments, and use "Rollback" on an earlier production deployment. Alternatively, revert the commit on `main`.

GitHub configuration that the workflow depends on:
- Variable `CLOUDFLARE_PAGES_PROJECT` = `it-picks-you`. This is the project name, not the `.pages.dev` hostname.
- Secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Account → Cloudflare Pages → Edit on the right account. A token without that permission fails with `Authentication error [code: 10000]`.
- Secret `CLOUDFLARE_ACCOUNT_ID`.

The Pages project uses Direct Upload, with production branch `main`. It must stay that way: a Direct Upload project can't be switched to Cloudflare's Git integration, and Cloudflare's own builds aren't wanted here.

Caching: `public/_headers` (copied into `dist/`) tells Pages to revalidate `sw.js`, `registerSW.js`, `index.html`, `/` and `manifest.webmanifest` on every request, and to cache `assets/*` (content-hashed) as immutable. If the app is ever served from Apache again, set the same headers there. Otherwise clients can get stuck on an old version. The app needs HTTPS, because service workers require it.
