# It Picks You: developer notes

A start-player picker. Everyone puts a finger on the screen and after a short wait one of them is chosen at random. It copies the behaviour of the retired app Chwazi. It's a static, client-only PWA with no backend. In production it's served from https://itpicksyou.wily.cc/. Hosting is moving from an Apache vhost to Cloudflare Pages (see Deployment).

## Stack and commands

- TypeScript (strict) + Vite 7 + `vite-plugin-pwa` (Workbox `generateSW`). There's no UI framework: everything is drawn on a full-screen `<canvas>`, and the info button and overlay are added with plain DOM calls.
- Node version: `.nvmrc` (24). CI uses the same version.
- `npm run dev`: dev server on `0.0.0.0` over HTTPS (`vite-plugin-mkcert` makes a local cert, in serve mode only). You need HTTPS to open the dev server from a phone on the LAN, because service workers and some audio features only work in a secure context. The service worker is also turned on in dev (`devOptions.enabled`). Its output goes to `dev-dist/`, which is gitignored.
- `npm run build`: runs `tsc` (type-check only; `noEmit` is set), then `vite build`, and writes to `dist/`.
- `npm run preview`: serves `dist/` locally.
- `npm run typecheck`: `tsc` on its own. Test files are type-checked too.
- `npm test`: runs the Vitest suite once. `npm run test:watch` runs it in watch mode.

## Source layout (`src/`)

| File | Role |
|---|---|
| `index.ts` | Entry point. On `DOMContentLoaded` it checks for touch support (shows a "needs touch" message if there isn't any, but still starts the app) and calls `initializeApp()`. |
| `app.ts` | The browser side: creates the canvas, forwards touch events to a `Round`, plays sounds from the `Round` callbacks, runs the render loop, and builds the info button and overlay. |
| `round.ts` | The game rules, with no DOM, canvas or audio: which fingers are in, the decision timer, picking the winner, locking, and colour and tone assignment. The RNG and clock can be injected, so it's fully unit-tested. |
| `state.ts` | The `Node` class, one per finger. It holds position, colour, and timestamps, and works out the animation (spinning arc that fills in, pulse, and the winner's halo expanding to fill the screen). |
| `draw.ts` | Pure canvas helpers: `drawNode` (disc plus arc ring) and `drawHalo` (annulus). |
| `audio.ts` | Web Audio synth. It uses one lazily created `AudioContext` that feeds a master gain and then a compressor/limiter. `playTone` is the "finger down" blip and `playSelectedTone` is the winner and finger-up sound. Tones are picked from a fixed scale (`SCALE_SEMITONES`) relative to A440. |
| `styles.css` | Styles for the info button and overlay only. |

`public/` holds static assets that are copied as-is: the icons, the favicon, and the GitHub mark used in the overlay. The PWA manifest is generated from the `manifest` block in `vite.config.ts`. There's no static manifest file.

## How a round works (`round.ts`)

1. `touchStart`: if the round isn't locked, each new touch gets a `Node` with a colour (unique among nodes on screen where possible) and a tone index (lowest free, up to `MAX_TONES`), and `onPlace` fires. `app.ts` calls `resumeAudioContext()` on every touchstart, because the browser autoplay policy requires a user gesture.
2. Every time a finger is added or lifted, the 2 s timer (`WAIT_DECISION_TIME`) restarts as long as there are at least 2 nodes. With fewer than 2 it's cancelled. A lift before the pick fires `onLift`.
3. When the timer fires, a random node wins. The other touches move from `touches` to `lingering`, `nodes` is reduced to just the winner, the winner's `selectedTime` is set (which starts the halo animation), the round locks, and `onPick(winner)` fires.
4. While the round is locked, new touches are added to `lingering` and never become nodes. The round unlocks only once every touch has lifted: the winner, the losers, and any touch placed while locked.
5. When a touch event reports `e.touches.length === 0`, `app.ts` calls `round.noTouchesRemaining()`. That resets any leftover state, so a touchend the browser never delivered can't leave the round stuck.

Each `Node` carries its own `toneIndex`, so its place, lift and win sounds always match. `app.ts` redraws `round.nodes` on every animation frame. The ring radius is `min(width, height) / 8`.

Timing constants: `WAIT_DECISION_TIME` in `round.ts`, tone durations in `app.ts`, and animation (fill-in, rotation, pulse, halo) in `state.ts`.

## Known issues and rough edges

- The PWA has `registerType: 'autoUpdate'`, so a new deploy takes over on the next load after the service worker sees the new `sw.js`. The extra `CacheFirst` runtime cache for documents and scripts is mostly redundant with precaching, and for anything not precached it could keep stale copies for up to 90 days.
- `npm audit` reports advisories in build-time dev dependencies (Babel via Workbox, and Vitest 3). None of them reach the shipped bundle. Upgrading to Vitest 4 is the main fix.
- The touch-handling glue in `app.ts` has no automated tests. Only `round.ts`, `state.ts` and the audio maths do. Changes to `app.ts` need checking on a real touch device, or with the planned E2E tests.

## Testing

Vitest runs in the Node environment, with no DOM. Tests live next to the code as `src/*.test.ts`.

- `round.test.ts` covers the game rules with fake timers and an injected `random`/`now`. Add a test here for any change to the rules.
- `state.test.ts` covers the arc and fill maths. `audio.test.ts` covers the frequency maths.
- Keep new game logic in pure modules like `round.ts` rather than `app.ts`, so it can be tested without a browser.

Planned: Playwright E2E tests. Chromium with touch emulation can send multi-touch through CDP (`Input.dispatchTouchEvent`). That would cover the `app.ts` glue and check that the built `dist/` serves the service worker and manifest.

## CI/CD

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request: `npm ci`, `npm test`, `npm run build`, then a deploy to Cloudflare Pages with `wrangler pages deploy dist`.

- A push to `main` deploys to production. The Pages project's production branch must be `main`.
- A pull request from a branch in this repo deploys a preview, and its URL appears in the run summary. Pull requests from forks are built and tested but never deployed, because they can't see the secrets.
- The deploy step is skipped until the repository **variable** `CLOUDFLARE_PAGES_PROJECT` is set. It also needs the repository **secrets** `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit) and `CLOUDFLARE_ACCOUNT_ID`.
- Cloudflare's own Git integration is not used. GitHub Actions builds the site and uploads it ("Direct Upload"), so deploys don't count against the free plan's monthly build limit.

## Deployment

The target is Cloudflare Pages, with `itpicksyou.wily.cc` as a custom domain (a CNAME to `<project>.pages.dev`; the `wily.cc` zone doesn't need to be on Cloudflare). The Apache vhost on the shared server is the previous host and can stay as a fallback until DNS is switched.

One-time setup, done by the owner:
1. In Cloudflare, create the Pages project: `npx wrangler pages project create <name> --production-branch=main`, or Workers & Pages → Create → Pages → Direct Upload.
2. Create an API token with Cloudflare Pages: Edit. Add it and the account ID as GitHub secrets, and add the project name as the `CLOUDFLARE_PAGES_PROJECT` variable.
3. Push to `main`, then check the site at `<project>.pages.dev`.
4. Add the custom domain `itpicksyou.wily.cc` in the Pages project, then change the DNS record to the CNAME it gives you.

Caching: `public/_headers` (copied into `dist/`) tells Pages to revalidate `sw.js`, `registerSW.js`, `index.html`, `/` and `manifest.webmanifest` on every request, and to cache `assets/*` (content-hashed) as immutable. If the app is ever served from Apache again, set the same headers there. Otherwise clients can get stuck on an old version. The app needs HTTPS, because service workers require it.
