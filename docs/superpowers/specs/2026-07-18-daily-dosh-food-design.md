# Daily Dosh Food — v1 Design

Date: 2026-07-18. Status: approved by Joshua (brainstorm session).

A calorie/exercise ledger built on the same mental model as the real Daily Dosh
budgeting app (github.com/j-c-levin/daily-dosh): a daily calorie budget accrues
into a period balance; food logged as **debits**, exercise as **credits**;
finishing a period positive means the deficit held. Deployed as a fully static
site to **GitHub Pages** — no backend, no server-held secrets.

Reference material in `docs/reference/`:
- `original-spec.md` — the source product spec (mechanics, screens, palette).
- `mockup.jsx` — working React mockup. **Directional inspiration, not a pixel
  contract.** Follow its visual language (dark theme, palette, type, layout
  hierarchy) but improve freely where the spec or good judgment says so.

## Decisions made during brainstorming

| Topic | Decision |
| --- | --- |
| Repo | New repo `daily-dosh-food` (local `~/Code/daily-dosh-food`), GitHub Pages via Actions |
| Stack | React 18 + TypeScript (strict) + Vite. Chosen for AI-agent feedback loops: deepest training-data familiarity, mockup already React, `tsc` + Vitest as fast machine-readable iteration signals |
| AI auth | **Bring-your-own-key**: user pastes their Anthropic API key in Settings; stored only in localStorage; browser calls `api.anthropic.com` directly (officially supported CORS mode). No shared secret exists, so nothing for strangers to abuse |
| AI model | Deferred — model id is a Settings value (placeholder default `claude-haiku-4-5` on value-for-money grounds). A future eval harness with labeled entries will pick the winner. Out of v1 scope |
| Persistence | localStorage only, versioned key, JSON export/import for backup |
| Onboarding | Mifflin-St Jeor "calculate it for me" is the default path; direct TDEE entry is the optional override |
| Periods | Biweekly (14 days), anchored to onboarding date; independent of payday |

## Core mechanics (unchanged from original spec)

1. Budget/day = TDEE − target deficit (both set at onboarding, editable in Settings).
2. Each elapsed day of the current period adds `budgetPerDay` to the running balance.
3. Balance = accrued budget − Σ debits + Σ credits.
4. Period end: outcome sealed as a **stamp** (`positive` / `negative`).
   Rollover is computed lazily on app load — seal every fully elapsed period,
   start the current one. Multiple missed periods seal correctly in sequence.
5. A negative stamp flanked by positive neighbours gets a recovery caption
   ("the dip didn't spread"), per original spec.
6. Settings changes (TDEE/deficit) apply go-forward: `budgetPerDay` is snapshotted
   onto each Period at creation; past and current periods keep their value.

## Data model

```ts
type EntryType = "credit" | "debit";

interface Entry {
  id: string;              // crypto.randomUUID()
  label: string;
  type: EntryType;
  amount: number;          // kcal, positive integer
  date: string;            // ISO yyyy-mm-dd (local)
  source: "ai" | "manual" | "fallback";
}

interface Period {
  id: string;
  startDate: string;       // ISO, inclusive
  endDate: string;         // ISO, inclusive (start + 13 days)
  budgetPerDay: number;    // snapshot at period creation
  entries: Entry[];
  outcome?: "positive" | "negative";  // set when sealed
}

interface UserStats { sex: "male" | "female"; age: number; heightCm: number; weightKg: number; }

interface Settings {
  tdee: number;
  deficit: number;
  stats?: UserStats;       // present when Mifflin path used; feeds AI prompt
  anchorDate: string;      // onboarding date, defines period grid
  periodLengthDays: 14;
  apiKey?: string;         // Anthropic key, BYO
  model: string;           // default "claude-haiku-4-5"
}

interface AppState { settings?: Settings; periods: Period[]; schemaVersion: 1; }
```

Persisted under `localStorage["daily-dosh-food:v1"]`. Unknown/older schema →
migrate or reset with export offered.

## Module layout

```
src/
  lib/
    types.ts        // shapes above
    tdee.ts         // Mifflin-St Jeor: 10w + 6.25h − 5a + s (s: +5 male / −161 female)
                    // × activity multiplier (sedentary 1.2 … very active 1.9)
    period.ts       // PURE functions: accruedBudget, balance, paceLine,
                    // prediction, rolloverPeriods(state, today), stampCaptions
    store.ts        // load/save/migrate localStorage; React hook (useAppState);
                    // export/import JSON
    ai.ts           // parseEntry(text, settings): Anthropic call + fallback parser
  components/       // Sparkline, StatBox, EntryList, EntryRow, Composer,
                    // EditSheet, StampStrip, Toast
  screens/          // Onboarding, Dashboard, Stamps, Settings
  App.tsx           // route between screens (tiny state router; no react-router)
  theme.ts          // palette + type constants from the spec
```

All ledger maths are pure functions taking explicit `today: string` — never
`new Date()` inside `lib/` — so tests control time.

## Screens

Per original spec §Screens, with these clarifications:
- **Onboarding**: Mifflin-St Jeor form (sex, age, height, weight, activity) →
  shows computed TDEE → user sets deficit (default 500) → "or enter TDEE
  directly" collapsible override. Finishing stamps `anchorDate` = today.
- **Dashboard**: header (name + "Stamps →"), big mono balance (green `#3DDC97`
  positive / rust `#E07856` negative), pace + prediction lines, sparkline of
  daily balance over current period, three-stat row (period budget / consumed /
  earned back), entries list (tap → EditSheet), floating "+ Add something".
- **Composer**: single free-text input; on submit entry appears immediately
  (optimistic, from AI or fallback); no confirmation step.
- **EditSheet**: bottom sheet — description, debit/credit toggle, kcal, Delete
  (outlined, destructive) + Save (filled).
- **Stamps**: horizontal strip of sealed periods as ink-stamps ("IN CREDIT" /
  "OVERDRAWN", slight rotation), recovery captions.
- **Settings**: TDEE/deficit (with Mifflin recalc), stats, API key (password
  field + "test key" button), model id, export/import JSON, danger-zone reset.

Visual system: background `#0B0D10`, cards `#14171C`, borders `#2A2F37`, text
`#EDEFF2`/`#8A9099`, dividers `#22262D`; Inter for UI, IBM Plex Mono for all
numerals; 14–16px radii; bottom sheets not dialogs. Amber (`#E07856`) not
alarm-red for negative, deliberately.

## AI parse call

- `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true` (correct here: the
  key is the user's own, never embedded in the site).
- Structured outputs: `output_config.format` = `json_schema` with
  `{label: string, type: "credit"|"debit", amount: number}` — guaranteed shape,
  no JSON-repair path needed.
- Prompt (system): estimate calories for the logged item for a person with the
  user's stats (when present); decide eaten (debit) vs exercise (credit).
  `max_tokens` small (~200).
- Model id from Settings (`settings.model`).
- **Fallback parser** (`source: "fallback"`): keyword exercise-word list +
  rough default amounts, used when no key is set, the call errors, or it
  returns a refusal. Fallback entries show an "estimate — tap to edit" caption.
- Errors surface as a toast; the entry still lands (fallback), editing fixes it.
- Never block ledger maths on the AI path.

### Security posture
- Key lives only in `localStorage`; sent only to `api.anthropic.com`.
- Settings copy advises creating a dedicated key with a low spend limit.
- No analytics, no third-party requests, CSP-friendly static site.

## Testing & CI (the agent feedback loop)

- `npm run check` → `tsc --noEmit`.
- `npm test` → Vitest: unit tests for `period.ts` (accrual, rollover incl.
  multi-period gaps, pace/prediction, recovery captions), `tdee.ts` (known
  Mifflin values), fallback parser; Testing Library for Composer + EditSheet
  flows and onboarding happy path. `ai.ts` network calls mocked.
- `.github/workflows/ci.yml`: check + test on PRs and main.
- `.github/workflows/deploy.yml`: on push to main — build (Vite
  `base: "/daily-dosh-food/"`) → `actions/upload-pages-artifact` →
  `actions/deploy-pages`.

## Out of scope for v1 (explicitly deferred)

- Model eval harness (labeled entry set, head-to-head model comparison) — the
  mechanism that will replace the placeholder default model.
- Apple Health / calorie-app integrations; photo/barcode logging.
- Any backend, sync, or auth beyond BYO key.
- PWA/offline manifest (nice-to-have follow-up; localStorage already works
  offline once loaded).
