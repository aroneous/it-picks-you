# It Always Picks You!

## Overview
~~A rip-off of~~ _An homage to_ the seemingly-abandoned start-player-choosing app Chwazi, packaged as a Progressive Web App. Available for use at [https://itpicksyou.wily.cc/](https://itpicksyou.wily.cc).

The name? There are inevitably accusations of cheating by some sore loser of the start-player-choosing lottery. This app is just as rigged as all the rest!

## Usage
For use on touch-enabled devices. Everybody put a finger on the screen, and wait a couple of seconds. Your fate will be determined.

Use the selector at the top of the screen to pick more than one player (the screen is split between the winners), or to split everyone into teams (each finger takes its team's color). Tap the number to change it, and tap the word to switch between players and teams.

## Feature Requests
Want something else? Let me know!

## Developing
```bash
# Clone the repository
git clone https://github.com/aroneous/it-picks-you.git
cd it-picks-you

# Install dependencies
npm install
# Run vite in dev mode (HTTPS on your LAN, so you can test on a phone)
npm run dev

# Run the tests / build for production
npm test
npm run build
```

Every push and pull request is tested and built by GitHub Actions. Pushes to `main` deploy to Cloudflare Pages, and pull requests get a preview deployment. See [CLAUDE.md](CLAUDE.md) for architecture and deployment notes.

## License
[MIT](https://opensource.org/license/mit)