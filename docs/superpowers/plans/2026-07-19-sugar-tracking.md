# Sugar Tracking & Decaying Carryover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track free-sugar grams per entry (AI-estimated, displayed as 0–5 levels) and replace the full-carryover calorie ledger with a decaying 3-day carryover shared by calories and sugar.

**Architecture:** A new pure module `src/lib/carryover.ts` derives a per-day ledger (base budget + decayed bonus + credits − debits) from the existing flat entries array — no stored state, so backdated edits re-flow automatically. Schema v2 adds `sugarG` to entries and sugar budget snapshots to settings/periods, with an in-place migration in `loadState`. The 14-day period survives purely as a scoring window; stamps are judged on undecayed totals and gain a second sugar verdict.

**Tech Stack:** React 19 + TypeScript (strict) + Vite, Vitest + Testing Library, `@anthropic-ai/sdk` structured outputs, localStorage persistence. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-19-sugar-tracking-design.md` — read it before starting.

## Global Constraints

- Surplus kernel: **30% / 15% / 5%** of the previous 3 days' positive leftovers. Debt kernel: **50% / 25% / 10%** of negative leftovers. Nothing older than 3 days.
- A day's leftover = `base + bonus + credits − debits` (bonus included, so spending an earned bonus never registers as debt).
- Sugar is debit-only: exercise credits never restore sugar allowance.
- Default sugar budget: **30 g/day** (`DEFAULT_SUGAR_BUDGET_G = 30`), editable in Settings.
- Sugar level display bounds (lower-inclusive): level 1 at 2 g, 2 at 10 g, 3 at 20 g, 4 at 30 g, 5 at 45 g.
- `Entry.sugarG === undefined` means unknown → counts 0 toward budgets, renders no chip.
- Storage key stays `"daily-dosh-food:v1"`; `schemaVersion` bumps 1 → 2 with in-place migration. v1 exports must still import.
- Stamps are judged on **undecayed** totals. Sealed periods are never mutated except at sealing.
- Follow existing code style: inline style objects, `colors`/`mono`/`sans` from `src/theme.ts`, plain functions, Vitest `test()` (no `describe` nesting in lib tests).
- Every task: run `npx vitest run` (full suite) and `npx tsc -b --noEmit` before committing.

---

### Task 1: Schema v2 — types, migration, period/onboarding plumbing

Everything that must change together for the code to compile with the new required fields.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/store.ts` (loadState/importJSON migration)
- Modify: `src/lib/period.ts:23-31` (makePeriod), `:66-86` (rollover)
- Modify: `src/screens/Onboarding.tsx:69-76` (settings construction)
- Test: `src/lib/store.test.ts`, `src/lib/period.test.ts` (+ fix any other fixture that constructs `Settings`/`AppState`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Entry.sugarG?: number`; `Settings.sugarBudget: number`; `Period.sugarBudgetPerDay: number`, `Period.sugarOutcome?: "under" | "over"`; `AppState.schemaVersion: 2`; `DEFAULT_SUGAR_BUDGET_G = 30` (exported from `types.ts`); `makePeriod(startDate, budgetPerDay, sugarBudgetPerDay, lengthDays)`; `migrate(parsed: unknown): AppState | null` (exported from `store.ts`). All later tasks rely on these exact names.

- [ ] **Step 1: Write failing migration tests**

Append to `src/lib/store.test.ts` (reuse the file's existing fake-storage helper if one exists; otherwise add this one):

```ts
const memStorage = (initial?: Record<string, string>): Storage => {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

test("loadState migrates a v1 blob to schema v2 with sugar defaults", () => {
  const v1 = {
    schemaVersion: 1,
    settings: { tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "m" },
    periods: [{ id: "p1", startDate: "2026-07-01", endDate: "2026-07-14", budgetPerDay: 1800, entries: [] }],
  };
  const s = loadState(memStorage({ "daily-dosh-food:v1": JSON.stringify(v1) }));
  expect(s.schemaVersion).toBe(2);
  expect(s.settings?.sugarBudget).toBe(30);
  expect(s.periods[0].sugarBudgetPerDay).toBe(30);
});

test("loadState passes a v2 blob through untouched", () => {
  const v2 = {
    schemaVersion: 2,
    settings: { tdee: 2300, deficit: 500, sugarBudget: 25, anchorDate: "2026-07-01", periodLengthDays: 14, model: "m" },
    periods: [],
  };
  const s = loadState(memStorage({ "daily-dosh-food:v1": JSON.stringify(v2) }));
  expect(s.settings?.sugarBudget).toBe(25);
});

test("importJSON accepts v1 exports and migrates them", () => {
  const v1 = { schemaVersion: 1, periods: [] };
  expect(importJSON(JSON.stringify(v1)).schemaVersion).toBe(2);
  expect(() => importJSON(JSON.stringify({ schemaVersion: 3, periods: [] }))).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — v1 blobs currently return `emptyState()` (schemaVersion mismatch), `sugarBudget`/`sugarBudgetPerDay` don't exist.

- [ ] **Step 3: Update `src/lib/types.ts`**

```ts
export interface Entry {
  id: string;
  label: string;
  type: EntryType;
  amount: number;        // kcal, positive integer
  sugarG?: number;       // grams of free sugars, ≥ 0; undefined = unknown (legacy/fallback)
  date: string;          // ISO yyyy-mm-dd (local)
  source: EntrySource;
}

export interface Period {
  id: string;
  startDate: string;     // inclusive
  endDate: string;       // inclusive (start + 13 for 14-day periods)
  budgetPerDay: number;  // snapshot, rewritten immediately on settings changes until sealed
  sugarBudgetPerDay: number; // snapshot, same rewrite rules as budgetPerDay
  entries: Entry[];
  outcome?: "positive" | "negative"; // set when sealed
  sugarOutcome?: "under" | "over";   // set when sealed
}
```

`Settings` gains `sugarBudget: number;   // g free sugars per day` after `deficit`. Add next to `DEFAULT_MODEL`:

```ts
// NHS adult guideline for free sugars.
export const DEFAULT_SUGAR_BUDGET_G = 30;
```

`AppState.schemaVersion` becomes `2`; `emptyState` returns `{ schemaVersion: 2, periods: [] }`. `STORAGE_KEY` is unchanged.

- [ ] **Step 4: Add migration to `src/lib/store.ts`**

Replace the bodies of `loadState` and `importJSON` with a shared `migrate`:

```ts
import { STORAGE_KEY, emptyState, DEFAULT_SUGAR_BUDGET_G } from "./types";
import type { AppState, Entry, Period, Settings } from "./types";

interface AppStateV1 {
  schemaVersion: 1;
  settings?: Omit<Settings, "sugarBudget">;
  periods: Array<Omit<Period, "sugarBudgetPerDay" | "sugarOutcome">>;
}

// Returns a valid v2 state, or null if the blob is unrecognisable.
export function migrate(parsed: unknown): AppState | null {
  const s = parsed as { schemaVersion?: unknown; periods?: unknown };
  if (!s || !Array.isArray(s.periods)) return null;
  if (s.schemaVersion === 2) return parsed as AppState;
  if (s.schemaVersion === 1) {
    const v1 = parsed as AppStateV1;
    return {
      schemaVersion: 2,
      settings: v1.settings ? { ...v1.settings, sugarBudget: DEFAULT_SUGAR_BUDGET_G } : undefined,
      periods: v1.periods.map((p) => ({ ...p, sugarBudgetPerDay: DEFAULT_SUGAR_BUDGET_G })),
    };
  }
  return null;
}

export function loadState(storage: Storage = localStorage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return migrate(JSON.parse(raw)) ?? emptyState();
  } catch {
    return emptyState();
  }
}

export function importJSON(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Not a Daily Dosh Food export");
  }
  const migrated = migrate(parsed);
  if (!migrated) throw new Error("Not a Daily Dosh Food export");
  return migrated;
}
```

- [ ] **Step 5: Thread sugar budget through `makePeriod`/`rollover` (`src/lib/period.ts`)**

```ts
export function makePeriod(
  startDate: string,
  budgetPerDay: number,
  sugarBudgetPerDay: number,
  lengthDays: number,
): Period {
  return {
    id: crypto.randomUUID(),
    startDate,
    endDate: addDays(startDate, lengthDays - 1),
    budgetPerDay,
    sugarBudgetPerDay,
    entries: [],
  };
}
```

In `rollover`, add `const sugarNow = settings.sugarBudget;` next to `budgetNow` and update both call sites:

```ts
periods.push(makePeriod(settings.anchorDate, budgetNow, sugarNow, settings.periodLengthDays));
// …and in the while loop:
const next = makePeriod(addDays(last.endDate, 1), budgetNow, sugarNow, settings.periodLengthDays);
```

- [ ] **Step 6: Onboarding constructs v2 settings (`src/screens/Onboarding.tsx:69-76`)**

Import `DEFAULT_SUGAR_BUDGET_G` from `../lib/types` and add it to the `onComplete` object:

```ts
onComplete({
  tdee: effectiveTdee,
  deficit: deficitNum,
  sugarBudget: DEFAULT_SUGAR_BUDGET_G,
  stats,
  anchorDate: todayISO(),
  periodLengthDays: 14,
  model: DEFAULT_MODEL,
});
```

- [ ] **Step 7: Fix compile errors in test fixtures**

Run `npx tsc -b --noEmit`. Every error is mechanical; fix by pattern:
- `makePeriod("2026-07-01", 1800, 14)` → `makePeriod("2026-07-01", 1800, 30, 14)` (5 sites in `src/lib/period.test.ts`).
- `settingsState` in `src/lib/period.test.ts:11-15`: `schemaVersion: 2` (if the annotation requires it) and add `sugarBudget: 30` to the settings literal.
- Any other test fixture constructing `Settings`, `Period`, or `AppState` (check `src/lib/store.test.ts`, `src/screens/*.test.tsx`, `src/App.test.tsx`): add `sugarBudget: 30` / `sugarBudgetPerDay: 30` / `schemaVersion: 2` as needed. Do not change test behaviour, only fixture shapes.

- [ ] **Step 8: Run full suite and typecheck**

Run: `npx tsc -b --noEmit && npx vitest run`
Expected: PASS, including the three new migration tests.

- [ ] **Step 9: Commit**

```bash
git add -A src docs
git -c commit.gpgsign=false commit -m "feat(sugar): schema v2 — sugarG entries, sugar budgets, v1→v2 migration"
```

---

### Task 2: Sugar display levels (`src/lib/sugar.ts`)

**Files:**
- Create: `src/lib/sugar.ts`
- Test: `src/lib/sugar.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `sugarLevel(grams: number): SugarLevel` (0–5), `SUGAR_LEVEL_BOUNDS`, `SUGAR_LEVEL_COLORS: Record<SugarLevel, string>`. Tasks 6–7 import these exact names.

- [ ] **Step 1: Write failing tests (`src/lib/sugar.test.ts`)**

```ts
import { sugarLevel } from "./sugar";

test("sugarLevel maps grams to 0–5 bands (lower bound inclusive)", () => {
  expect(sugarLevel(0)).toBe(0);
  expect(sugarLevel(1.9)).toBe(0);
  expect(sugarLevel(2)).toBe(1);
  expect(sugarLevel(9.9)).toBe(1);
  expect(sugarLevel(10)).toBe(2);   // honeyed oats ≈ 10 g
  expect(sugarLevel(20)).toBe(3);
  expect(sugarLevel(25)).toBe(3);   // chocolate bar ≈ 25 g
  expect(sugarLevel(30)).toBe(4);
  expect(sugarLevel(45)).toBe(5);
  expect(sugarLevel(53)).toBe(5);   // 500 ml full-sugar cola ≈ 53 g
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sugar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/sugar.ts`**

```ts
// Display mapping for free-sugar grams. Grams are the stored and budgeted
// unit; the 0–5 level exists only at render time, so retuning these bounds
// re-labels all history for free.
export const SUGAR_LEVEL_BOUNDS = [2, 10, 20, 30, 45] as const; // lower bound of levels 1..5

export type SugarLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function sugarLevel(grams: number): SugarLevel {
  let level = 0;
  for (const bound of SUGAR_LEVEL_BOUNDS) if (grams >= bound) level++;
  return level as SugarLevel;
}

// Level 0 reuses the theme positive green; 5 is hotter than theme negative.
export const SUGAR_LEVEL_COLORS: Record<SugarLevel, string> = {
  0: "#3DDC97",
  1: "#8BD46B",
  2: "#C9C84E",
  3: "#E0B156",
  4: "#E07856",
  5: "#E0566B",
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/sugar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sugar.ts src/lib/sugar.test.ts
git -c commit.gpgsign=false commit -m "feat(sugar): 0-5 display level mapping over free-sugar grams"
```

---

### Task 3: Carryover engine (`src/lib/carryover.ts`)

The core mechanic. Pure functions only — no React, no storage.

**Files:**
- Create: `src/lib/carryover.ts`
- Test: `src/lib/carryover.test.ts`

**Interfaces:**
- Consumes: `Period`, `Entry` from `./types`; `addDays`, `daysBetween` from `./period`.
- Produces (Task 6 relies on these exact shapes):

```ts
export const SURPLUS_KERNEL: readonly number[]; // [0.3, 0.15, 0.05]
export const DEBT_KERNEL: readonly number[];    // [0.5, 0.25, 0.1]
export type LedgerMode = "calories" | "sugar";
export interface DayLedger {
  date: string;
  base: number;     // period budget snapshot for that day
  bonus: number;    // decayed carryover from the previous 3 days (may be negative)
  credits: number;  // exercise kcal; always 0 in sugar mode
  debits: number;   // kcal eaten, or sugar grams
  leftover: number; // base + bonus + credits − debits
}
export function computeLedger(periods: Period[], today: string, mode: LedgerMode): DayLedger[];
export function todayLedger(periods: Period[], today: string, mode: LedgerMode): DayLedger | undefined;
```

- [ ] **Step 1: Write failing tests (`src/lib/carryover.test.ts`)**

All numbers below are hand-derived from the kernels; keep them exactly.

```ts
import { computeLedger, todayLedger } from "./carryover";
import { addDays, makePeriod } from "./period";
import type { Entry, Period } from "./types";

const entry = (over: Partial<Entry>): Entry => ({
  id: "x", label: "t", type: "debit", amount: 0, date: "2026-07-01", source: "manual", ...over,
});

// One 14-day period, 1000 kcal/day, 30 g sugar/day, starting 2026-07-01.
const period = (entries: Entry[]): Period => {
  const p = makePeriod("2026-07-01", 1000, 30, 14);
  p.entries = entries;
  return p;
};

test("cold start: first day has no bonus", () => {
  const led = computeLedger([period([])], "2026-07-01", "calories");
  expect(led).toHaveLength(1);
  expect(led[0]).toMatchObject({ base: 1000, bonus: 0, credits: 0, debits: 0, leftover: 1000 });
});

test("surplus decays 30/15/5 and vanishes on day 4", () => {
  // Day 1: eat 400 → leftover 600. Days 2–4: eat exactly base+bonus so their
  // own leftovers are 0 and only day 1's 600 is ever carried.
  const entries = [
    entry({ amount: 400, date: "2026-07-01" }),
    entry({ amount: 1180, date: "2026-07-02" }), // 1000 + 0.30×600
    entry({ amount: 1090, date: "2026-07-03" }), // 1000 + 0.15×600
    entry({ amount: 1030, date: "2026-07-04" }), // 1000 + 0.05×600
  ];
  const led = computeLedger([period(entries)], "2026-07-05", "calories");
  expect(led[1].bonus).toBeCloseTo(180);
  expect(led[2].bonus).toBeCloseTo(90);
  expect(led[3].bonus).toBeCloseTo(30);
  expect(led[4].bonus).toBeCloseTo(0); // day 5: day 1 is out of the window
});

test("debt decays on the slower 50/25/10 schedule", () => {
  // Day 1: eat 1500 → leftover −500. Days 2–4 eat exactly base+bonus.
  const entries = [
    entry({ amount: 1500, date: "2026-07-01" }),
    entry({ amount: 750, date: "2026-07-02" }),  // 1000 − 0.50×500
    entry({ amount: 875, date: "2026-07-03" }),  // 1000 − 0.25×500
    entry({ amount: 950, date: "2026-07-04" }),  // 1000 − 0.10×500
  ];
  const led = computeLedger([period(entries)], "2026-07-05", "calories");
  expect(led[1].bonus).toBeCloseTo(-250);
  expect(led[2].bonus).toBeCloseTo(-125);
  expect(led[3].bonus).toBeCloseTo(-50);
  expect(led[4].bonus).toBeCloseTo(0);
});

test("leftover includes the bonus: spending an earned bonus is not debt", () => {
  // Day 1: eat 400 → leftover 600 → day 2 bonus 180.
  // Day 2: eat 1100 (into the bonus) → leftover 1000+180−1100 = 80 ≥ 0.
  // Day 3 bonus = 0.30×80 + 0.15×600 = 114 (surplus kernel both days).
  const entries = [
    entry({ amount: 400, date: "2026-07-01" }),
    entry({ amount: 1100, date: "2026-07-02" }),
  ];
  const led = computeLedger([period(entries)], "2026-07-03", "calories");
  expect(led[1].leftover).toBeCloseTo(80);
  expect(led[2].bonus).toBeCloseTo(114);
});

test("unspent bonus compounds mildly and stays bounded", () => {
  // Eat nothing: day 1 leftover 1000; day 2 leftover 1000+300=1300;
  // day 3 bonus = 0.30×1300 + 0.15×1000 = 540.
  const led = computeLedger([period([])], "2026-07-03", "calories");
  expect(led[1].bonus).toBeCloseTo(300);
  expect(led[2].bonus).toBeCloseTo(540);
});

test("credits count for calories and are ignored for sugar", () => {
  const entries = [
    entry({ amount: 1200, sugarG: 40, date: "2026-07-01" }),
    entry({ type: "credit", amount: 300, date: "2026-07-01" }),
  ];
  const cal = computeLedger([period(entries)], "2026-07-01", "calories")[0];
  expect(cal).toMatchObject({ credits: 300, debits: 1200 });
  expect(cal.leftover).toBeCloseTo(100); // 1000 + 300 − 1200
  const sugar = computeLedger([period(entries)], "2026-07-01", "sugar")[0];
  expect(sugar).toMatchObject({ base: 30, credits: 0, debits: 40 });
  expect(sugar.leftover).toBeCloseTo(-10);
});

test("entries with unknown sugarG count 0 in sugar mode", () => {
  const led = computeLedger([period([entry({ amount: 500, date: "2026-07-01" })])], "2026-07-01", "sugar");
  expect(led[0].debits).toBe(0);
});

test("carryover crosses period boundaries", () => {
  // P1 ends 07-14: days 1–13 each eat exactly their 1000 base (leftover 0),
  // so no bonus compounds; day 14 eats 400 → leftover exactly 600. P2 (a
  // different budget) starts 07-15 and receives 30% of that 600.
  const p1 = makePeriod("2026-07-01", 1000, 30, 14);
  p1.outcome = "positive";
  p1.entries = [
    ...Array.from({ length: 13 }, (_, i) => entry({ amount: 1000, date: addDays("2026-07-01", i) })),
    entry({ amount: 400, date: "2026-07-14" }),
  ];
  const p2 = makePeriod("2026-07-15", 2000, 30, 14);
  const led = computeLedger([p1, p2], "2026-07-15", "calories");
  const day15 = led[led.length - 1];
  expect(day15.base).toBe(2000);
  expect(day15.bonus).toBeCloseTo(180);
});

test("a backdated edit re-flows later days (derived, no stored state)", () => {
  const entries = [entry({ id: "a", amount: 400, date: "2026-07-01" })];
  const before = computeLedger([period(entries)], "2026-07-02", "calories");
  expect(before[1].bonus).toBeCloseTo(180);
  const edited = [entry({ id: "a", amount: 900, date: "2026-07-01" })];
  const after = computeLedger([period(edited)], "2026-07-02", "calories");
  expect(after[1].bonus).toBeCloseTo(30); // 0.30 × 100
});

test("todayLedger returns the final day, or undefined with no periods", () => {
  expect(todayLedger([], "2026-07-01", "calories")).toBeUndefined();
  const led = todayLedger([period([])], "2026-07-02", "calories");
  expect(led?.date).toBe("2026-07-02");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/carryover.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/carryover.ts`**

```ts
import type { Period } from "./types";
import { addDays, daysBetween } from "./period";

// Decaying carryover: each day's unused surplus feeds the next three days at
// SURPLUS_KERNEL weights; overspend fades on the slower DEBT_KERNEL. Index 0
// is "yesterday". These six numbers are the whole tuning surface.
export const SURPLUS_KERNEL = [0.3, 0.15, 0.05] as const;
export const DEBT_KERNEL = [0.5, 0.25, 0.1] as const;

export type LedgerMode = "calories" | "sugar";

export interface DayLedger {
  date: string;
  base: number;
  bonus: number;
  credits: number;
  debits: number;
  leftover: number;
}

export function computeLedger(periods: Period[], today: string, mode: LedgerMode): DayLedger[] {
  if (periods.length === 0) return [];
  const start = periods[0].startDate;
  const days = daysBetween(start, today) + 1;
  if (days <= 0) return [];

  const debitsByDate = new Map<string, number>();
  const creditsByDate = new Map<string, number>();
  for (const p of periods) {
    for (const e of p.entries) {
      if (e.type === "debit") {
        const value = mode === "calories" ? e.amount : e.sugarG ?? 0;
        debitsByDate.set(e.date, (debitsByDate.get(e.date) ?? 0) + value);
      } else if (mode === "calories") {
        creditsByDate.set(e.date, (creditsByDate.get(e.date) ?? 0) + e.amount);
      }
    }
  }

  const budgetForDay = (date: string): number => {
    for (const p of periods) {
      if (daysBetween(p.startDate, date) >= 0 && daysBetween(date, p.endDate) >= 0) {
        return mode === "calories" ? p.budgetPerDay : p.sugarBudgetPerDay;
      }
    }
    // Past the last period's end (rollover not yet run today): use the
    // latest snapshot rather than pretending there is no budget.
    const last = periods[periods.length - 1];
    return mode === "calories" ? last.budgetPerDay : last.sugarBudgetPerDay;
  };

  const out: DayLedger[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    let bonus = 0;
    for (let k = 0; k < SURPLUS_KERNEL.length; k++) {
      const prev = out[i - 1 - k];
      if (!prev) break;
      bonus += prev.leftover * (prev.leftover >= 0 ? SURPLUS_KERNEL[k] : DEBT_KERNEL[k]);
    }
    const base = budgetForDay(date);
    const credits = creditsByDate.get(date) ?? 0;
    const debits = debitsByDate.get(date) ?? 0;
    out.push({ date, base, bonus, credits, debits, leftover: base + bonus + credits - debits });
  }
  return out;
}

export function todayLedger(periods: Period[], today: string, mode: LedgerMode): DayLedger | undefined {
  const ledger = computeLedger(periods, today, mode);
  return ledger[ledger.length - 1];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/carryover.test.ts`
Expected: PASS (all 10).

- [ ] **Step 5: Full suite + commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS.

```bash
git add src/lib/carryover.ts src/lib/carryover.test.ts
git -c commit.gpgsign=false commit -m "feat(sugar): decaying-carryover ledger engine (30/15/5 surplus, 50/25/10 debt)"
```

---

### Task 4: Dual-verdict sealing + sugar settings snapshot

**Files:**
- Modify: `src/lib/period.ts` (`rollover` sealing block, new `sugarConsumed` helper)
- Modify: `src/lib/store.ts:77-94` (`updateSettings`)
- Test: `src/lib/period.test.ts`, `src/lib/store.test.ts`

**Interfaces:**
- Consumes: `Period.sugarBudgetPerDay`, `Settings.sugarBudget` (Task 1).
- Produces: `sugarConsumed(entries: Entry[]): number` (exported from `period.ts`); sealed periods carry `sugarOutcome`.

- [ ] **Step 1: Write failing tests**

Append to `src/lib/period.test.ts` (its `settingsState` helper now includes `sugarBudget: 30` from Task 1):

```ts
test("sealing sets sugarOutcome from undecayed totals", () => {
  const base = rollover(settingsState(), "2026-07-01");
  // 14 days × 30 g = 420 g allowance. 400 g → under; 440 g → over.
  base.periods[0].entries = [entry({ type: "debit", amount: 100, sugarG: 400, date: "2026-07-02" })];
  expect(rollover(base, "2026-07-20").periods[0].sugarOutcome).toBe("under");
  base.periods[0].entries = [entry({ type: "debit", amount: 100, sugarG: 440, date: "2026-07-02" })];
  expect(rollover(base, "2026-07-20").periods[0].sugarOutcome).toBe("over");
});

test("sugarConsumed sums debit sugarG, treating unknown as 0 and ignoring credits", () => {
  expect(sugarConsumed([
    entry({ type: "debit", sugarG: 12 }),
    entry({ type: "debit" }),                    // unknown → 0
    entry({ type: "credit", sugarG: 99 }),       // credits never count
  ])).toBe(12);
});
```

Append to `src/lib/store.test.ts` (same `renderHook`/`act` harness as the file's existing `updateSettings` test at line 69; the fake-timer `beforeEach` already pins today to 2026-07-03, and the file's `settings` fixture gains `sugarBudget: 30` in Task 1):

```ts
test("hook: sugarBudget change rewrites the live period's sugar snapshot; sealed periods stay untouched", () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.completeOnboarding(settings));
  act(() => result.current.updateSettings({ sugarBudget: 25 }));
  expect(result.current.current!.sugarBudgetPerDay).toBe(25);

  const sealed: Period = {
    id: "sealed-1", startDate: "2026-06-17", endDate: "2026-06-30",
    budgetPerDay: 1700, sugarBudgetPerDay: 30, entries: [], outcome: "positive", sugarOutcome: "under",
  };
  const open: Period = {
    id: "open-1", startDate: "2026-07-01", endDate: "2026-07-14",
    budgetPerDay: 1800, sugarBudgetPerDay: 30, entries: [],
  };
  act(() => result.current.replaceState({ schemaVersion: 2, settings, periods: [sealed, open] }));
  act(() => result.current.updateSettings({ sugarBudget: 20 }));
  expect(result.current.state.periods[0]).toMatchObject({ sugarBudgetPerDay: 30, sugarOutcome: "under" });
  expect(result.current.current!.sugarBudgetPerDay).toBe(20);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/period.test.ts src/lib/store.test.ts`
Expected: FAIL — `sugarConsumed` not exported, `sugarOutcome` never set, snapshot not rewritten.

- [ ] **Step 3: Implement in `src/lib/period.ts`**

Add after `entryTotals`:

```ts
export function sugarConsumed(entries: Entry[]): number {
  let total = 0;
  for (const e of entries) if (e.type === "debit") total += e.sugarG ?? 0;
  return total;
}
```

In `rollover`'s sealing loop, after the `last.outcome = …` line:

```ts
const lengthDays = daysBetween(last.startDate, last.endDate) + 1;
last.sugarOutcome =
  sugarConsumed(last.entries) <= lengthDays * last.sugarBudgetPerDay ? "under" : "over";
```

- [ ] **Step 4: Implement in `src/lib/store.ts` (`updateSettings`)**

Extend the existing snapshot-rewrite condition:

```ts
const budgetNow = settings.tdee - settings.deficit;
const sugarNow = settings.sugarBudget;
if (
  last && !last.outcome &&
  (last.budgetPerDay !== budgetNow || last.sugarBudgetPerDay !== sugarNow)
) {
  const periods = [...s.periods];
  periods[idx] = { ...last, budgetPerDay: budgetNow, sugarBudgetPerDay: sugarNow };
  return { ...s, settings, periods };
}
```

- [ ] **Step 5: Run full suite, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS.

```bash
git add src/lib/period.ts src/lib/store.ts src/lib/period.test.ts src/lib/store.test.ts
git -c commit.gpgsign=false commit -m "feat(sugar): dual-verdict period sealing and live sugar-budget snapshot"
```

---

### Task 5: AI estimation of free sugars

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/store.ts:95-101` (`addEntry`, `updateEntry`)
- Test: `src/lib/ai.test.ts`

**Interfaces:**
- Consumes: `Entry.sugarG` (Task 1).
- Produces: `ParsedEntry.sugarG?: number`; `SCHEMA` with required `sugarG`; `updateEntry` patch type `Partial<Pick<Entry, "label" | "type" | "amount" | "sugarG">>` (Task 7's EditSheet relies on this).

- [ ] **Step 1: Write failing tests**

Read `src/lib/ai.test.ts` first and follow its existing mocking approach for any `parseEntry` tests. Add at minimum these SDK-free tests:

```ts
test("fallbackParse leaves sugarG undefined (unknown, counts 0)", () => {
  expect(fallbackParse("chocolate bar").sugarG).toBeUndefined();
  expect(fallbackParse("30 min run").sugarG).toBeUndefined();
});

test("SCHEMA requires sugarG so structured output always includes it", () => {
  expect(SCHEMA.required).toContain("sugarG");
  expect(SCHEMA.properties.sugarG.type).toBe("number");
});

test("systemPrompt states the free-sugar definition", () => {
  const p = systemPrompt();
  expect(p).toMatch(/free sugars/i);
  expect(p).toMatch(/whole fruit/i);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ai.test.ts`
Expected: FAIL on all three.

- [ ] **Step 3: Implement in `src/lib/ai.ts`**

`ParsedEntry` gains `sugarG?: number;`. `SCHEMA` becomes:

```ts
export const SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: "Short tidy description of what was logged" },
    type: { type: "string", enum: ["credit", "debit"], description: "credit = exercise performed, debit = food/drink consumed" },
    amount: { type: "number", description: "Estimated kcal, positive" },
    sugarG: {
      type: "number",
      description:
        "Estimated grams of free sugars: added sugars plus honey, syrups, fruit juice and smoothie content. " +
        "0 for sugars naturally present in whole fruit, vegetables, or plain milk, and 0 for exercise.",
    },
  },
  required: ["label", "type", "amount", "sugarG"],
  additionalProperties: false,
} as const;
```

`systemPrompt` gains one sentence before `statsLine`:

```ts
"Also estimate the item's free sugars in grams — added sugars plus honey, syrups, fruit juice and smoothies; " +
"do not count sugars naturally present in whole fruit, vegetables, or plain milk. Use 0 for exercise." +
```

`parseEntry` success path parses and clamps the new field:

```ts
const parsed = JSON.parse(block.text) as { label: string; type: EntryType; amount: number; sugarG: number };
return {
  label: parsed.label,
  type: parsed.type,
  amount: Math.max(0, Math.round(parsed.amount)),
  sugarG: Math.max(0, Math.round(parsed.sugarG)),
  source: "ai",
};
```

`fallbackParse` is unchanged (it never sets `sugarG`).

- [ ] **Step 4: Thread through the store (`src/lib/store.ts`)**

`addEntry`'s constructed entry gains `sugarG: parsed.sugarG,` (both union arms now carry the optional field). `updateEntry`'s patch type becomes `Partial<Pick<Entry, "label" | "type" | "amount" | "sugarG">>`.

- [ ] **Step 5: Run full suite, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS (fix any pre-existing `ai.test.ts` mock whose canned response now needs a `sugarG` field).

```bash
git add src/lib/ai.ts src/lib/ai.test.ts src/lib/store.ts
git -c commit.gpgsign=false commit -m "feat(sugar): AI estimates free-sugar grams per entry"
```

---

### Task 6: Dashboard — today's number, carry subline, sugar gauge

The visible behaviour change: the big number switches from period balance to **calories left today**.

**Files:**
- Create: `src/components/SugarGauge.tsx`
- Modify: `src/screens/Dashboard.tsx`
- Test: `src/screens/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `todayLedger` (Task 3), `sugarLevel`/`SUGAR_LEVEL_COLORS` (Task 2).
- Produces: `SugarGauge({ usedG, allowanceG })` component. No later task depends on Dashboard internals.

- [ ] **Step 1: Read `src/screens/Dashboard.test.tsx`, then write failing tests**

The file's harness: system time pinned to **2026-07-03** (day 3 of the anchor period), `settings` gives budget **1800 kcal/day** (and `sugarBudget: 30` after Task 1), and backdated entries are injected via `replaceState` exactly as the existing caption test (line 96) does. Existing assertions on "In credit this period"/"Overdrawn this period" must be updated to the new copy in Step 5. First add these failing tests (the shared fixture helper keeps the maths legible — day 1 always eats exactly its 1800 base so only day 2's leftover carries):

```tsx
const day = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), label: "x", type: "debit", amount: 0, date: "2026-07-01", source: "manual", ...over,
});

function renderWithEntries(entries: Entry[]) {
  const { hook, view } = setup();
  const { rerender } = view();
  const open: Period = {
    id: "open-1", startDate: "2026-07-01", endDate: "2026-07-14",
    budgetPerDay: 1800, sugarBudgetPerDay: 30, entries,
  };
  act(() => hook.result.current.replaceState({
    schemaVersion: 2, settings: hook.result.current.state.settings!, periods: [open],
  }));
  rerender(
    <Dashboard app={hook.result.current} settings={hook.result.current.state.settings!} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
  );
  return hook;
}

test("big number shows calories left today including the decayed bonus", () => {
  // Day 1: ate 1800 → leftover 0. Day 2: ate 1200 → leftover 600.
  // Today (day 3): bonus = 0.30×600 = 180, left = 1800 + 180 = 1980.
  renderWithEntries([
    day({ amount: 1800, date: "2026-07-01" }),
    day({ amount: 1200, date: "2026-07-02" }),
  ]);
  expect(screen.getByText("Left today")).toBeInTheDocument();
  expect(screen.getByText("+1980")).toBeInTheDocument();
  expect(screen.getByText(/includes \+180 fading bonus/)).toBeInTheDocument();
});

test("debt carry shows a negative subline", () => {
  // Day 1: ate 1800 → leftover 0. Day 2: ate 2800 → leftover −1000.
  // Today: bonus = 0.50×−1000 = −500, left = 1300.
  renderWithEntries([
    day({ amount: 1800, date: "2026-07-01" }),
    day({ amount: 2800, date: "2026-07-02" }),
  ]);
  expect(screen.getByText("+1300")).toBeInTheDocument();
  expect(screen.getByText(/−500 carried from yesterday/)).toBeInTheDocument();
});

test("sugar gauge shows used vs decayed allowance", () => {
  // Sugar: day 1 used 30 → leftover 0. Day 2 used 10 → leftover 20.
  // Today: bonus = 0.30×20 = 6 → allowance 36; today's entry has 12 g.
  renderWithEntries([
    day({ amount: 1800, sugarG: 30, date: "2026-07-01" }),
    day({ amount: 1800, sugarG: 10, date: "2026-07-02" }),
    day({ amount: 300, sugarG: 12, date: "2026-07-03" }),
  ]);
  expect(screen.getByText("12g of 36g")).toBeInTheDocument();
});
```

(Requires adding `Entry` to the file's type imports.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/Dashboard.test.tsx`
Expected: new tests FAIL (old headline still rendered).

- [ ] **Step 3: Create `src/components/SugarGauge.tsx`**

```tsx
import { colors, mono } from "../theme";
import { sugarLevel, SUGAR_LEVEL_COLORS } from "../lib/sugar";

interface SugarGaugeProps {
  usedG: number;      // grams consumed today
  allowanceG: number; // today's base + bonus (can dip ≤ 0 after sugar debt)
}

export default function SugarGauge({ usedG, allowanceG }: SugarGaugeProps) {
  const used = Math.round(usedG);
  const allowance = Math.max(0, Math.round(allowanceG));
  const over = used > allowance;
  const fraction = allowance > 0 ? Math.min(1, usedG / allowanceG) : 1;
  const fill = over ? colors.negative : SUGAR_LEVEL_COLORS[sugarLevel(used)];
  return (
    <div style={{ background: colors.card, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: colors.muted }}>Sugar today</span>
        <span style={{ fontFamily: mono, color: over ? colors.negative : colors.text }}>
          {used}g of {allowance}g
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: colors.divider, overflow: "hidden" }}>
        <div style={{ width: `${fraction * 100}%`, height: "100%", background: fill, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rework `src/screens/Dashboard.tsx`**

Add imports:

```tsx
import { todayLedger } from "../lib/carryover";
import SugarGauge from "../components/SugarGauge";
```

After the `if (!period) return null;` guard, replace the derivation block:

```tsx
const calToday = todayLedger(app.state.periods, app.today, "calories")!;
const sugarToday = todayLedger(app.state.periods, app.today, "sugar")!;
const leftToday = Math.round(calToday.leftover);
const bonusToday = Math.round(calToday.bonus);
const isPositive = leftToday >= 0;
const bal = balance(period, app.today); // still shown, now as secondary "period pace"
// …keep pace, entryTotals, budget-caption and sparkline derivations as they are.
```

Replace the main-balance JSX (`Dashboard.tsx:104-122`):

```tsx
{/* Today */}
<div style={{ textAlign: "center", marginBottom: 8 }}>
  <div style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
    {isPositive ? "Left today" : "Over today"}
  </div>
  <div style={{ fontFamily: mono, fontSize: 56, fontWeight: 700, color: isPositive ? colors.positive : colors.negative, lineHeight: 1 }}>
    {isPositive ? "+" : "−"}
    {Math.abs(leftToday)}
  </div>
  <div style={{ fontSize: 13, color: colors.faint, marginTop: 4 }}>
    kcal
    {bonusToday !== 0 && (
      <>
        {" · "}
        {bonusToday > 0
          ? `includes +${bonusToday} fading bonus`
          : `−${Math.abs(bonusToday)} carried from yesterday`}
      </>
    )}
  </div>
</div>

<SugarGauge usedG={sugarToday.debits} allowanceG={sugarToday.base + sugarToday.bonus} />
```

Then convert the old headline block into a compact secondary period line above the existing pace lines (keep those verbatim):

```tsx
<div style={{ textAlign: "center", color: colors.muted, fontSize: 14, marginBottom: 4 }}>
  period {bal >= 0 ? "+" : "−"}{Math.abs(bal)} ·{" "}
</div>
```

folded into the first pace line so it reads: `period +512 · averaging +256 kcal a day · 12 days to next period`. Concretely, change the "averaging" line (`Dashboard.tsx:124-131`) to:

```tsx
<div style={{ textAlign: "center", color: colors.muted, fontSize: 14, marginBottom: 4 }}>
  period{" "}
  <span style={{ color: bal >= 0 ? colors.positive : colors.negative }}>
    {bal >= 0 ? "+" : "−"}{Math.abs(bal)}
  </span>{" "}
  · averaging{" "}
  <span style={{ color: colors.text }}>
    {paceIsPositive ? "+" : "−"}{Math.abs(pace.avgPerDay)} kcal
  </span>{" "}
  a day · {pace.daysLeft} days to next period
</div>
```

Sparkline, stat row, entry list, composer, edit sheet: unchanged.

- [ ] **Step 5: Update stale Dashboard tests**

Any assertion on "In credit this period"/"Overdrawn this period" moves to the new copy ("Left today"/"Over today", period figure in the pace line). Keep test intent identical; only the selectors/copy change.

- [ ] **Step 6: Run full suite, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS.

```bash
git add src/components/SugarGauge.tsx src/screens/Dashboard.tsx src/screens/Dashboard.test.tsx
git -c commit.gpgsign=false commit -m "feat(sugar): dashboard shows today's decayed budget and sugar gauge"
```

---

### Task 7: Entry chips + EditSheet sugar field

**Files:**
- Modify: `src/components/EntryList.tsx`
- Modify: `src/components/EditSheet.tsx`
- Modify: `src/screens/Dashboard.tsx:207` (pass-through of the patch is already generic — verify only)
- Test: `src/components/EditSheet.test.tsx`

**Interfaces:**
- Consumes: `sugarLevel`/`SUGAR_LEVEL_COLORS` (Task 2), `updateEntry` patch with `sugarG` (Task 5).
- Produces: `EditSheet` `onSave` patch type widens to `{ label: string; type: EntryType; amount: number; sugarG?: number }`.

- [ ] **Step 1: Write failing tests (`src/components/EditSheet.test.tsx`, follow existing style)**

```tsx
test("saving a debit passes the sugar grams through", async () => {
  const onSave = vi.fn();
  render(<EditSheet entry={{ id: "1", label: "flapjack", type: "debit", amount: 300, sugarG: 18, date: "2026-07-19", source: "ai" }} onSave={onSave} onDelete={() => {}} onClose={() => {}} />);
  const sugar = screen.getByLabelText(/sugar/i);
  await userEvent.clear(sugar);
  await userEvent.type(sugar, "25");
  await userEvent.click(screen.getByText("Save"));
  expect(onSave).toHaveBeenCalledWith({ label: "flapjack", type: "debit", amount: 300, sugarG: 25 });
});

test("empty sugar field saves as unknown (undefined)", async () => {
  const onSave = vi.fn();
  render(<EditSheet entry={{ id: "1", label: "stew", type: "debit", amount: 400, date: "2026-07-19", source: "ai" }} onSave={onSave} onDelete={() => {}} onClose={() => {}} />);
  await userEvent.click(screen.getByText("Save"));
  expect(onSave).toHaveBeenCalledWith({ label: "stew", type: "debit", amount: 400, sugarG: undefined });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/EditSheet.test.tsx`
Expected: FAIL — no sugar input exists.

- [ ] **Step 3: Implement EditSheet changes**

Props: `onSave: (patch: { label: string; type: EntryType; amount: number; sugarG?: number }) => void;`

State + validity:

```tsx
const [sugar, setSugar] = useState(entry.sugarG != null ? String(entry.sugarG) : "");
const numericSugar = sugar.trim() === "" ? undefined : Number(sugar);
const sugarValid = numericSugar === undefined || (!Number.isNaN(numericSugar) && numericSugar >= 0);
const isValid = label.trim() !== "" && amount !== "" && !Number.isNaN(numericAmount) && numericAmount >= 0 && sugarValid;
```

`handleSave`:

```tsx
onSave({ label, type, amount: numericAmount, sugarG: type === "debit" ? numericSugar : undefined });
```

JSX after the Amount input, rendered only for debits:

```tsx
{type === "debit" && (
  <>
    <label style={labelStyle} htmlFor="edit-sheet-sugar">
      Sugar (g free sugars, blank = unknown)
    </label>
    <input
      id="edit-sheet-sugar"
      type="number"
      min="0"
      value={sugar}
      onChange={(e) => setSugar(e.target.value)}
      style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 18px" }}
    />
  </>
)}
```

- [ ] **Step 4: Implement the EntryList chip**

Import `sugarLevel, SUGAR_LEVEL_COLORS` from `../lib/sugar`. Wrap the amount in a right-side flex group and add the chip before it:

```tsx
<div style={{ display: "flex", alignItems: "center" }}>
  {entry.type === "debit" && entry.sugarG != null && (
    <span
      aria-label={`sugar level ${sugarLevel(entry.sugarG)}`}
      style={{
        fontFamily: mono, fontSize: 11, fontWeight: 700,
        color: colors.bg, background: SUGAR_LEVEL_COLORS[sugarLevel(entry.sugarG)],
        borderRadius: 6, padding: "2px 6px", marginRight: 8,
      }}
    >
      S{sugarLevel(entry.sugarG)}
    </span>
  )}
  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: entry.type === "credit" ? colors.positive : colors.negative }}>
    {entry.type === "credit" ? "+" : "−"}
    {entry.amount}
  </span>
</div>
```

- [ ] **Step 5: Run full suite, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS.

```bash
git add src/components/EntryList.tsx src/components/EditSheet.tsx src/components/EditSheet.test.tsx
git -c commit.gpgsign=false commit -m "feat(sugar): entry-list level chips and EditSheet sugar field"
```

---

### Task 8: Day dividers with per-day summaries

The entry list gains a divider row at each date change — a visual break per day carrying that day's outcome ("finished +130 kcal · 38g sugar"), fed by the same ledger the dashboard uses.

**Files:**
- Modify: `src/components/EntryList.tsx`
- Modify: `src/screens/Dashboard.tsx` (swap `todayLedger` for `computeLedger`, pass summaries down)
- Test: Create `src/components/EntryList.test.tsx`

**Interfaces:**
- Consumes: `computeLedger` (Task 3).
- Produces: `DaySummary { kcalLeftover: number; sugarUsedG: number }` and new optional `EntryList` props `daySummaries?: Record<string, DaySummary>`, `today?: string`. When `daySummaries` is omitted the list renders exactly as before (no dividers).

- [ ] **Step 1: Write failing tests (`src/components/EntryList.test.tsx`, new file)**

```tsx
import { render, screen } from "@testing-library/react";
import EntryList from "./EntryList";
import type { Entry } from "../lib/types";

const e = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), label: "item", type: "debit", amount: 300, date: "2026-07-02", source: "manual", ...over,
});

test("groups entries under day dividers with per-day summaries", () => {
  render(
    <EntryList
      entries={[e({ date: "2026-07-03", label: "lunch" }), e({ date: "2026-07-02", label: "dinner" })]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{
        "2026-07-03": { kcalLeftover: 1980, sugarUsedG: 12.4 },
        "2026-07-02": { kcalLeftover: -220, sugarUsedG: 38 },
      }}
    />
  );
  // Today's divider is label-only — its live numbers already headline the dashboard.
  expect(screen.getByText("Today")).toBeInTheDocument();
  expect(screen.queryByText(/1980/)).not.toBeInTheDocument();
  // Past days carry their sealed result.
  expect(screen.getByText("2 Jul")).toBeInTheDocument();
  expect(screen.getByText("finished −220 kcal · 38g sugar")).toBeInTheDocument();
});

test("renders the old flat list when no daySummaries are provided", () => {
  render(<EntryList entries={[e({})]} onSelect={() => {}} />);
  expect(screen.queryByText(/finished/)).not.toBeInTheDocument();
  expect(screen.getByText("item")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/EntryList.test.tsx`
Expected: FAIL — no dividers rendered, props not accepted.

- [ ] **Step 3: Implement dividers in `src/components/EntryList.tsx`**

Add to the props/types:

```tsx
export interface DaySummary {
  kcalLeftover: number; // that day's ledger leftover (positive = finished under)
  sugarUsedG: number;   // grams of free sugars consumed that day
}

interface EntryListProps {
  entries: Entry[];
  onSelect: (e: Entry) => void;
  pendingText?: string | null;
  daySummaries?: Record<string, DaySummary>; // keyed by ISO date; enables dividers
  today?: string;                            // ISO date rendered as "Today"
}
```

Replace the `entries.map(…)` body with a flat node list that inserts a divider whenever the date changes (entries are already newest-first):

```tsx
const rows: React.ReactNode[] = [];
let prevDate: string | null = null;
entries.forEach((entry, idx) => {
  if (daySummaries && entry.date !== prevDate) {
    const summary = daySummaries[entry.date];
    const isToday = entry.date === today;
    rows.push(
      <div
        key={`divider-${entry.date}`}
        style={{
          padding: "7px 16px",
          background: colors.bg,
          borderTop: prevDate ? `1px solid ${colors.divider}` : "none",
          borderBottom: `1px solid ${colors.divider}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: colors.muted }}>
          {isToday ? "Today" : formatDate(entry.date)}
        </span>
        {!isToday && summary && (
          <span style={{ fontFamily: mono, fontSize: 11, color: summary.kcalLeftover >= 0 ? colors.positive : colors.negative }}>
            finished {summary.kcalLeftover >= 0 ? "+" : "−"}
            {Math.abs(Math.round(summary.kcalLeftover))} kcal · {Math.round(summary.sugarUsedG)}g sugar
          </span>
        )}
      </div>
    );
  }
  prevDate = entry.date;
  rows.push(/* the existing entry row JSX, unchanged (including the Task 7 chip) */);
});
return (
  <div style={{ background: colors.card, borderRadius: 16, overflow: "hidden" }}>
    {/* existing pendingText block unchanged */}
    {rows}
  </div>
);
```

When dividers are active, drop the per-entry `borderBottom` logic's dependence on `idx` being last (the divider rows carry the separation); keep it for the no-divider path. Also drop the `{formatDate(entry.date)} · ` prefix from each row's caption **only when `daySummaries` is provided** (the divider now states the date):

```tsx
<div style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>
  {daySummaries ? sourceCaption(entry.source) : `${formatDate(entry.date)} · ${sourceCaption(entry.source)}`}
</div>
```

- [ ] **Step 4: Feed summaries from `src/screens/Dashboard.tsx`**

Replace the Task 6 `todayLedger` derivation with the full ledgers (same import path):

```tsx
import { computeLedger } from "../lib/carryover";
// …
const calLedger = computeLedger(app.state.periods, app.today, "calories");
const sugarLedger = computeLedger(app.state.periods, app.today, "sugar");
const calToday = calLedger[calLedger.length - 1]!;
const sugarToday = sugarLedger[sugarLedger.length - 1]!;
const daySummaries = Object.fromEntries(
  calLedger.map((d, i) => [d.date, { kcalLeftover: d.leftover, sugarUsedG: sugarLedger[i].debits }]),
);
```

and pass them down:

```tsx
<EntryList entries={period.entries} onSelect={handleSelect} pendingText={pendingText} daySummaries={daySummaries} today={app.today} />
```

- [ ] **Step 5: Run full suite, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS (update any Dashboard test that asserted the old `"3 Jul · AI logged"`-style caption if one exists).

```bash
git add src/components/EntryList.tsx src/components/EntryList.test.tsx src/screens/Dashboard.tsx
git -c commit.gpgsign=false commit -m "feat(sugar): day dividers with per-day calorie/sugar summaries"
```

---

### Task 9: Settings input + dual-verdict stamps

**Files:**
- Modify: `src/screens/Settings.tsx` (budget card)
- Modify: `src/screens/Stamps.tsx` (`Stamp` component)
- Test: `src/screens/Settings.test.tsx`, `src/screens/Stamps.test.tsx`

**Interfaces:**
- Consumes: `Settings.sugarBudget`, `Period.sugarOutcome` (Tasks 1, 4).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write failing tests (follow each file's existing style)**

`Settings.test.tsx` (same `renderHook(() => useAppState())` + `render(<SettingsScreen …>)` harness as the file's "saves budget changes" test at line 27; its `settings` fixture gains `sugarBudget: 30` in Task 1; the budget card's Save button matches `/^save$/i`):

```tsx
test("saving a changed sugar budget persists it and updates the live period", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  const input = screen.getByLabelText(/sugar budget/i);
  await user.clear(input);
  await user.type(input, "25");
  await user.click(screen.getByRole("button", { name: /^save$/i }));
  expect(hook.result.current.state.settings!.sugarBudget).toBe(25);
});
```

`Stamps.test.tsx` (extend the file's `p()` fixture helper — it gains `sugarBudgetPerDay: 30` in Task 1 — with an optional `sugarOutcome` argument):

```tsx
const p = (n: number, outcome?: "positive" | "negative", sugarOutcome?: "under" | "over"): Period => ({
  id: String(n), startDate: "2026-07-01", endDate: "2026-07-14",
  budgetPerDay: 1800, sugarBudgetPerDay: 30, entries: [], outcome, sugarOutcome,
});

test("sealed periods show the sugar verdict when present", () => {
  render(<Stamps periods={[p(1, "positive", "over")]} onBack={() => {}} />);
  expect(screen.getByText("SUGAR OVER")).toBeInTheDocument();
});

test("legacy sealed periods without sugarOutcome show no sugar mark", () => {
  render(<Stamps periods={[p(1, "positive")]} onBack={() => {}} />);
  expect(screen.queryByText(/SUGAR/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/Settings.test.tsx src/screens/Stamps.test.tsx`
Expected: new tests FAIL.

- [ ] **Step 3: Implement Settings field**

In `src/screens/Settings.tsx`:
- State: `const [sugarInput, setSugarInput] = useState(settings ? String(settings.sugarBudget) : "");`
- `DirtyField` union gains `"sugarBudget"`.
- Resync effect gains: `if (!dirty.has("sugarBudget")) setSugarInput(String(settings.sugarBudget));`
- Validity: `const sugarNum = Number(sugarInput); const sugarBudgetValid = sugarInput.trim() !== "" && sugarNum >= 0;` and AND it into `budgetValid`'s use in `handleSaveBudget`.
- `handleSaveBudget` gains: `if (dirty.has("sugarBudget")) patch.sugarBudget = sugarNum;` and clears `"sugarBudget"`.
- JSX: directly after the deficit input in the budget card (search for the deficit `<input`), add:

```tsx
<label style={labelStyle} htmlFor="settings-sugar-budget">
  Daily sugar budget (g free sugars)
</label>
<input
  id="settings-sugar-budget"
  type="number"
  min="0"
  value={sugarInput}
  onChange={(e) => { setSugarInput(e.target.value); markDirty("sugarBudget"); }}
  style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
/>
```

- [ ] **Step 4: Implement Stamps mark**

In the `Stamp` component (`src/screens/Stamps.tsx:61-98`), after the final-balance span:

```tsx
{period.sugarOutcome && (
  <span
    style={{
      fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      color: period.sugarOutcome === "under" ? colors.positive : colors.negative,
    }}
  >
    SUGAR {period.sugarOutcome === "under" ? "UNDER" : "OVER"}
  </span>
)}
```

- [ ] **Step 5: Run full suite, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS.

```bash
git add src/screens/Settings.tsx src/screens/Stamps.tsx src/screens/Settings.test.tsx src/screens/Stamps.test.tsx
git -c commit.gpgsign=false commit -m "feat(sugar): settings sugar budget and dual-verdict stamps"
```

---

### Task 10: Eval harness — sugar accuracy column

**Files:**
- Modify: `eval/fixtures.ts`, `eval/score.ts`, `eval/run.ts`
- Test: `eval/score.test.ts`

**Interfaces:**
- Consumes: `SCHEMA`/`systemPrompt` (already imported by `run.ts` — request shape updates automatically).
- Produces: `Fixture.sugarRange: [number, number]`; `ParsedResult.sugarG: number` (both copies); `ScoreResult.sugarInRange`, `ScoredCall.sugarInRange`, `ModelSummary.sugarInRangePct`.

- [ ] **Step 1: Write failing tests (append to `eval/score.test.ts`)**

```ts
test("scoreCall checks sugarG against the fixture's sugarRange", () => {
  const fixture = { text: "cola", expectedType: "debit" as const, kcalRange: [180, 250] as [number, number], sugarRange: [40, 60] as [number, number] };
  expect(scoreCall({ label: "cola", type: "debit", amount: 210, sugarG: 53 }, fixture).sugarInRange).toBe(true);
  expect(scoreCall({ label: "cola", type: "debit", amount: 210, sugarG: 5 }, fixture).sugarInRange).toBe(false);
});

test("summarize reports sugarInRangePct", () => {
  const call = { ms: 1, inputTokens: 0, outputTokens: 0, error: false, typeCorrect: true, kcalInRange: true, sugarInRange: true };
  expect(summarize([call, { ...call, sugarInRange: false }], null).sugarInRangePct).toBe(50);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run eval/score.test.ts`
Expected: FAIL — types/fields missing.

- [ ] **Step 3: Update `eval/fixtures.ts`**

`Fixture` gains `sugarRange: [number, number];`. Ranges for existing fixtures (exercise is always `[0, 0]`):

```ts
{ text: "chicken sandwich and a coffee", expectedType: "debit", kcalRange: [400, 700], sugarRange: [0, 12] },
{ text: "toast + eggs", expectedType: "debit", kcalRange: [250, 500], sugarRange: [0, 8] },
{ text: "large pepperoni pizza, whole", expectedType: "debit", kcalRange: [1500, 2600], sugarRange: [0, 30] },
{ text: "cheeseburger and fries", expectedType: "debit", kcalRange: [700, 1200], sugarRange: [0, 18] },
{ text: "bowl of cereal with milk", expectedType: "debit", kcalRange: [150, 400], sugarRange: [3, 30] },
{ text: "medium banana", expectedType: "debit", kcalRange: [80, 150], sugarRange: [0, 3] },
{ text: "100 press ups", expectedType: "credit", kcalRange: [20, 120], sugarRange: [0, 0] },
{ text: "30 min run", expectedType: "credit", kcalRange: [250, 450], sugarRange: [0, 0] },
{ text: "45 minute gym session, weights", expectedType: "credit", kcalRange: [200, 500], sugarRange: [0, 0] },
{ text: "20 minute swim", expectedType: "credit", kcalRange: [150, 350], sugarRange: [0, 0] },
{ text: "yoga session", expectedType: "credit", kcalRange: [100, 300], sugarRange: [0, 0] },
{ text: "5k run", expectedType: "credit", kcalRange: [250, 500], sugarRange: [0, 0] },
{ text: "2 pints of lager", expectedType: "debit", kcalRange: [300, 600], sugarRange: [0, 10] },
{ text: "10k run", expectedType: "credit", kcalRange: [500, 900], sugarRange: [0, 0] },
{ text: "big bowl of pasta", expectedType: "debit", kcalRange: [500, 900], sugarRange: [0, 15] },
{ text: "a handful of nuts", expectedType: "debit", kcalRange: [80, 250], sugarRange: [0, 4] },
{ text: "walked to work", expectedType: "credit", kcalRange: [50, 250], sugarRange: [0, 0] },
{ text: "protein shake", expectedType: "debit", kcalRange: [100, 300], sugarRange: [0, 25] },
```

New definition-probing fixtures (append):

```ts
// Free-sugar definition probes: whole fruit and plain milk must score ~0;
// juice, honey, and cola must not.
{ text: "an apple", expectedType: "debit", kcalRange: [50, 120], sugarRange: [0, 3] },
{ text: "large glass of orange juice", expectedType: "debit", kcalRange: [80, 200], sugarRange: [15, 40] },
{ text: "porridge with a big drizzle of honey", expectedType: "debit", kcalRange: [250, 500], sugarRange: [8, 25] },
{ text: "500ml bottle of coca cola", expectedType: "debit", kcalRange: [180, 250], sugarRange: [40, 60] },
{ text: "glass of whole milk", expectedType: "debit", kcalRange: [120, 220], sugarRange: [0, 3] },
```

- [ ] **Step 4: Update `eval/score.ts`**

`ParsedResult` gains `sugarG: number;`. `ScoreResult` gains `sugarInRange: boolean;` and `scoreCall` adds:

```ts
const [slo, shi] = fixture.sugarRange;
const sugarInRange = parsed.sugarG >= slo && parsed.sugarG <= shi;
```

`ScoredCall` gains `sugarInRange: boolean;`; `ModelSummary` gains `sugarInRangePct: number;`; `summarize` computes it exactly like `kcalInRangePct`.

- [ ] **Step 5: Update `eval/run.ts`**

Its local `ParsedResult` gains `sugarG: number;`. `toScoredCall` error branch adds `sugarInRange: false`, success branch passes it through. Summary table gains `sugarInRange: \`${s.sugarInRangePct.toFixed(0)}%\``. Per-fixture table cell becomes:

```ts
fixtureTable[raw.fixture.text][raw.model] = raw.error ? "ERROR" : `${raw.parsed!.type}/${raw.parsed!.amount}/${raw.parsed!.sugarG}g`;
```

- [ ] **Step 6: Run tests, commit**

Run: `npx tsc -b --noEmit && npx vitest run` — expected PASS.

```bash
git add eval
git -c commit.gpgsign=false commit -m "feat(sugar): eval scores free-sugar gram accuracy with definition probes"
```

---

### Task 11: Verification — full suite, build, live eval

**Files:** none created; this is the release gate.

- [ ] **Step 1: Full verification**

Run: `npx tsc -b --noEmit && npx vitest run && npm run build`
Expected: all PASS, build succeeds.

- [ ] **Step 2: Run the live eval**

Requires `ANTHROPIC_API_KEY` in `.env` (see `eval/run.ts` header). Run: `npm run eval`
Expected: for the default model (`claude-sonnet-4-6`): type accuracy and kcal-in-range at parity with the pre-change baseline (`eval/results-2026-07-18-225530.json`), and **sugar-in-range ≥ ~80%, with "an apple" and "glass of whole milk" scoring near 0 g**. If the free-sugar definition probes fail, iterate on the `systemPrompt` sentence (not the fixtures) and re-run. If no API key is available, stop and flag this to the user — do not skip silently.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` — with a fresh profile (or after clearing the storage key): onboard, log "can of coke" (expect a sugar chip S4/S5), check the gauge moves, edit the entry's sugar, check Settings saves a new sugar budget. With a pre-existing v1 localStorage blob: confirm it loads migrated (balance visible, no reset).

- [ ] **Step 4: Final commit (if smoke fixes were needed)**

```bash
git add -A src eval
git -c commit.gpgsign=false commit -m "fix(sugar): post-smoke-test adjustments"
```
