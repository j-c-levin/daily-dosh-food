# Daily Dosh Food v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static React+TS calorie/exercise ledger (Daily Dosh mental model) deployed to GitHub Pages, with BYO-Anthropic-key AI entry parsing and localStorage persistence.

**Architecture:** Pure-function ledger core (`src/lib/`) with all maths taking explicit `today` strings; thin inline-styled React screens copied stylistically from `docs/reference/mockup.jsx`; a single AI module that falls back to a keyword parser. No backend anywhere.

**Tech Stack:** React 18, TypeScript (strict), Vite, Vitest + @testing-library/react + jsdom, @anthropic-ai/sdk (browser mode), GitHub Actions → GitHub Pages.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-daily-dosh-food-design.md`. The mockup (`docs/reference/mockup.jsx`) is **directional inspiration, not a pixel contract** — match its visual language via `src/theme.ts`, improve freely.
- Palette/type exactly as spec: bg `#0B0D10`, card `#14171C`, border `#2A2F37`, text `#EDEFF2`, muted `#8A9099`, positive `#3DDC97`, negative `#E07856`, divider `#22262D`; Inter (UI) + IBM Plex Mono (all numerals).
- `src/lib/` never calls `new Date()` — every function takes `today: string` (ISO `yyyy-mm-dd`). Only `todayISO()` touches the clock, and callers pass its result down.
- localStorage key: `daily-dosh-food:v1`. Default model id: `claude-haiku-4-5`. Period length: 14 days.
- Vite `base: "/daily-dosh-food/"`. Node 20+.
- Feedback loop commands (must pass at the end of every task): `npm run check` (tsc), `npm test` (vitest run), `npm run build`.
- Commit after every green task with a conventional message.

**Dependency groups (parallelism guide):**
- Group A: Task 1 (everything depends on it)
- Group B (parallel after 1): Tasks 2, 3, 4
- Group C (after 3): Task 5
- Group D (parallel after 5): Tasks 6, 7, 8, 9
- Group E: Task 10 (after 6–9), Task 11 (after 10)

---

### Task 1: Scaffold, theme, types, CI/deploy workflows

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder), `src/theme.ts`, `src/lib/types.ts`, `src/vite-env.d.ts`, `.gitignore`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `src/lib/types.test.ts`

**Interfaces:**
- Produces: every type in `src/lib/types.ts` below (all later tasks import from it); `src/theme.ts` exports `colors`, `mono`, `cardStyle`, `inputStyle`, `buttonPrimary`, `buttonGhost`, `labelStyle`.

- [ ] **Step 1: Scaffold Vite project**

```bash
cd ~/Code/daily-dosh-food
npm create vite@latest . -- --template react-ts   # answer "Ignore files and continue" if prompted
npm install
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Configure**

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/daily-dosh-food/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
  },
});
```

`src/test-setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts: `"check": "tsc --noEmit -p tsconfig.app.json", "test": "vitest run", "test:watch": "vitest"`. Ensure `tsconfig.app.json` has `"strict": true` and add `"types": ["vitest/globals"]` to its compilerOptions.

`index.html` — set `<title>Daily Dosh Food</title>`, `<meta name="theme-color" content="#0B0D10">` and in `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Delete Vite demo files (`src/App.css`, `src/index.css`, `src/assets/`), strip their imports. `src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

document.body.style.margin = "0";
document.body.style.background = "#0B0D10";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

Placeholder `src/App.tsx` (replaced in Task 10):
```tsx
export default function App() {
  return <div style={{ color: "#EDEFF2", fontFamily: "Inter, sans-serif", padding: 24 }}>Daily Dosh Food</div>;
}
```

- [ ] **Step 3: Write `src/theme.ts`**

```ts
import type { CSSProperties } from "react";

export const colors = {
  bg: "#0B0D10",
  card: "#14171C",
  border: "#2A2F37",
  text: "#EDEFF2",
  muted: "#8A9099",
  faint: "#6B7280",
  positive: "#3DDC97",
  negative: "#E07856",
  divider: "#22262D",
  inputBorder: "#3A3F47",
} as const;

export const mono = "'IBM Plex Mono', monospace";
export const sans = "'Inter', sans-serif";

export const cardStyle: CSSProperties = { background: colors.card, borderRadius: 16 };

export const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: colors.bg,
  border: `1px solid ${colors.inputBorder}`, borderRadius: 8,
  padding: "10px 12px", color: colors.text, fontSize: 14, outline: "none",
};

export const labelStyle: CSSProperties = { fontSize: 12, color: colors.muted };

export const buttonPrimary: CSSProperties = {
  background: colors.positive, border: "none", color: colors.bg,
  borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

export const buttonGhost: CSSProperties = {
  background: "none", border: `1px solid ${colors.inputBorder}`, color: colors.muted,
  borderRadius: 8, padding: "12px 0", fontSize: 14, cursor: "pointer",
};
```

- [ ] **Step 4: Write `src/lib/types.ts`**

```ts
export type EntryType = "credit" | "debit";
export type EntrySource = "ai" | "manual" | "fallback";

export interface Entry {
  id: string;
  label: string;
  type: EntryType;
  amount: number;        // kcal, positive integer
  date: string;          // ISO yyyy-mm-dd (local)
  source: EntrySource;
}

export interface Period {
  id: string;
  startDate: string;     // inclusive
  endDate: string;       // inclusive (start + 13 for 14-day periods)
  budgetPerDay: number;  // snapshot at period creation
  entries: Entry[];
  outcome?: "positive" | "negative"; // set when sealed
}

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface UserStats {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
}

export interface Settings {
  tdee: number;
  deficit: number;
  stats?: UserStats;       // present when Mifflin path used; feeds AI prompt
  anchorDate: string;      // onboarding date; defines the period grid
  periodLengthDays: number; // 14
  apiKey?: string;
  model: string;           // default "claude-haiku-4-5"
}

export const DEFAULT_MODEL = "claude-haiku-4-5";
export const PERIOD_LENGTH_DAYS = 14;
export const STORAGE_KEY = "daily-dosh-food:v1";

export interface AppState {
  schemaVersion: 1;
  settings?: Settings;
  periods: Period[];
}

export const emptyState = (): AppState => ({ schemaVersion: 1, periods: [] });
```

- [ ] **Step 5: Smoke test** — `src/lib/types.test.ts`:

```ts
import { emptyState, DEFAULT_MODEL } from "./types";

test("emptyState shape", () => {
  expect(emptyState()).toEqual({ schemaVersion: 1, periods: [] });
  expect(DEFAULT_MODEL).toBe("claude-haiku-4-5");
});
```

Run: `npm run check && npm test && npm run build` — all pass.

- [ ] **Step 6: Workflows**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
```

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: scaffold React+TS+Vite app with theme, types, CI and Pages deploy"`

---

### Task 2: `src/lib/tdee.ts` — Mifflin-St Jeor

**Files:**
- Create: `src/lib/tdee.ts`, `src/lib/tdee.test.ts`

**Interfaces:**
- Consumes: `UserStats`, `Activity` from `./types`.
- Produces: `bmr(stats: UserStats): number`, `tdee(stats: UserStats): number` (rounded), `ACTIVITY_MULTIPLIERS: Record<Activity, number>`, `ACTIVITY_LABELS: Record<Activity, string>`.

- [ ] **Step 1: Failing tests** — `src/lib/tdee.test.ts`:

```ts
import { bmr, tdee } from "./tdee";
import type { UserStats } from "./types";

const male: UserStats = { sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "sedentary" };
const female: UserStats = { sex: "female", age: 25, heightCm: 165, weightKg: 60, activity: "moderate" };

test("bmr: Mifflin-St Jeor", () => {
  expect(bmr(male)).toBe(1780);        // 800 + 1125 − 150 + 5
  expect(bmr(female)).toBeCloseTo(1345.25); // 600 + 1031.25 − 125 − 161
});

test("tdee applies activity multiplier and rounds", () => {
  expect(tdee(male)).toBe(2136);   // 1780 × 1.2
  expect(tdee(female)).toBe(2085); // 1345.25 × 1.55 = 2085.1375
});
```

- [ ] **Step 2: Run** `npm test -- tdee` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/tdee.ts`:

```ts
import type { Activity, UserStats } from "./types";

export const ACTIVITY_MULTIPLIERS: Record<Activity, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: "Sedentary (little exercise)",
  light: "Lightly active (1–3 days/week)",
  moderate: "Moderately active (3–5 days/week)",
  active: "Active (6–7 days/week)",
  very_active: "Very active (physical job)",
};

export function bmr(stats: UserStats): number {
  const sexTerm = stats.sex === "male" ? 5 : -161;
  return 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age + sexTerm;
}

export function tdee(stats: UserStats): number {
  return Math.round(bmr(stats) * ACTIVITY_MULTIPLIERS[stats.activity]);
}
```

- [ ] **Step 4: Run** `npm test -- tdee` → PASS. `npm run check` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat: Mifflin-St Jeor TDEE calculation"`

---

### Task 3: `src/lib/period.ts` — ledger maths & rollover

**Files:**
- Create: `src/lib/period.ts`, `src/lib/period.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Period`, `Entry`, `Settings` from `./types`.
- Produces (exact signatures — Tasks 5/7/9 rely on them):
  - `addDays(date: string, n: number): string`
  - `daysBetween(a: string, b: string): number` (b − a, integer days)
  - `todayISO(now?: Date): string` (local date)
  - `makePeriod(startDate: string, budgetPerDay: number, lengthDays: number): Period`
  - `daysElapsed(period: Period, today: string): number` (clamped 0..length, day 1 = startDate)
  - `accruedBudget(period: Period, today: string): number`
  - `entryTotals(entries: Entry[]): { consumed: number; earned: number }`
  - `balance(period: Period, today: string): number`
  - `paceInfo(period: Period, today: string): { avgPerDay: number; daysLeft: number; projectedEnd: number }`
  - `rollover(state: AppState, today: string): AppState` (idempotent; seals elapsed periods, ensures a current period exists)
  - `currentPeriod(state: AppState): Period | undefined` (last unsealed)
  - `dailyBalances(period: Period, today: string): number[]` (one value per elapsed day, for the sparkline)
  - `stampCaption(sealed: Period[], index: number): string | null`

- [ ] **Step 1: Failing tests** — `src/lib/period.test.ts`:

```ts
import {
  addDays, daysBetween, makePeriod, daysElapsed, accruedBudget, entryTotals,
  balance, paceInfo, rollover, currentPeriod, dailyBalances, stampCaption,
} from "./period";
import type { AppState, Entry, Period } from "./types";

const entry = (over: Partial<Entry>): Entry => ({
  id: "x", label: "t", type: "debit", amount: 100, date: "2026-07-01", source: "manual", ...over,
});

const settingsState = (periods: Period[] = []): AppState => ({
  schemaVersion: 1,
  settings: { tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5" },
  periods,
});

test("date helpers", () => {
  expect(addDays("2026-07-01", 13)).toBe("2026-07-14");
  expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  expect(daysBetween("2026-07-01", "2026-07-14")).toBe(13);
});

test("accrual: day 1 counts one budget, clamped at period length", () => {
  const p = makePeriod("2026-07-01", 1800, 14);
  expect(p.endDate).toBe("2026-07-14");
  expect(daysElapsed(p, "2026-07-01")).toBe(1);
  expect(accruedBudget(p, "2026-07-01")).toBe(1800);
  expect(accruedBudget(p, "2026-07-14")).toBe(25200);
  expect(accruedBudget(p, "2026-08-01")).toBe(25200); // clamp
});

test("balance = accrued − debits + credits", () => {
  const p = makePeriod("2026-07-01", 1800, 14);
  p.entries = [entry({ type: "debit", amount: 1500 }), entry({ type: "credit", amount: 200 })];
  expect(entryTotals(p.entries)).toEqual({ consumed: 1500, earned: 200 });
  expect(balance(p, "2026-07-01")).toBe(500); // 1800 − 1500 + 200
});

test("paceInfo averages and projects", () => {
  const p = makePeriod("2026-07-01", 1800, 14);
  p.entries = [entry({ type: "debit", amount: 3000, date: "2026-07-01" })];
  // day 2: accrued 3600, balance 600, avg 300/day, 12 days left → project 600 + 300×12
  const pace = paceInfo(p, "2026-07-02");
  expect(pace).toEqual({ avgPerDay: 300, daysLeft: 12, projectedEnd: 4200 });
});

test("rollover creates first period from anchor", () => {
  const s = rollover(settingsState(), "2026-07-03");
  expect(s.periods).toHaveLength(1);
  expect(s.periods[0].startDate).toBe("2026-07-01");
  expect(s.periods[0].budgetPerDay).toBe(1800); // tdee − deficit
  expect(currentPeriod(s)?.id).toBe(s.periods[0].id);
});

test("rollover seals elapsed periods (multi-period gap) and is idempotent", () => {
  const s1 = rollover(settingsState(), "2026-08-02"); // anchor 07-01 → periods 07-01..14 (sealed), 07-15..28 (sealed), 07-29.. (current)
  expect(s1.periods).toHaveLength(3);
  expect(s1.periods[0].outcome).toBe("positive"); // no entries → accrued > 0
  expect(s1.periods[1].outcome).toBe("positive");
  expect(s1.periods[2].outcome).toBeUndefined();
  expect(s1.periods[2].startDate).toBe("2026-07-29");
  expect(rollover(s1, "2026-08-02")).toEqual(s1);
});

test("sealed outcome is negative when overspent", () => {
  const base = rollover(settingsState(), "2026-07-01");
  base.periods[0].entries = [entry({ type: "debit", amount: 99999, date: "2026-07-02" })];
  const s = rollover(base, "2026-07-20");
  expect(s.periods[0].outcome).toBe("negative");
});

test("dailyBalances gives one point per elapsed day", () => {
  const p = makePeriod("2026-07-01", 1000, 14);
  p.entries = [entry({ type: "debit", amount: 1500, date: "2026-07-02" })];
  expect(dailyBalances(p, "2026-07-03")).toEqual([1000, 500, 1500]);
});

test("stampCaption flags recovery dips", () => {
  const mk = (outcome: "positive" | "negative"): Period =>
    ({ ...makePeriod("2026-01-01", 1, 14), outcome });
  const sealed = [mk("positive"), mk("negative"), mk("positive")];
  expect(stampCaption(sealed, 1)).toMatch(/didn't spread/);
  expect(stampCaption(sealed, 0)).toBeNull();
  expect(stampCaption([mk("negative"), mk("negative"), mk("positive")], 1)).toBeNull();
});
```

- [ ] **Step 2: Run** `npm test -- period` → FAIL.

- [ ] **Step 3: Implement** `src/lib/period.ts`:

```ts
import type { AppState, Entry, Period } from "./types";

const DAY_MS = 86_400_000;

const parts = (d: string) => d.split("-").map(Number) as [number, number, number];

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY_MS);
}

export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function makePeriod(startDate: string, budgetPerDay: number, lengthDays: number): Period {
  return {
    id: crypto.randomUUID(),
    startDate,
    endDate: addDays(startDate, lengthDays - 1),
    budgetPerDay,
    entries: [],
  };
}

export function daysElapsed(period: Period, today: string): number {
  const length = daysBetween(period.startDate, period.endDate) + 1;
  return Math.max(0, Math.min(daysBetween(period.startDate, today) + 1, length));
}

export function accruedBudget(period: Period, today: string): number {
  return daysElapsed(period, today) * period.budgetPerDay;
}

export function entryTotals(entries: Entry[]): { consumed: number; earned: number } {
  let consumed = 0, earned = 0;
  for (const e of entries) e.type === "debit" ? (consumed += e.amount) : (earned += e.amount);
  return { consumed, earned };
}

export function balance(period: Period, today: string): number {
  const { consumed, earned } = entryTotals(period.entries);
  return accruedBudget(period, today) - consumed + earned;
}

export function paceInfo(period: Period, today: string) {
  const elapsed = Math.max(1, daysElapsed(period, today));
  const bal = balance(period, today);
  const avgPerDay = Math.round(bal / elapsed);
  const daysLeft = Math.max(0, daysBetween(today, period.endDate));
  return { avgPerDay, daysLeft, projectedEnd: bal + avgPerDay * daysLeft };
}

export function currentPeriod(state: AppState): Period | undefined {
  const last = state.periods[state.periods.length - 1];
  return last && !last.outcome ? last : undefined;
}

export function rollover(state: AppState, today: string): AppState {
  const settings = state.settings;
  if (!settings) return state;
  const budgetNow = settings.tdee - settings.deficit;
  const periods = state.periods.map((p) => ({ ...p, entries: [...p.entries] }));

  if (periods.length === 0) {
    periods.push(makePeriod(settings.anchorDate, budgetNow, settings.periodLengthDays));
  }
  let changed = state.periods.length === 0;

  let last = periods[periods.length - 1];
  while (!last.outcome && daysBetween(last.endDate, today) > 0) {
    last.outcome = balance(last, last.endDate) >= 0 ? "positive" : "negative";
    const next = makePeriod(addDays(last.endDate, 1), budgetNow, settings.periodLengthDays);
    periods.push(next);
    last = next;
    changed = true;
  }
  return changed ? { ...state, periods } : state;
}

export function dailyBalances(period: Period, today: string): number[] {
  const days = daysElapsed(period, today);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(period.startDate, i);
    const upTo = period.entries.filter((e) => daysBetween(e.date, day) >= 0);
    const { consumed, earned } = entryTotals(upTo);
    out.push((i + 1) * period.budgetPerDay - consumed + earned);
  }
  return out;
}

export function stampCaption(sealed: Period[], index: number): string | null {
  const p = sealed[index];
  if (!p || p.outcome !== "negative") return null;
  const prev = sealed[index - 1];
  const next = sealed[index + 1];
  if (prev?.outcome === "positive" && next?.outcome === "positive") {
    return `P${index + 1} ran overdrawn but P${index} and P${index + 2} either side stayed in credit — the dip didn't spread`;
  }
  return null;
}
```

Note the idempotency test uses `toEqual` — `rollover` must return the same *value*, so re-running with no elapsed boundary must return `state` unchanged (the `changed` flag handles this).

- [ ] **Step 4: Run** `npm test -- period` → PASS. `npm run check` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat: period ledger maths, rollover and stamp captions"`

---

### Task 4: `src/lib/ai.ts` — parse call + fallback parser

**Files:**
- Create: `src/lib/ai.ts`, `src/lib/ai.test.ts`

**Interfaces:**
- Consumes: `Settings`, `EntryType` from `./types`.
- Produces:
  - `interface ParsedEntry { label: string; type: EntryType; amount: number; source: "ai" | "fallback" }`
  - `fallbackParse(text: string): ParsedEntry`
  - `parseEntry(text: string, settings: Settings): Promise<ParsedEntry>` (never rejects — falls back)
  - `testApiKey(apiKey: string, model: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Failing tests** — `src/lib/ai.test.ts`:

```ts
import { vi, type Mock } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { fallbackParse, parseEntry } from "./ai";
import type { Settings } from "./types";

const settings = (over: Partial<Settings> = {}): Settings => ({
  tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14,
  model: "claude-haiku-4-5", ...over,
});

beforeEach(() => createMock.mockReset());

test("fallbackParse classifies exercise words as credit", () => {
  expect(fallbackParse("100 press ups")).toMatchObject({ type: "credit", source: "fallback" });
  expect(fallbackParse("chicken sandwich")).toMatchObject({ type: "debit", source: "fallback" });
  expect(fallbackParse("30 min run").amount).toBeGreaterThan(0);
});

test("parseEntry without apiKey uses fallback and never calls the API", async () => {
  const r = await parseEntry("toast", settings());
  expect(r.source).toBe("fallback");
  expect(createMock).not.toHaveBeenCalled();
});

test("parseEntry with key returns structured AI result", async () => {
  createMock.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ label: "Chicken sandwich", type: "debit", amount: 480 }) }],
  });
  const r = await parseEntry("chicken sandwich", settings({ apiKey: "sk-ant-test" }));
  expect(r).toEqual({ label: "Chicken sandwich", type: "debit", amount: 480, source: "ai" });
  const req = (createMock as Mock).mock.calls[0][0];
  expect(req.model).toBe("claude-haiku-4-5");
  expect(req.output_config.format.type).toBe("json_schema");
});

test("parseEntry includes stats in the system prompt when present", async () => {
  createMock.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ label: "x", type: "debit", amount: 1 }) }],
  });
  await parseEntry("x", settings({
    apiKey: "k",
    stats: { sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate" },
  }));
  expect((createMock as Mock).mock.calls[0][0].system).toContain("80");
});

test("parseEntry falls back on API error or refusal", async () => {
  createMock.mockRejectedValueOnce(new Error("network"));
  expect((await parseEntry("toast", settings({ apiKey: "k" }))).source).toBe("fallback");
  createMock.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
  expect((await parseEntry("toast", settings({ apiKey: "k" }))).source).toBe("fallback");
});
```

- [ ] **Step 2: Run** `npm test -- ai` → FAIL.

- [ ] **Step 3: Implement** `src/lib/ai.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { EntryType, Settings, UserStats } from "./types";

export interface ParsedEntry {
  label: string;
  type: EntryType;
  amount: number;
  source: "ai" | "fallback";
}

const EXERCISE_WORDS = [
  "press up", "pressup", "push up", "pushup", "sit up", "situp", "squat", "plank",
  "walk", "run", "jog", "sprint", "hike", "gym", "cycle", "cycling", "bike",
  "swim", "workout", "lift", "weights", "yoga", "row", "climb", "stairs", "burpee",
];

export function fallbackParse(text: string): ParsedEntry {
  const lower = text.toLowerCase();
  const isExercise = EXERCISE_WORDS.some((w) => lower.includes(w));
  return {
    label: text.trim(),
    type: isExercise ? "credit" : "debit",
    amount: isExercise ? 100 : 350,
    source: "fallback",
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: "Short tidy description of what was logged" },
    type: { type: "string", enum: ["credit", "debit"], description: "credit = exercise performed, debit = food/drink consumed" },
    amount: { type: "number", description: "Estimated kcal, positive" },
  },
  required: ["label", "type", "amount"],
  additionalProperties: false,
} as const;

function systemPrompt(stats?: UserStats): string {
  const statsLine = stats
    ? ` The person is ${stats.sex}, ${stats.age} years old, ${stats.heightCm} cm, ${stats.weightKg} kg — scale exercise burn estimates to them.`
    : "";
  return (
    "You are the entry parser for a calorie ledger. The user logs one item as free text: " +
    "either something eaten/drunk (a debit) or exercise performed (a credit). " +
    "Estimate total calories for the item as described, using typical portions when unspecified." +
    statsLine
  );
}

export async function parseEntry(text: string, settings: Settings): Promise<ParsedEntry> {
  if (!settings.apiKey) return fallbackParse(text);
  try {
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: settings.model,
      max_tokens: 300,
      system: systemPrompt(settings.stats),
      messages: [{ role: "user", content: text }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    } as Parameters<typeof client.messages.create>[0]);
    if (response.stop_reason === "refusal") return fallbackParse(text);
    const block = response.content.find((b: { type: string }) => b.type === "text") as
      | { type: "text"; text: string } | undefined;
    if (!block) return fallbackParse(text);
    const parsed = JSON.parse(block.text) as { label: string; type: EntryType; amount: number };
    return { label: parsed.label, type: parsed.type, amount: Math.max(0, Math.round(parsed.amount)), source: "ai" };
  } catch {
    return fallbackParse(text);
  }
}

export async function testApiKey(apiKey: string, model: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    await client.messages.create({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

If the installed SDK version doesn't yet type `output_config`, keep the request shape and adjust the cast (`as never` on the field or widen the params type) — the wire format is correct; do not switch to the deprecated `output_format`.

- [ ] **Step 4: Run** `npm test -- ai` → PASS. `npm run check` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat: AI entry parsing with structured outputs and keyword fallback"`

---

### Task 5: `src/lib/store.ts` — persistence + React hook

**Files:**
- Create: `src/lib/store.ts`, `src/lib/store.test.ts`

**Interfaces:**
- Consumes: `rollover`, `currentPeriod`, `todayISO` from `./period`; types + `STORAGE_KEY`, `emptyState` from `./types`; `ParsedEntry` from `./ai`.
- Produces:
  - `loadState(storage?: Storage): AppState`, `saveState(state: AppState, storage?: Storage): void`
  - `exportJSON(state: AppState): string`, `importJSON(json: string): AppState` (throws `Error("Not a Daily Dosh Food export")` on bad input)
  - Hook `useAppState()` returning `{ state, current, today, completeOnboarding(settings), addEntry(parsed: ParsedEntry | Omit<Entry, "id" | "date">), updateEntry(id, patch), deleteEntry(id), updateSettings(patch), replaceState(state), reset() }` where `current` is the current `Period | undefined` and `today` is `todayISO()` at render time. `addEntry` stamps `id: crypto.randomUUID()`, `date: today` and appends to the current period.

- [ ] **Step 1: Failing tests** — `src/lib/store.test.ts` (pure functions + hook via `renderHook` from Testing Library):

```ts
import { renderHook, act } from "@testing-library/react";
import { loadState, saveState, exportJSON, importJSON, useAppState } from "./store";
import { STORAGE_KEY, emptyState } from "./types";
import type { Settings } from "./types";

const settings: Settings = {
  tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5",
};

beforeEach(() => localStorage.clear());

test("loadState returns empty state when nothing stored or corrupt", () => {
  expect(loadState()).toEqual(emptyState());
  localStorage.setItem(STORAGE_KEY, "{corrupt");
  expect(loadState()).toEqual(emptyState());
});

test("save/load round-trip", () => {
  const s = { ...emptyState(), settings };
  saveState(s);
  expect(loadState()).toEqual(s);
});

test("import rejects foreign JSON", () => {
  expect(() => importJSON('{"foo": 1}')).toThrow(/Daily Dosh Food/);
  const s = { ...emptyState(), settings };
  expect(importJSON(exportJSON(s))).toEqual(s);
});

test("hook: onboarding creates settings and first period, addEntry lands in current period", () => {
  const { result } = renderHook(() => useAppState());
  expect(result.current.state.settings).toBeUndefined();
  act(() => result.current.completeOnboarding(settings));
  expect(result.current.current).toBeDefined();
  act(() => result.current.addEntry({ label: "toast", type: "debit", amount: 300, source: "manual" }));
  expect(result.current.current!.entries).toHaveLength(1);
  expect(result.current.current!.entries[0].date).toBe(result.current.today);
  // persisted
  expect(loadState().periods[0].entries).toHaveLength(1);
});

test("hook: updateEntry and deleteEntry", () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.completeOnboarding(settings));
  act(() => result.current.addEntry({ label: "toast", type: "debit", amount: 300, source: "manual" }));
  const id = result.current.current!.entries[0].id;
  act(() => result.current.updateEntry(id, { amount: 250, type: "credit" }));
  expect(result.current.current!.entries[0]).toMatchObject({ amount: 250, type: "credit" });
  act(() => result.current.deleteEntry(id));
  expect(result.current.current!.entries).toHaveLength(0);
});
```

- [ ] **Step 2: Run** `npm test -- store` → FAIL.

- [ ] **Step 3: Implement** `src/lib/store.ts`:

```ts
import { useCallback, useState } from "react";
import type { AppState, Entry, Settings } from "./types";
import { STORAGE_KEY, emptyState } from "./types";
import { currentPeriod, rollover, todayISO } from "./period";
import type { ParsedEntry } from "./ai";

export function loadState(storage: Storage = localStorage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.periods)) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Not a Daily Dosh Food export");
  }
  const s = parsed as AppState;
  if (s?.schemaVersion !== 1 || !Array.isArray(s.periods)) {
    throw new Error("Not a Daily Dosh Food export");
  }
  return s;
}

export function useAppState() {
  const today = todayISO();
  const [state, setState] = useState<AppState>(() => {
    const s = rollover(loadState(), today);
    saveState(s);
    return s;
  });

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const mutateCurrent = (fn: (entries: Entry[]) => Entry[]) =>
    update((s) => {
      const periods = [...s.periods];
      const idx = periods.length - 1;
      if (idx < 0 || periods[idx].outcome) return s;
      periods[idx] = { ...periods[idx], entries: fn(periods[idx].entries) };
      return { ...s, periods };
    });

  return {
    state,
    today,
    current: currentPeriod(state),
    completeOnboarding: (settings: Settings) =>
      update((s) => rollover({ ...s, settings }, today)),
    updateSettings: (patch: Partial<Settings>) =>
      update((s) => (s.settings ? { ...s, settings: { ...s.settings, ...patch } } : s)),
    addEntry: (parsed: ParsedEntry | Omit<Entry, "id" | "date">) =>
      mutateCurrent((entries) => [
        { id: crypto.randomUUID(), date: today, label: parsed.label, type: parsed.type, amount: parsed.amount, source: parsed.source },
        ...entries,
      ]),
    updateEntry: (id: string, patch: Partial<Pick<Entry, "label" | "type" | "amount">>) =>
      mutateCurrent((entries) => entries.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    deleteEntry: (id: string) => mutateCurrent((entries) => entries.filter((e) => e.id !== id)),
    replaceState: (imported: AppState) => update(() => rollover(imported, today)),
    reset: () => update(() => emptyState()),
  };
}
```

- [ ] **Step 4: Run** `npm test -- store` → PASS. `npm run check` → clean.
- [ ] **Step 5: Commit** — `git commit -am "feat: localStorage store with rollover-on-load and entry mutations"`

---

### Task 6: Onboarding screen

**Files:**
- Create: `src/screens/Onboarding.tsx`, `src/screens/Onboarding.test.tsx`

**Interfaces:**
- Consumes: `tdee`, `ACTIVITY_LABELS` from `../lib/tdee`; `todayISO` from `../lib/period`; types; theme.
- Produces: `<Onboarding onComplete={(settings: Settings) => void} />`.

**Behaviour:** Mifflin-first form — sex toggle (two-button, like the mockup's debit/credit toggle), age / height cm / weight kg numeric inputs, activity `<select>`. Live-computed TDEE shown in mono as soon as all fields are valid. Deficit input (default 500). Summary line: "Daily budget: **{tdee − deficit} kcal**". A collapsible "I already know my TDEE" section with a direct TDEE input that overrides the computed value (stats still saved if the form was filled). Primary button "Start tracking" → `onComplete({ tdee, deficit, stats?, anchorDate: todayISO(), periodLengthDays: 14, model: DEFAULT_MODEL })`. Disabled until a valid TDEE exists (computed or direct) and deficit ≥ 0.

- [ ] **Step 1: Failing tests** — `src/screens/Onboarding.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Onboarding from "./Onboarding";

test("computes TDEE live and completes with stats", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(<Onboarding onComplete={onComplete} />);

  await user.click(screen.getByRole("button", { name: /male/i }));
  await user.type(screen.getByLabelText(/age/i), "30");
  await user.type(screen.getByLabelText(/height/i), "180");
  await user.type(screen.getByLabelText(/weight/i), "80");
  await user.selectOptions(screen.getByLabelText(/activity/i), "sedentary");

  expect(await screen.findByText(/2136/)).toBeInTheDocument(); // computed TDEE visible
  await user.click(screen.getByRole("button", { name: /start tracking/i }));
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({
      tdee: 2136,
      deficit: 500,
      periodLengthDays: 14,
      stats: expect.objectContaining({ weightKg: 80 }),
    })
  );
});

test("direct TDEE override works without stats", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(<Onboarding onComplete={onComplete} />);

  await user.click(screen.getByRole("button", { name: /already know my tdee/i }));
  await user.type(screen.getByLabelText(/your tdee/i), "2400");
  await user.click(screen.getByRole("button", { name: /start tracking/i }));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ tdee: 2400 }));
});

test("start disabled until a TDEE exists", () => {
  render(<Onboarding onComplete={vi.fn()} />);
  expect(screen.getByRole("button", { name: /start tracking/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `src/screens/Onboarding.tsx`. Layout: centered 420px column on `colors.bg`, app name header, card sections. Use `labelStyle` + `inputStyle` from theme; associate labels via `htmlFor`/`id` so the accessible queries above pass. Keep all state local with `useState`; compute `computedTdee = allValid ? tdee(stats) : undefined`; `effectiveTdee = directOverride ?? computedTdee`. Deficit input pre-filled "500". The activity `<select>` renders `ACTIVITY_LABELS` entries as options with the `Activity` key as value.
- [ ] **Step 4: Run** → PASS; `npm run check` clean.
- [ ] **Step 5: Commit** — `git commit -am "feat: onboarding screen with Mifflin-first TDEE and direct override"`

---

### Task 7: Dashboard components + screen

**Files:**
- Create: `src/components/Sparkline.tsx`, `src/components/StatBox.tsx`, `src/components/EntryList.tsx`, `src/components/Composer.tsx`, `src/screens/Dashboard.tsx`, `src/screens/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `balance`, `paceInfo`, `dailyBalances`, `entryTotals`, `accruedBudget`, `daysBetween` from `../lib/period`; `parseEntry` from `../lib/ai`; theme; types.
- Produces:
  - `<Sparkline values={number[]} />` — SVG polyline, `preserveAspectRatio="none"`, stroke `colors.positive` when last value ≥ 0 else `colors.negative`, dashed zero line (like the mockup's chart card)
  - `<StatBox label={string} value={number} accent?={boolean} />`
  - `<EntryList entries={Entry[]} onSelect={(e: Entry) => void} />` — mockup row styling; caption per source: "AI logged" / "manual" / "estimate — tap to edit"; row `aria-label` = entry label
  - `<Composer onSubmit={(text: string) => void} busy={boolean} />` — floating "+ Add something" button that expands to input + Cancel/"Log it" (Enter submits)
  - `<Dashboard app={ReturnType<typeof useAppState>} settings={Settings} onShowStamps={() => void} onShowSettings={() => void} />`

**Behaviour:** Header row: "Daily Dosh Food" + links "Stamps →" and a "⚙" settings button. Big mono balance for the current period (`+`/`−` prefix, colour by sign, "kcal" caption, "In credit this period" / "Overdrawn this period" label). Pace line: `averaging {±avg} kcal a day · {daysLeft} days to next period`. Prediction: `at this pace you'll finish {projectedEnd} {up|down}`. Sparkline card of `dailyBalances`. Stat row: Period budget (`budgetPerDay × periodLengthDays`), Consumed, Earned back (accent). Entries list (current period, newest first). Composer pinned bottom-centre; on submit → `parseEntry(text, settings)` → `app.addEntry(result)`; while awaiting, `busy` disables the Log it button; if result `source === "fallback"` and an apiKey **is** configured, show a transient toast div "AI unavailable — logged an estimate, tap to correct" (plain `useState`, disappears after 4s).

- [ ] **Step 1: Failing tests** — `src/screens/Dashboard.test.tsx` (mock `../lib/ai`):

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../lib/ai", () => ({
  parseEntry: vi.fn(async (text: string) => ({ label: text, type: "debit", amount: 400, source: "ai" })),
}));

import Dashboard from "./Dashboard";
import { useAppState } from "../lib/store";
import type { Settings } from "../lib/types";

const settings: Settings = {
  tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5", apiKey: "k",
};

function setup() {
  localStorage.clear();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  const view = () =>
    render(
      <Dashboard app={hook.result.current} settings={settings} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
    );
  return { hook, view };
}

test("shows balance, pace and stat row", () => {
  const { view } = setup();
  view();
  expect(screen.getByText(/in credit this period/i)).toBeInTheDocument();
  expect(screen.getByText(/period budget/i)).toBeInTheDocument();
  expect(screen.getByText(/earned back/i)).toBeInTheDocument();
});

test("composer logs an entry through parseEntry", async () => {
  const user = userEvent.setup();
  const { hook, view } = setup();
  const { rerender } = view();
  await user.click(screen.getByRole("button", { name: /add something/i }));
  await user.type(screen.getByPlaceholderText(/press ups/i), "chicken sandwich");
  await user.click(screen.getByRole("button", { name: /log it/i }));
  rerender(
    <Dashboard app={hook.result.current} settings={settings} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
  );
  expect(hook.result.current.current!.entries[0]).toMatchObject({ label: "chicken sandwich", amount: 400 });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the four components + screen following the mockup's styling (max-width 420 centered, spacing and font sizes as in `docs/reference/mockup.jsx`, colours only via `theme.ts`). Sparkline: map values to a 300×60 viewBox, x evenly spaced, y scaled to [min,max] padded 10%, zero line dashed `#3A3F47`.
- [ ] **Step 4: Run** → PASS; check clean.
- [ ] **Step 5: Commit** — `git commit -am "feat: dashboard with balance, pace, sparkline, stats and AI composer"`

---

### Task 8: EditSheet (bottom-sheet entry editor)

**Files:**
- Create: `src/components/EditSheet.tsx`, `src/components/EditSheet.test.tsx`

**Interfaces:**
- Consumes: `Entry`, `EntryType`, theme.
- Produces: `<EditSheet entry={Entry} onSave={(patch: { label: string; type: EntryType; amount: number }) => void} onDelete={() => void} onClose={() => void} />`. Dashboard (Task 7) wires it: `EntryList onSelect` sets `editing: Entry | null`; sheet renders when set; `onSave` → `app.updateEntry(entry.id, patch)`; `onDelete` → `app.deleteEntry(entry.id)`. **Task 8 also modifies `src/screens/Dashboard.tsx`** to add that wiring (a ~10-line change: state + render).

**Behaviour:** fixed overlay `rgba(0,0,0,0.6)`, sheet bottom-aligned, max-width 420, rounded top corners 20px, border `colors.border`. Fields exactly per spec: Description (text), Type two-button toggle (Debit filled `colors.negative` when active / Credit filled `colors.positive`, inactive = ghost), Amount (numeric, mono). Buttons: Delete (flex 1, outlined, text `colors.negative`), Save (flex 2, filled `colors.positive`). Clicking the overlay closes without saving; clicks inside don't propagate.

- [ ] **Step 1: Failing tests** — `src/components/EditSheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import EditSheet from "./EditSheet";
import type { Entry } from "../lib/types";

const entry: Entry = { id: "1", label: "Toast", type: "debit", amount: 390, date: "2026-07-18", source: "ai" };

test("edits and saves", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<EditSheet entry={entry} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
  await user.clear(screen.getByLabelText(/description/i));
  await user.type(screen.getByLabelText(/description/i), "Toast + eggs");
  await user.click(screen.getByRole("button", { name: /credit/i }));
  await user.clear(screen.getByLabelText(/amount/i));
  await user.type(screen.getByLabelText(/amount/i), "120");
  await user.click(screen.getByRole("button", { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith({ label: "Toast + eggs", type: "credit", amount: 120 });
});

test("delete and overlay-close", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(<EditSheet entry={entry} onSave={vi.fn()} onDelete={onDelete} onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: /delete/i }));
  expect(onDelete).toHaveBeenCalled();
  await user.click(screen.getByTestId("sheet-overlay"));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `EditSheet.tsx` (local `useState` seeded from `entry`; `data-testid="sheet-overlay"` on the backdrop; `stopPropagation` on the sheet). Wire into Dashboard as described.
- [ ] **Step 4: Run** `npm test` (EditSheet + Dashboard suites) → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: bottom-sheet entry editor wired into dashboard"`

---

### Task 9: Stamps screen

**Files:**
- Create: `src/screens/Stamps.tsx`, `src/screens/Stamps.test.tsx`

**Interfaces:**
- Consumes: `stampCaption`, `balance` from `../lib/period`; types; theme.
- Produces: `<Stamps periods={Period[]} onBack={() => void} />` — takes **all** periods, renders only sealed ones (`outcome` set), in order.

**Behaviour:** Header "← Back" + title "Stamps". Horizontally scrollable strip (`overflowX: "auto"`, flex row, gap 14). Each stamp: ~120px circle, 2px border in outcome colour, rotated `rotate(${(i % 5) - 2 * 2}deg)`-style slight alternating tilt (deterministic from index, no randomness), text "IN CREDIT" (positive) or "OVERDRAWN" (negative) in mono uppercase, period label `P{n}` + date range caption below, final balance in mono. Under the strip, any non-null `stampCaption` strings render as muted paragraphs. Empty state: "No sealed periods yet — your first stamp lands in {n} days." (compute from the last period's endDate; pass `today` if needed — acceptable to derive via `todayISO()` in the **screen**, never in lib).

- [ ] **Step 1: Failing tests**:

```tsx
import { render, screen } from "@testing-library/react";
import Stamps from "./Stamps";
import type { Period } from "../lib/types";

const p = (n: number, outcome?: "positive" | "negative"): Period => ({
  id: String(n), startDate: "2026-07-01", endDate: "2026-07-14",
  budgetPerDay: 1800, entries: [], outcome,
});

test("renders sealed stamps and recovery caption", () => {
  render(<Stamps periods={[p(1, "positive"), p(2, "negative"), p(3, "positive"), p(4)]} onBack={() => {}} />);
  expect(screen.getAllByText(/in credit/i)).toHaveLength(2);
  expect(screen.getByText(/overdrawn/i)).toBeInTheDocument();
  expect(screen.getByText(/didn't spread/)).toBeInTheDocument();
});

test("empty state", () => {
  render(<Stamps periods={[p(1)]} onBack={() => {}} />);
  expect(screen.getByText(/first stamp lands/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `Stamps.tsx` per behaviour above.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: stamps page with recovery captions"`

---

### Task 10: Settings screen + App wiring

**Files:**
- Create: `src/screens/Settings.tsx`, `src/screens/Settings.test.tsx`, `src/App.test.tsx`
- Modify: `src/App.tsx` (replace placeholder)

**Interfaces:**
- Consumes: everything prior; `testApiKey` from `../lib/ai`; `exportJSON`, `importJSON` from `../lib/store`.
- Produces: `<SettingsScreen app={ReturnType<typeof useAppState>} onBack={() => void} />` and the final `App`.

**Behaviour — Settings:** sections in cards: (1) Budget — TDEE + deficit numeric inputs, "recalculate from stats" expander reusing the Mifflin fields when `stats` present, Save button calls `updateSettings`; note "applies from your next period" (per spec, current period keeps its snapshot). (2) AI — API key password input + "Test key" button showing ✓ or the error (calls `testApiKey(key, model)`), model id text input (default `claude-haiku-4-5`), helper copy: "Your key is stored only in this browser and sent only to api.anthropic.com. Use a dedicated key with a low spend limit." (3) Data — Export (downloads `daily-dosh-food-export.json` via Blob URL), Import (file input → `importJSON` → `replaceState`, alert on error), Reset (confirm() then `reset()`).

**Behaviour — App:**
```tsx
import { useState } from "react";
import { useAppState } from "./lib/store";
import Onboarding from "./screens/Onboarding";
import Dashboard from "./screens/Dashboard";
import Stamps from "./screens/Stamps";
import SettingsScreen from "./screens/Settings";

type View = "dashboard" | "stamps" | "settings";

export default function App() {
  const app = useAppState();
  const [view, setView] = useState<View>("dashboard");
  if (!app.state.settings) return <Onboarding onComplete={app.completeOnboarding} />;
  if (view === "stamps") return <Stamps periods={app.state.periods} onBack={() => setView("dashboard")} />;
  if (view === "settings") return <SettingsScreen app={app} onBack={() => setView("dashboard")} />;
  return (
    <Dashboard
      app={app}
      settings={app.state.settings}
      onShowStamps={() => setView("stamps")}
      onShowSettings={() => setView("settings")}
    />
  );
}
```

- [ ] **Step 1: Failing tests** — `src/screens/Settings.test.tsx` (mock `../lib/ai`'s `testApiKey`; assert updateSettings called with new deficit; assert key test renders result) and `src/App.test.tsx`:

```tsx
// App.test.tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("shows onboarding when no settings", () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
});
```

```tsx
// Settings.test.tsx (core cases)
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
vi.mock("../lib/ai", () => ({ testApiKey: vi.fn(async () => ({ ok: true })) }));
import SettingsScreen from "./Settings";
import { useAppState } from "../lib/store";
import type { Settings } from "../lib/types";

const settings: Settings = { tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5" };

test("saves budget changes and tests API key", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  const deficit = screen.getByLabelText(/deficit/i);
  await user.clear(deficit);
  await user.type(deficit, "300");
  await user.click(screen.getByRole("button", { name: /^save$/i }));
  expect(hook.result.current.state.settings!.deficit).toBe(300);
  await user.type(screen.getByLabelText(/api key/i), "sk-ant-x");
  await user.click(screen.getByRole("button", { name: /test key/i }));
  expect(await screen.findByText(/✓/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** Settings + App per behaviour above.
- [ ] **Step 4: Run full suite** `npm run check && npm test && npm run build` → all green.
- [ ] **Step 5: Commit** — `git commit -am "feat: settings screen (budget, BYO key, data export) and app routing"`

---

### Task 11: GitHub repo, Pages, live verification

**Files:**
- Create: `README.md`
- No source changes.

- [ ] **Step 1: README** — short: what it is, screenshot placeholder omitted, "## Develop" (`npm install`, `npm run dev`, `npm test`, `npm run check`), "## Deploy" (push to main → Pages), "## AI parsing" (BYO key explanation + low-spend-limit advice), link to spec/plan docs.
- [ ] **Step 2: Create repo & push**

```bash
cd ~/Code/daily-dosh-food
gh repo create j-c-levin/daily-dosh-food --public --source . --push
gh api -X POST repos/j-c-levin/daily-dosh-food/pages -f build_type=workflow || true  # enable Pages (Actions source); ignore if already enabled
gh run watch --repo j-c-levin/daily-dosh-food --exit-status   # wait for Deploy workflow
```

- [ ] **Step 3: Verify live** — `curl -s -o /dev/null -w "%{http_code}" https://j-c-levin.github.io/daily-dosh-food/` → `200`, and the HTML contains `Daily Dosh Food`. If assets 404, re-check `base` in `vite.config.ts`.
- [ ] **Step 4: Commit README** (before push in step 2 if not already) — `git commit -am "docs: README"`

---

## Self-review notes

- Spec coverage: mechanics 1–6 → Tasks 3/5; onboarding → 6; dashboard/composer/edit/stamps/settings screens → 7–10; AI parse + fallback + security posture → 4 and 10 copy; CI/deploy → 1 and 11; export/import → 5/10; recovery captions → 3/9. Deferred items (eval harness, PWA, sync) intentionally absent.
- Type consistency: `ParsedEntry` (ai) feeds `addEntry` (store) which stamps `id`/`date`; `useAppState` return shape consumed by Dashboard/Settings props as `ReturnType<typeof useAppState>`.
- Known judgment calls: `UserStats.activity` added (spec §data-model extension, noted); zero balance seals as positive; untracked periods seal positive (accepted YAGNI).
