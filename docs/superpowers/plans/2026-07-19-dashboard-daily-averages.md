# Dashboard Daily Averages + Sugar Sparkline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's period-pace/projection lines with plain daily intake averages, and add an independently-scaled sugar line to the sparkline.

**Architecture:** One new pure helper (`dailySugarGrams`) beside the existing `dailyBalances`; `paceInfo` is deleted as dead code; `Sparkline` gains an optional `secondary` series; Dashboard rewires one text line. See the spec's 2026-07-19 amendment section in `docs/superpowers/specs/2026-07-19-sugar-tracking-design.md`.

**Tech Stack:** unchanged (React 19 + TS + Vite, Vitest).

## Global Constraints

- Averages are **food only**: kcal = period debits ÷ elapsed days; sugar = `sugarConsumed(period.entries)` ÷ elapsed days; both `Math.round`ed, elapsed floored at 1. Exercise is never netted into them.
- Secondary line = **grams eaten per day** (not cumulative), color `#E0B156`, normalized to its own min/max — never to the kcal line's scale.
- The period balance and projection sentence disappear from the Dashboard; `paceInfo` and its test are deleted (verify no other consumers via grep first).
- Copy, exactly: `eating ~{X} kcal a day · ~{Y}g sugar a day · {N} days to next period` (the `~` glyphs included; existing muted/text span styling pattern).
- `Sparkline` without `secondary` renders exactly as before.
- Gate before commit: `npx tsc -b --noEmit && npx vitest run`. Commit with `git -c commit.gpgsign=false commit …`.

---

### Task 1: The whole change (single task — one seam, ~4 files)

**Files:**
- Modify: `src/lib/period.ts` (delete `paceInfo`, add `dailySugarGrams`)
- Modify: `src/lib/period.test.ts` (delete `paceInfo` test, add `dailySugarGrams` tests)
- Modify: `src/components/Sparkline.tsx` (optional `secondary?: number[]`)
- Modify: `src/screens/Dashboard.tsx` (new derivations + line, pass `secondary`)
- Test: `src/lib/period.test.ts`, `src/screens/Dashboard.test.tsx`, `src/components/Sparkline.test.tsx` (new)

**Interfaces:**
- Consumes: `sugarConsumed`, `daysElapsed`, `daysBetween`, `addDays` (period.ts); `entryTotals` already in Dashboard.
- Produces: `dailySugarGrams(period: Period, today: string): number[]` — one element per elapsed day, grams of free sugars consumed that day (`sugarG ?? 0`, debits only).

- [ ] **Step 1: Failing tests.** period.test.ts:

```ts
test("dailySugarGrams gives per-day grams, unknown sugarG counts 0", () => {
  const p = makePeriod("2026-07-01", 1000, 30, 14);
  p.entries = [
    entry({ sugarG: 30, date: "2026-07-01" }),
    entry({ date: "2026-07-01" }),              // unknown → 0
    entry({ sugarG: 12, date: "2026-07-03" }),
    entry({ type: "credit", sugarG: 9, date: "2026-07-03" }), // credits never count
  ];
  expect(dailySugarGrams(p, "2026-07-03")).toEqual([30, 0, 12]);
});
```

Sparkline.test.tsx (new, adapt the querySelector to the component's actual SVG markup after reading it — if it draws paths not polylines, assert on those):

```tsx
import { render } from "@testing-library/react";
import Sparkline from "./Sparkline";

test("renders one line without secondary, two with", () => {
  const one = render(<Sparkline values={[1, 2, 3]} />);
  const two = render(<Sparkline values={[1, 2, 3]} secondary={[30, 0, 12]} />);
  const lines = (c: HTMLElement) => c.querySelectorAll("polyline, path[data-series]").length;
  expect(lines(two.container)).toBe(lines(one.container) + 1);
});
```

Dashboard.test.tsx: update the assertions that referenced the old "period +… · averaging …" line. With the existing `renderWithEntries` fixture (1800 kcal day 1 + 1200 kcal day 2, today 2026-07-03, period 07-01..07-14): consumed 3000 ÷ 3 days = 1000; sugar 0; daysLeft = 11 → assert the text `eating ~1000 kcal a day` and `~0g sugar a day` and `11 days to next period` are present, and `at this pace` / `period +` are absent.

- [ ] **Step 2: RED** — run the three test files, confirm failures for the right reasons.
- [ ] **Step 3: Implement.** period.ts — delete `paceInfo` (grep `paceInfo` across src first; Dashboard is the only consumer), add:

```ts
export function dailySugarGrams(period: Period, today: string): number[] {
  const days = daysElapsed(period, today);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(period.startDate, i);
    out.push(sugarConsumed(period.entries.filter((e) => e.date === day)));
  }
  return out;
}
```

Sparkline.tsx — read the component; add optional `secondary?: number[]`, drawn as a second line normalized to its own min/max within the same viewBox, stroke `#E0B856`-family constant `#E0B156`, same stroke width, no fill, rendered after (on top of) the primary; primary path untouched. Tag the secondary element `data-series="secondary"` so the test can count it.

Dashboard.tsx — remove `paceInfo`/`balance` usage and the projection div; derive:

```tsx
const elapsed = Math.max(1, daysElapsed(period, app.today));
const avgKcal = Math.round(consumed / elapsed);
const avgSugar = Math.round(sugarConsumed(period.entries) / elapsed);
const daysLeft = Math.max(0, daysBetween(app.today, period.endDate));
```

Replace the old period/averaging + projection lines with one line (keep the budget caption below unchanged):

```tsx
<div style={{ textAlign: "center", color: colors.muted, fontSize: 14, marginBottom: 4 }}>
  eating <span style={{ color: colors.text }}>~{avgKcal} kcal</span> a day ·{" "}
  <span style={{ color: colors.text }}>~{avgSugar}g sugar</span> a day · {daysLeft} days to next period
</div>
```

Pass the sugar series: `<Sparkline values={sparklineValues} secondary={dailySugarGrams(period, app.today)} />`.

- [ ] **Step 4: GREEN** — `npx tsc -b --noEmit && npx vitest run`, all passing, no stray console noise.
- [ ] **Step 5: Commit** — `feat(sugar): dashboard daily intake averages + sugar sparkline line`.
