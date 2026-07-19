# Meal Breaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user insert a small labelled meal break (breakfast / snack / lunch / dinner / late night snack) between ledger entries via a button above the entry list.

**Architecture:** A `MealBreak` is a new marker item stored in the same `Period.entries` array as food/exercise entries (array position = ledger order; newest prepends to the top). Widening `Period.entries` to `LedgerItem[] = Entry | MealBreak` makes `tsc` flag every consumer, and each summation site skips markers via an `isMealBreak` type guard. `schemaVersion` bumps 2→3 with an identity migration. Spec: `docs/superpowers/specs/2026-07-19-meal-breaks-design.md`.

**Tech Stack:** React 19 + TypeScript + Vite, vitest + @testing-library/react (globals enabled: `test`/`expect`/`vi` need no import), inline styles from `src/theme.ts`, localStorage persistence.

## Global Constraints

- Work on branch `feat/meal-breaks` (created in Task 1, Step 0).
- **Commit unsigned**: 1Password signing is unavailable this session — always commit with `git -c commit.gpgsign=false commit …`.
- Meal names, exact copy: `"breakfast" | "snack" | "lunch" | "dinner" | "late night snack"` (lowercase in data; UI renders uppercase via CSS `textTransform`).
- `STORAGE_KEY` stays `"daily-dosh-food:v1"` (the key name is historic; the version lives in `schemaVersion`).
- No new dependencies. Inline styles only, colors from `src/theme.ts`. Match existing code style (2-space indent, double quotes, semicolons).
- Verify with `npm test` and `npm run check` (tsc --noEmit); both must be green at every commit.

---

### Task 1: Data model, migration, and marker-safe maths

Widens the ledger to `LedgerItem[]`, bumps the schema to v3, and makes every calorie/sugar summation skip markers. This is one atomic task because the type ripple is atomic — the repo only compiles once all consumers are updated.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/period.ts` (`entryTotals`, `sugarConsumed`)
- Modify: `src/lib/carryover.ts` (`computeLedger` inner loop)
- Modify: `src/lib/store.ts` (`migrate`, `mutateCurrent`, `updateEntry`)
- Modify: `src/components/EntryList.tsx` (prop type widening + temporary filter)
- Test: `src/lib/types.test.ts`, `src/lib/period.test.ts`, `src/lib/carryover.test.ts`, `src/lib/store.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (later tasks rely on these exact names):
  - `MEAL_NAMES: readonly ["breakfast", "snack", "lunch", "dinner", "late night snack"]` (types.ts)
  - `type MealName = (typeof MEAL_NAMES)[number]` (types.ts)
  - `interface MealBreak { kind: "meal-break"; id: string; meal: MealName; date: string }` (types.ts)
  - `type LedgerItem = Entry | MealBreak` (types.ts)
  - `isMealBreak(item: LedgerItem): item is MealBreak` (types.ts)
  - `Period.entries: LedgerItem[]`; `AppState.schemaVersion: 3`
  - `entryTotals(items: LedgerItem[])`, `sugarConsumed(items: LedgerItem[])` — same return types as today

- [ ] **Step 0: Create the branch**

```bash
cd /Users/joshuajosai-levin/Code/daily-dosh-food
git checkout -b feat/meal-breaks
```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/types.test.ts`:

```ts
import { isMealBreak } from "./types";
import type { Entry, MealBreak } from "./types";

test("isMealBreak discriminates breaks from entries", () => {
  const brk: MealBreak = { kind: "meal-break", id: "b", meal: "dinner", date: "2026-07-01" };
  const entry: Entry = { id: "e", label: "toast", type: "debit", amount: 300, date: "2026-07-01", source: "manual" };
  expect(isMealBreak(brk)).toBe(true);
  expect(isMealBreak(entry)).toBe(false);
});
```

(If `types.test.ts` already imports from `./types`, merge into the existing import lines instead of duplicating them.)

Append to `src/lib/period.test.ts`:

```ts
test("entryTotals and sugarConsumed ignore meal breaks", () => {
  const items: LedgerItem[] = [
    { id: "e1", label: "toast", type: "debit", amount: 300, sugarG: 10, date: "2026-07-01", source: "manual" },
    { kind: "meal-break", id: "b1", meal: "lunch", date: "2026-07-01" },
    { id: "e2", label: "run", type: "credit", amount: 200, date: "2026-07-01", source: "manual" },
  ];
  expect(entryTotals(items)).toEqual({ consumed: 300, earned: 200 });
  expect(sugarConsumed(items)).toBe(10);
});
```

(Add `LedgerItem` to the type imports at the top of the file, and `entryTotals`/`sugarConsumed` to the period imports if not already there.)

Append to `src/lib/carryover.test.ts` (match the file's existing Period-literal style):

```ts
test("computeLedger ignores meal breaks in both modes", () => {
  const period: Period = {
    id: "p", startDate: "2026-07-01", endDate: "2026-07-14",
    budgetPerDay: 1800, sugarBudgetPerDay: 30,
    entries: [
      { id: "e1", label: "toast", type: "debit", amount: 500, sugarG: 12, date: "2026-07-01", source: "manual" },
      { kind: "meal-break", id: "b1", meal: "breakfast", date: "2026-07-01" },
    ],
  };
  expect(computeLedger([period], "2026-07-01", "calories")[0].debits).toBe(500);
  expect(computeLedger([period], "2026-07-01", "sugar")[0].debits).toBe(12);
});
```

In `src/lib/store.test.ts`, update the migration tests and add v2→v3:

```ts
// CHANGE the existing "loadState migrates a v1 blob to schema v2..." assertion:
//   expect(s.schemaVersion).toBe(2);  →  expect(s.schemaVersion).toBe(3);
// (test name: "loadState migrates a v1 blob to schema v3 with sugar defaults")

// CHANGE "importJSON accepts v1 exports and migrates them":
//   expect(importJSON(JSON.stringify(v1)).schemaVersion).toBe(2);  →  .toBe(3);
//   expect(() => importJSON(JSON.stringify({ schemaVersion: 3, periods: [] }))).toThrow();
//     →  expect(() => importJSON(JSON.stringify({ schemaVersion: 99, periods: [] }))).toThrow();

// ADD:
test("loadState stamps a v2 blob to schema v3, contents untouched", () => {
  const v2 = {
    schemaVersion: 2,
    settings: { tdee: 2300, deficit: 500, sugarBudget: 25, anchorDate: "2026-07-01", periodLengthDays: 14, model: "m" },
    periods: [{ id: "p1", startDate: "2026-07-01", endDate: "2026-07-14", budgetPerDay: 1800, sugarBudgetPerDay: 25, entries: [] }],
  };
  const s = loadState(memStorage({ "daily-dosh-food:v1": JSON.stringify(v2) }));
  expect(s.schemaVersion).toBe(3);
  expect(s.settings?.sugarBudget).toBe(25);
  expect(s.periods).toEqual(v2.periods);
});
```

Also in `store.test.ts`, the two `replaceState` tests build literal states with `schemaVersion: 2` (lines ~93 and ~115) — change both to `schemaVersion: 3` (the `AppState` type will require it). The existing "loadState passes a v2 blob through untouched" test's *name* is now wrong — rename it to "loadState accepts a v2 blob (now stamped v3)" and keep its `sugarBudget` assertion.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- --run 2>&1 | tail -30`
Expected: FAIL — `isMealBreak` not exported, `LedgerItem` not exported, v2 blob currently passes through with `schemaVersion: 2`.

- [ ] **Step 3: Implement `src/lib/types.ts` additions**

After the `Entry` interface, add:

```ts
export const MEAL_NAMES = ["breakfast", "snack", "lunch", "dinner", "late night snack"] as const;
export type MealName = (typeof MEAL_NAMES)[number];

// A meal break is a marker row in the ledger, not food: it carries no amount
// and must be skipped by every calorie/sugar summation.
export interface MealBreak {
  kind: "meal-break";
  id: string;
  meal: MealName;
  date: string;          // ISO yyyy-mm-dd (local), same semantics as Entry.date
}

export type LedgerItem = Entry | MealBreak;

// Entry has no `kind` field (so v2 data needed no rewrite) — presence of
// `kind` is the discriminant.
export const isMealBreak = (item: LedgerItem): item is MealBreak =>
  "kind" in item && item.kind === "meal-break";
```

Then change `Period.entries` from `Entry[]` to `LedgerItem[]`, change `AppState.schemaVersion` from `2` to `3`, and change `emptyState` to return `{ schemaVersion: 3, periods: [] }`.

- [ ] **Step 4: Make the maths skip markers**

`src/lib/period.ts` — add `isMealBreak` and `LedgerItem` to the type import from `./types`, then:

```ts
export function entryTotals(items: LedgerItem[]): { consumed: number; earned: number } {
  let consumed = 0, earned = 0;
  for (const e of items) {
    if (isMealBreak(e)) continue;
    e.type === "debit" ? (consumed += e.amount) : (earned += e.amount);
  }
  return { consumed, earned };
}

export function sugarConsumed(items: LedgerItem[]): number {
  let total = 0;
  for (const e of items) if (!isMealBreak(e) && e.type === "debit") total += e.sugarG ?? 0;
  return total;
}
```

`dailySugarGrams` and `dailyBalances` filter by `.date` (present on both union arms) and then call the two functions above — they need no change beyond compiling.

`src/lib/carryover.ts` — import `isMealBreak` from `./types`; in `computeLedger`'s entry loop add the skip as the first line:

```ts
    for (const e of p.entries) {
      if (isMealBreak(e)) continue;
      if (e.type === "debit") {
```

- [ ] **Step 5: Update `src/lib/store.ts`**

Import `isMealBreak` and the `LedgerItem` type from `./types`. Replace `migrate`:

```ts
// Returns a valid v3 state, or null if the blob is unrecognisable.
export function migrate(parsed: unknown): AppState | null {
  const s = parsed as { schemaVersion?: unknown; periods?: unknown };
  if (!s || !Array.isArray(s.periods)) return null;
  if (s.schemaVersion === 3) return parsed as AppState;
  // v2 → v3 is identity: meal breaks are additive, existing entries are untouched.
  if (s.schemaVersion === 2) return { ...(parsed as Omit<AppState, "schemaVersion">), schemaVersion: 3 };
  if (s.schemaVersion === 1) {
    const v1 = parsed as AppStateV1;
    return {
      schemaVersion: 3,
      settings: v1.settings ? { ...v1.settings, sugarBudget: DEFAULT_SUGAR_BUDGET_G } : undefined,
      periods: v1.periods.map((p) => ({ ...p, sugarBudgetPerDay: DEFAULT_SUGAR_BUDGET_G })),
    };
  }
  return null;
}
```

Widen `mutateCurrent` and guard `updateEntry` so a patch can never smear onto a marker:

```ts
  const mutateCurrent = (fn: (items: LedgerItem[]) => LedgerItem[]) =>
```

```ts
    updateEntry: (id: string, patch: Partial<Pick<Entry, "label" | "type" | "amount" | "sugarG">>) =>
      mutateCurrent((items) => items.map((e) => (!isMealBreak(e) && e.id === id ? { ...e, ...patch } : e))),
    deleteEntry: (id: string) => mutateCurrent((items) => items.filter((e) => e.id !== id)),
```

`addEntry` needs no change beyond the `mutateCurrent` signature (an `Entry` is a valid `LedgerItem`).

- [ ] **Step 6: Temporarily hide markers in `src/components/EntryList.tsx`**

Widen the prop and filter at the top so the repo compiles and behaves identically until Task 3 renders breaks. Change the props interface: `entries: LedgerItem[]` (import `LedgerItem` and `isMealBreak` from `../lib/types`). Then, as the first line of the component body:

```ts
  // Temporary until the break-rendering task: hide meal breaks from the list.
  const visible = entries.filter((i): i is Entry => !isMealBreak(i));
```

and replace every use of `entries` below it with `visible` (the `forEach`, the `entries[idx + 1]` border checks, and the `entries.length > 0` check in the pending row).

- [ ] **Step 7: Run everything**

Run: `npm test -- --run 2>&1 | tail -15` — Expected: all PASS.
Run: `npm run check` — Expected: clean exit, no output.

- [ ] **Step 8: Commit**

```bash
git add -A src
git -c commit.gpgsign=false commit -m "feat(meal-breaks): LedgerItem data model, v3 migration, marker-safe maths"
```

---

### Task 2: Store API — add, rename

**Files:**
- Modify: `src/lib/store.ts` (the `useAppState` return object)
- Test: `src/lib/store.test.ts`

**Interfaces:**
- Consumes: `MealName`, `MealBreak`, `isMealBreak`, `LedgerItem` from `../lib/types` (Task 1); `mutateCurrent` already widened.
- Produces (Task 4 wires these to the UI):
  - `addMealBreak(meal: MealName): void` — prepends `{ kind: "meal-break", id, meal, date: today }`
  - `updateMealBreak(id: string, meal: MealName): void`
  - Deletion is the existing `deleteEntry(id)` (works on any ledger item — both union arms have `id`).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/store.test.ts` (add `entryTotals` to imports from `./period`, and `MealBreak` to the type imports):

```ts
test("hook: addMealBreak prepends a dated marker; rename and delete work; markers never count as food", () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.completeOnboarding(settings));
  act(() => result.current.addEntry({ label: "toast", type: "debit", amount: 300, source: "manual" }));
  act(() => result.current.addMealBreak("lunch"));

  const items = result.current.current!.entries;
  expect(items[0]).toMatchObject({ kind: "meal-break", meal: "lunch", date: result.current.today });
  expect(entryTotals(items)).toEqual({ consumed: 300, earned: 0 });

  const id = (items[0] as MealBreak).id;
  act(() => result.current.updateMealBreak(id, "dinner"));
  expect(result.current.current!.entries[0]).toMatchObject({ meal: "dinner" });

  act(() => result.current.deleteEntry(id));
  expect(result.current.current!.entries).toHaveLength(1);
  // persisted
  expect(loadState().periods[0].entries).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/store.test.ts 2>&1 | tail -15`
Expected: FAIL — `addMealBreak is not a function`.

- [ ] **Step 3: Implement**

In `useAppState`'s return object, directly after `addEntry` (import `MealName` type from `./types`):

```ts
    addMealBreak: (meal: MealName) =>
      mutateCurrent((items) => [
        { kind: "meal-break", id: crypto.randomUUID(), meal, date: today },
        ...items,
      ]),
    updateMealBreak: (id: string, meal: MealName) =>
      mutateCurrent((items) => items.map((i) => (isMealBreak(i) && i.id === id ? { ...i, meal } : i))),
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run 2>&1 | tail -10` — Expected: all PASS.
Run: `npm run check` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git -c commit.gpgsign=false commit -m "feat(meal-breaks): store addMealBreak/updateMealBreak"
```

---

### Task 3: Render breaks in the ledger with in-place chip editing

**Files:**
- Create: `src/components/MealBreakChips.tsx`
- Modify: `src/components/EntryList.tsx` (remove the temporary filter; render breaks)
- Test: `src/components/EntryList.test.tsx`

**Interfaces:**
- Consumes: `MEAL_NAMES`, `MealName`, `MealBreak`, `LedgerItem`, `isMealBreak` (Task 1).
- Produces:
  - `MealBreakChips({ current?: MealName; onPick: (meal: MealName) => void; onDelete?: () => void })` — default export; Task 4 reuses it for the insert picker.
  - `EntryList` gains optional props `onRenameBreak?: (id: string, meal: MealName) => void` and `onDeleteBreak?: (id: string) => void`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/EntryList.test.tsx` (extend the type import to `import type { Entry, MealBreak, MealName } from "../lib/types";` and add `fireEvent` to the testing-library import):

```tsx
const mb = (meal: MealName, date: string): MealBreak => ({
  kind: "meal-break", id: crypto.randomUUID(), meal, date,
});

test("renders a meal break as a small labelled rule; the entry above it drops its own border", () => {
  render(
    <EntryList
      entries={[e({ date: "2026-07-03", label: "coffee" }), mb("lunch", "2026-07-03"), e({ date: "2026-07-03", label: "porridge" })]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{ "2026-07-03": { kcalLeftover: 100, sugarUsedG: 5 } }}
    />
  );
  const brk = screen.getByRole("button", { name: "lunch break" });
  expect(brk).toBeInTheDocument();
  // Subordinate to the day divider: no background fill on the break row.
  expect((brk as HTMLElement).style.background).toBe("");
  // The break line is the separator — the entry above draws no border of its own.
  expect((screen.getByRole("button", { name: "coffee" }) as HTMLElement).style.borderBottomStyle).toBe("none");
});

test("tapping a break opens the chip editor; picking renames, delete removes", () => {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  render(
    <EntryList
      entries={[mb("snack", "2026-07-03")]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{ "2026-07-03": { kcalLeftover: 100, sugarUsedG: 5 } }}
      onRenameBreak={onRename}
      onDeleteBreak={onDelete}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "snack break" }));
  fireEvent.click(screen.getByRole("button", { name: "dinner" }));
  expect(onRename).toHaveBeenCalledWith(expect.any(String), "dinner");
  // Chips collapse after picking; reopen to delete.
  expect(screen.queryByRole("button", { name: "dinner" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "snack break" }));
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  expect(onDelete).toHaveBeenCalledWith(expect.any(String));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/EntryList.test.tsx 2>&1 | tail -15`
Expected: FAIL — no element with accessible name "lunch break" (the temporary filter hides breaks).

- [ ] **Step 3: Create `src/components/MealBreakChips.tsx`**

```tsx
import type { CSSProperties } from "react";
import { colors } from "../theme";
import { MEAL_NAMES, type MealName } from "../lib/types";

interface MealBreakChipsProps {
  current?: MealName;   // highlight the break's existing name when editing
  onPick: (meal: MealName) => void;
  onDelete?: () => void; // present only when editing an existing break
}

const chip: CSSProperties = {
  background: "none", border: `1px solid ${colors.inputBorder}`, color: colors.muted,
  borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer",
};

export default function MealBreakChips({ current, onPick, onDelete }: MealBreakChipsProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {MEAL_NAMES.map((m) => (
        <button
          key={m}
          onClick={() => onPick(m)}
          style={{ ...chip, ...(m === current ? { color: colors.text, borderColor: colors.positive } : {}) }}
        >
          {m}
        </button>
      ))}
      {onDelete && (
        <button onClick={onDelete} style={{ ...chip, color: colors.negative, borderColor: colors.negative }}>
          delete
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the ledger loop in `src/components/EntryList.tsx`**

Remove the Task-1 temporary `visible` filter (all uses go back to `entries`). Add imports and state:

```tsx
import { useState, type ReactNode } from "react";
import type { Entry, LedgerItem, MealName } from "../lib/types";
import { isMealBreak } from "../lib/types";
import MealBreakChips from "./MealBreakChips";
```

Extend the props interface:

```tsx
interface EntryListProps {
  entries: LedgerItem[];
  onSelect: (e: Entry) => void;
  pendingText?: string | null;
  daySummaries?: Record<string, DaySummary>;
  today?: string;
  onRenameBreak?: (id: string, meal: MealName) => void;
  onDeleteBreak?: (id: string) => void;
}
```

Inside the component add `const [openBreakId, setOpenBreakId] = useState<string | null>(null);`.

In the `entries.forEach((entry, idx) => { … })` loop, the day-divider block at the top stays exactly as it is (breaks have a `date`, so a break that starts a day still gets its day header). Immediately after the day-divider block and the `prevDate = entry.date;` line, branch on markers before the entry-row JSX:

```tsx
    if (isMealBreak(entry)) {
      const open = openBreakId === entry.id;
      rows.push(
        <div
          key={entry.id}
          role="button"
          tabIndex={0}
          aria-label={`${entry.meal} break`}
          onClick={() => setOpenBreakId(open ? null : entry.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              setOpenBreakId(open ? null : entry.id);
            }
          }}
          style={{ padding: "6px 16px", cursor: "pointer" }}
        >
          {open ? (
            // stopPropagation so a chip tap doesn't also toggle the row.
            <div onClick={(ev) => ev.stopPropagation()}>
              <MealBreakChips
                current={entry.meal}
                onPick={(m) => { onRenameBreak?.(entry.id, m); setOpenBreakId(null); }}
                onDelete={() => { onDeleteBreak?.(entry.id); setOpenBreakId(null); }}
              />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>
                {entry.meal}
              </span>
              <div style={{ flex: 1, height: 1, background: colors.divider }} />
            </div>
          )}
        </div>
      );
      return;
    }
```

(Note the loop must set `prevDate = entry.date;` **before** this branch so breaks participate in day grouping; move that assignment above the marker branch if it currently sits below.)

After the early `return`, TypeScript narrows `entry` to `Entry` for the existing row JSX — it needs no changes except the border logic. A break row *is* the separator, so the entry above it must not draw its own border. Replace the entry row's `borderBottom` with:

```tsx
        borderBottom: (() => {
          const next = entries[idx + 1];
          if (!next || isMealBreak(next)) return "none";
          if (daySummaries) return next.date === entry.date ? `1px solid ${colors.divider}` : "none";
          return `1px solid ${colors.divider}`;
        })(),
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- --run 2>&1 | tail -10` — Expected: all PASS (including the three pre-existing EntryList tests, unchanged).
Run: `npm run check` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components
git -c commit.gpgsign=false commit -m "feat(meal-breaks): break rows with in-place chip rename/delete"
```

---

### Task 4: Dashboard button and insert picker

**Files:**
- Modify: `src/screens/Dashboard.tsx`
- Test: `src/screens/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `app.addMealBreak(meal)`, `app.updateMealBreak(id, meal)`, `app.deleteEntry(id)` (Task 2); `MealBreakChips` (Task 3); `EntryList` props `onRenameBreak`/`onDeleteBreak` (Task 3).
- Produces: the user-facing feature; nothing downstream.

- [ ] **Step 1: Write the failing test**

Append to `src/screens/Dashboard.test.tsx`:

```tsx
test("meal break button inserts a labelled break at the top of the ledger", async () => {
  const user = userEvent.setup();
  const { hook, view } = setup();
  const { rerender } = view();

  await user.click(screen.getByRole("button", { name: /meal break/i }));
  await user.click(screen.getByRole("button", { name: "lunch" }));
  rerender(
    <Dashboard app={hook.result.current} settings={settings} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
  );

  expect(hook.result.current.current!.entries[0]).toMatchObject({ kind: "meal-break", meal: "lunch" });
  expect(screen.getByRole("button", { name: "lunch break" })).toBeInTheDocument();
  // Picker collapsed after picking.
  expect(screen.queryByRole("button", { name: "breakfast" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/screens/Dashboard.test.tsx 2>&1 | tail -15`
Expected: FAIL — no button with accessible name matching /meal break/i.

- [ ] **Step 3: Implement**

In `src/screens/Dashboard.tsx`: import `MealBreakChips` from `../components/MealBreakChips`, add state `const [pickingMeal, setPickingMeal] = useState(false);` next to the other useState calls, and replace the "Recent entries" heading + `EntryList` block:

```tsx
        {/* Entries */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Recent entries</span>
          <button
            onClick={() => setPickingMeal((p) => !p)}
            style={{
              background: "none", border: `1px solid ${colors.inputBorder}`, color: colors.muted,
              borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer",
            }}
          >
            + Meal break
          </button>
        </div>
        {pickingMeal && (
          <div style={{ marginBottom: 12 }}>
            <MealBreakChips onPick={(m) => { app.addMealBreak(m); setPickingMeal(false); }} />
          </div>
        )}
        <EntryList
          entries={period.entries}
          onSelect={handleSelect}
          pendingText={pendingText}
          daySummaries={daySummaries}
          today={app.today}
          onRenameBreak={app.updateMealBreak}
          onDeleteBreak={app.deleteEntry}
        />
```

(`colors` and `useState` are already imported in this file.)

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run 2>&1 | tail -10` — Expected: all PASS.
Run: `npm run check` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard.tsx src/screens/Dashboard.test.tsx
git -c commit.gpgsign=false commit -m "feat(meal-breaks): dashboard button + insert picker"
```

---

### Task 5: Full verification

**Files:** none new — verification only.

- [ ] **Step 1: Full suite**

Run: `npm test -- --run 2>&1 | tail -8` — Expected: all test files PASS, zero failures.

- [ ] **Step 2: Typecheck and production build**

Run: `npm run check` — Expected: clean.
Run: `npm run build 2>&1 | tail -5` — Expected: vite build succeeds.

- [ ] **Step 3: Hand off**

Use superpowers:finishing-a-development-branch — the repo convention is merging feature branches into `main` locally (see `git log` merge commits). Remember: unsigned commits (`git -c commit.gpgsign=false`).
