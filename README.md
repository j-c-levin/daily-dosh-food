# Daily Dosh Food

A calorie/exercise ledger built on the same mental model as
[Daily Dosh](https://github.com/j-c-levin/daily-dosh): a daily calorie budget
accrues into a period balance, food logged as **debits**, exercise as
**credits**. Finish a 14-day period positive and the deficit held. Fully
static, no backend, deployed to GitHub Pages.

## Develop

```bash
npm install
npm run dev     # local dev server
npm test        # vitest
npm run check   # tsc --noEmit
```

## Deploy

Push to `main` — GitHub Actions builds and publishes to GitHub Pages.

## AI parsing

Entry text ("chicken sandwich", "30 min run") is parsed into a calorie
estimate by Claude. Bring your own Anthropic API key: paste it in Settings.
It's stored only in the browser's `localStorage` and sent only to
`api.anthropic.com` — the app has no server and no shared secret. Use a
dedicated key with a low spend limit.

Without a key (or if the call fails), entries fall back to a keyword parser
with rough default amounts, so logging never blocks on the AI path.

## More detail

- [Design spec](docs/superpowers/specs/2026-07-18-daily-dosh-food-design.md)
- [Implementation plan](docs/superpowers/plans/2026-07-18-daily-dosh-food.md)
