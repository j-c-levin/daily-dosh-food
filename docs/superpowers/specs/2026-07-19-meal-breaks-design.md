# Meal breaks in the ledger — design

2026-07-19

## Goal

The ledger currently separates days with a full-width day divider. Within a
day, the user wants to declare meals — breakfast, snack, lunch, dinner, late
night snack — by inserting a **smaller labelled break** between entries. In
practice: the three main meals plus arbitrary snack breaks.

Chosen interaction (user decisions during brainstorming):

- A **button at the top** of the ledger triggers the break — not typed text,
  not AI-inferred tags.
- Entries prepend (newest at top), so inserting a break closes off the meal
  below it; everything logged afterwards stacks above it as the next meal.
- Tapping the button lets the user **pick one of five meal names**; the break
  renders with that label.
- Storage: the break is a **marker item in the ledger array**, ordered by
  array position like everything else.

## Data model

```ts
type MealName = "breakfast" | "snack" | "lunch" | "dinner" | "late night snack";

interface MealBreak {
  kind: "meal-break";
  id: string;
  meal: MealName;
  date: string; // ISO yyyy-mm-dd, same as Entry.date
}

type LedgerItem = Entry | MealBreak;
```

- `Period.entries` widens from `Entry[]` to `LedgerItem[]`.
- `Entry` is unchanged — no `kind` field added — so all stored entries remain
  valid as-is. A type guard discriminates on the presence of `kind`:

```ts
const isMealBreak = (item: LedgerItem): item is MealBreak =>
  "kind" in item && item.kind === "meal-break";
```

- `schemaVersion` bumps 2 → 3 with an **identity migration** (every v2 state
  is a valid v3 state; the bump records the shape change, following the
  existing v1→v2 migration precedent in `store.ts`).

## Store API (`src/lib/store.ts`)

- `addMealBreak(meal: MealName)` — prepends a `MealBreak` stamped with
  today's date, mirroring `addEntry`'s prepend. This preserves the
  day-contiguity assumption that day dividers rely on (markers carry a
  `date` and are prepended just like entries).
- `updateMealBreak(id, meal: MealName)` — renames a break.
- Deletion reuses the existing `deleteEntry(id)` (filters by id; works for
  any ledger item).

## Excluding markers from the maths

Widening `Period.entries` to `LedgerItem[]` makes `tsc` flag every consumer.
Each summation site filters through the type guard so a break can never count
as food/exercise:

- `src/lib/period.ts` — ledger/leftover sums, `sugarConsumed`,
  `dailySugarGrams` (all sugar sums live here, not in `sugar.ts`)
- `src/lib/carryover.ts` — carryover maths
- `src/screens/Dashboard.tsx` — daily averages, day summaries
- `src/components/EditSheet.tsx` — only ever receives real entries (see UI)

The compiler does the finding; no grep-and-hope.

## UI

**Button.** In the "Recent entries" heading row on the Dashboard,
right-aligned: a small ghost button (`+ Meal break`). Tapping it reveals a
compact row of five chips — Breakfast / Snack / Lunch / Dinner / Late night
snack. Tapping a chip inserts the labelled break at the top of the ledger
and collapses the chips.

**Rendering** (in `EntryList`). A break renders as a smaller sibling of the
day divider: same uppercase-caption style but lighter — tighter padding
(~4px vs 7px), no background fill, meal name in muted small caps with a
hairline rule. Clearly subordinate to the day divider at a glance.

**Editing.** Tapping an existing break row swaps that row's content, in
place, for the same five chips plus a red Delete chip; tapping elsewhere (or
a second tap on the row) collapses it back. Renaming calls
`updateMealBreak`; Delete calls `deleteEntry`. The full EditSheet stays
entries-only.

**Untouched paths.** The composer and AI parsing flow are completely
unchanged. The pulsing "estimating…" placeholder still renders above
everything.

## Edge cases

- A break with no food above it renders as a labelled line — harmless; the
  meal is declared and food stacks above as it's logged.
- Breaks in past days render inside their day group as normal.
- Multiple consecutive breaks are allowed (user may fat-finger; delete is
  one tap away).
- Day summaries (kcal leftover / sugar) are unaffected — they already come
  from sums that now filter markers.

## Testing

- `store.test.ts` — add/rename/delete a break; date stamping; v2→v3
  migration keeps existing data intact.
- `EntryList.test.tsx` — break row renders with its label; visually distinct
  from a day divider; tap fires the edit affordance.
- `period.test.ts` / `carryover.test.ts` / `sugar.test.ts` — sums ignore
  markers.
- `npm test` and `npm run check` green.
