# Sugar tracking & decaying carryover — design

**Date:** 2026-07-19
**Status:** Approved design, pre-implementation
**Motivation:** The user wants to track and reduce free-sugar intake (sugar
addiction) alongside calories, with a budget mechanic that recognises but does
not encourage banking food for a binge.

## Summary

Two intertwined changes:

1. **Sugar tracking.** The AI estimates grams of *free sugars* per entry.
   Budget maths runs on grams; the UI displays a derived 0–5 impact level so
   the interface never pretends to gram-level precision.
2. **Decaying carryover replaces full carryover.** The core calorie ledger
   moves from "unused budget banks in full within the 14-day period" to daily
   budgets where unused surplus (and overspend debt) fades over three days.
   Sugar uses the identical mechanic. The 14-day period survives purely as a
   scoring window: stamps are still judged on full, undecayed totals.

## Decisions log

| Decision | Choice |
|---|---|
| Scope of carryover mechanic | Replaces core calorie ledger too, not just sugar |
| Debt handling | Asymmetric decay: debt fades slower than surplus |
| Sugar metric | Grams of free sugars stored; 0–5 level derived for display |
| Sugar definition | NHS "free sugars": added sugar, honey, syrups, fruit juice, smoothies. NOT sugars intrinsic to whole fruit, vegetables, plain milk |
| Daily sugar budget | 30 g default (NHS adult guideline), editable in Settings |
| Exercise vs sugar | Sugar is debit-only. Exercise never earns back sugar allowance ("earn a treat with a workout" is the reward loop being unlearned) |
| Period stamps | Dual verdict: calories IN CREDIT/OVERDRAWN (as today) + sugar UNDER/OVER, both on undecayed totals |
| Taper (ratcheting budget down weekly) | Out of scope for v1; data model deliberately leaves room (scalar `sugarBudget` today, a schedule field can sit alongside later, no migration) |
| Carryover implementation | Fully derived 3-day kernel (Approach A). No stored state; recomputed from entries, so backdated edits re-flow automatically |

## Carryover engine (`src/lib/carryover.ts`, new, pure)

For each calendar day `d`:

```
available(d) = baseBudget(d) + bonus(d) + credits(d)
leftover(d)  = available(d) − debits(d)        // negative = debt

bonus(d) = Σ over i ∈ {1,2,3} of w(i, sign) × leftover(d − i)

  surplus weights (leftover > 0): 30% / 15% / 5%    (sums to 50%)
  debt weights    (leftover < 0): 50% / 25% / 10%   (sums to 85%)
  beyond 3 days: 0
```

Properties and rules:

- **Recursive, computed forward.** A day's leftover includes its own bonus, so
  the engine walks forward from the earliest relevant day. O(days), instant.
- **Compounding is intentional and bounded.** `leftover` is measured against
  `budget + bonus + credits`, not base budget alone — otherwise eating into a
  legitimately earned bonus would register as debt. Surplus re-carry is mild
  (30% of 30% ≈ 9% reaches day two) and converges.
- **Crosses period boundaries.** Days are days; the period is only a scoring
  window. Day 1 of a new period still sees the previous three days' leftovers.
- **Shared function, two configurations.** Calories: credits included. Sugar:
  `credits ≡ 0`, `baseBudget = sugarBudgetPerDay`.
- **Cold start:** days before the anchor date (or before any history exists)
  contribute nothing; the first day's bonus is 0.
- Kernel weights live as named constants (`SURPLUS_KERNEL`, `DEBT_KERNEL`) —
  tunable in one place.

## Data model (`src/lib/types.ts`)

- `Entry` + `sugarG?: number` — grams of free sugars, ≥ 0. `undefined` means
  unknown (legacy entries, fallback-parsed entries): counts as 0 toward the
  budget, renders no chip. Credits are 0/absent.
- `Settings` + `sugarBudget: number` — grams/day, default 30.
- `Period` + `sugarBudgetPerDay: number` (snapshot at creation, same rules as
  `budgetPerDay`: live period updates when Settings change, sealed periods are
  immutable) and `sugarOutcome?: "under" | "over"`.
- `schemaVersion` 1 → 2. Migration in `loadState`: fill `sugarBudget: 30`,
  fill `sugarBudgetPerDay` on existing periods from the new setting, leave
  legacy entries' `sugarG` undefined. Storage key unchanged.

## AI (`src/lib/ai.ts`)

- `SCHEMA` gains required `sugarG` (number): "Estimated grams of free sugars —
  added sugars plus honey, syrups, fruit juice and smoothie content. Count 0
  for sugars naturally present in whole fruit, vegetables, or plain milk, and
  0 for exercise."
- `systemPrompt` gains one sentence stating the free-sugar definition.
- Parsing clamps `sugarG` to `Math.max(0, Math.round(...))` like `amount`.
- `fallbackParse` leaves `sugarG` undefined (unknown, counts 0).

## Display level (derived, never stored)

`sugarLevel(g)` pure function:

| Level | Grams (lower bound inclusive, upper exclusive) |
|---|---|
| 0 | < 2 |
| 1 | 2 – 10 |
| 2 | 10 – 20 |
| 3 | 20 – 30 |
| 4 | 30 – 45 |
| 5 | ≥ 45 |

Calibration: honeyed oats ≈ 10 g → 1; chocolate bar ≈ 25 g → 3; 500 ml
full-sugar cola ≈ 53 g → 5. Thresholds are named constants.

## Stamps (period sealing, `src/lib/period.ts`)

At seal, on **undecayed** totals across the whole period:

- Calorie outcome: unchanged — `Σaccrued + Σcredits − Σdebits ≥ 0`.
- Sugar outcome: `Σ sugarG ≤ periodLengthDays × sugarBudgetPerDay` → `"under"`
  else `"over"`.

The daily number is forgiving; the fortnightly stamp tells the truth.

## UI

- **Dashboard:** the big number becomes **calories left today**
  (`base + bonus + credits − debits`), with a subline explaining any carry:
  "includes +140 fading bonus" / "−230 carried from yesterday". Below it, a
  sugar gauge: "Sugar 12g of 34g today" with 0–5-coloured fill (the "of"
  figure is base + bonus, so it moves with carryover). Period pace/projection
  and sparkline remain but as secondary "period pace" content, since they
  drive the stamp.
- **EntryList:** small sugar-level chip on debit entries with known `sugarG`.
- **EditSheet:** sugar grams field (numeric, optional).
- **Settings:** sugar budget input alongside TDEE/deficit.
- **Onboarding:** unchanged; sugar defaults to 30 g.
- **Stamps:** dual verdict — existing ink stamp plus a smaller sugar
  UNDER/OVER mark per sealed period. Legacy sealed periods without
  `sugarOutcome` show no sugar mark.
- **Composer:** unchanged (free text; the AI now returns sugar too).

## Eval (`eval/`)

`eval/run.ts` imports the real `SCHEMA`/`systemPrompt`, so requests update
automatically. Manual additions:

- Fixtures gain `sugarRange: [lo, hi]`; `ParsedResult` in `run.ts` and
  `score.ts` gain `sugarG`; scoring/summary gain a sugar-in-range column.
- New fixtures probing the free-sugar definition: an apple (expect ≈ 0 — the
  definition's acid test), orange juice (expect high), oats with honey,
  full-sugar cola, plain milk (expect ≈ 0).
- Run `npm run eval` before shipping to confirm the default model handles the
  definition; revisit the prompt sentence if it doesn't.

## Testing (Vitest)

Carryover engine (pure, so straightforward):

- Surplus decays 30/15/5 and vanishes on day 4.
- Debt decays 50/25/10.
- Mixed surplus/debt days pick the right kernel per day.
- Eating into bonus does not register as debt.
- Compounding stays bounded (never exceeds ~50% of a skipped day in total).
- Carryover crosses a period boundary.
- Cold start: first day has bonus 0.
- Backdated edit re-flows subsequent days' bonuses.

Plus: migration v1→v2, `sugarLevel` thresholds, sugar stamp outcome at seal.

## Edge cases

- AI refusal or error → fallback → `sugarG` undefined → counts 0, no chip.
- Mid-period `sugarBudget` change: live period snapshot updates, sealed
  periods immutable (mirrors `budgetPerDay` behaviour).
- Entries with unknown sugar make the sugar day-total an underestimate; the
  UI does not flag this in v1 (acceptable: unknowns are mostly legacy and
  fallback entries).

## Out of scope (v1)

- Weekly taper / ratcheting sugar budget (designed-for, not built).
- Distinguishing intrinsic vs free sugars in the UI (only free sugars exist
  in the model).
- Sugar credits of any kind.
- Retroactive AI re-estimation of legacy entries' sugar.
