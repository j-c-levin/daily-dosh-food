# Daily Dosh — Food & Exercise Ledger (v1 Spec)

## Concept

A calorie/exercise tracker built on the same mental model as Joshua's existing "Daily Dosh" budgeting app: income (calorie budget) minus fixed costs (nothing here, budget is already net of TDEE) divided across a period, with each entry logged as either a **credit** (calories burned via exercise) or a **debit** (calories eaten). The goal each period is to end **positive** — this is a deficit-by-design system, so "positive" already means a calorie deficit was maintained, not maintenance.

The reference app (real "Daily Dosh") establishes the visual and tonal model to follow:
- Big balance figure, "safe to spend" style framing
- Pace prediction ("building up £X a day · Y days to next payday · at this pace you'll finish £Z up")
- Sparkline trend chart
- Three-stat row (period pot / spent so far / remaining)
- Transaction list below

## Core mechanics

1. User sets **TDEE** (maintenance calories) and a **target deficit** during onboarding. Budget = TDEE − deficit, per day.
2. User picks a **period length** — default **biweekly** (weekly is too noisy, monthly too slack for course-correction).
3. Each day's budget accumulates into a running period balance.
4. **Credits** = exercise logged (calories burned/earned back).
5. **Debits** = food logged (calories eaten).
6. Balance = period budget so far − debits + credits.
7. Positive balance at period end = deficit maintained = "win," regardless of magnitude. Being wildly positive isn't the actual goal — steady, repeatable positive is.
8. At the end of each period, the outcome is sealed into a **stamp** (positive/negative), displayed on a separate "Stamps" page as a historical strip. A negative period flanked by positive ones should be visually/textually flagged as a recovery, not a failure streak.

## V1 scope (explicitly deferred)

- **Manual input only.** No Apple Health / HealthKit integration in v1 (websites can't access HealthKit directly — would need Health Auto Export webhook or Shortcuts automation; deferred to v2).
- **No calorie-counting apps integration** (Cronometer/MyFitnessPal etc.) — also deferred. All entries come through the single free-text logger.
- Single logging mechanism for **both** food and exercise: one free-text input, parsed by an AI API call into a structured entry.

## AI parsing

- User taps **"+ Add something"** (single global action, not two separate food/exercise flows).
- A small composer opens with one free-text field, e.g. `"100 press ups"` or `"chicken sandwich and a coffee"`.
- On submit, the text is sent to an LLM API call with a prompt roughly like:

  > "Estimate calories for this logged item, for a person of [weight/stats]. Decide if this is something eaten (debit) or exercise performed (credit). Respond only with JSON: `{ "label": string, "type": "credit" | "debit", "amount": number }`."

- The structured response becomes a new entry in the ledger immediately — no extra confirmation step required, since editing is always available afterward (see below).
- This is the only planned AI touchpoint for v1. No photo logging, no barcode scanning.

## Editing entries

- Tapping any entry in the list opens a **bottom-sheet modal**, not inline editing.
- Modal fields:
  - **Description** (free text)
  - **Type** — two-button toggle, Debit (eaten) / Credit (earned), colour-coded to match the balance colours
  - **Amount (kcal)** — numeric input
- Modal actions: **Delete** (destructive, left-aligned, outlined) and **Save** (primary, filled).
- No swap/quick-toggle controls on the list row itself — the row is a single tap target that opens the modal.

## Screens

### 1. Main dashboard (default view)
- Header: app name + a small "Stamps →" link (stamps view is NOT default, lives on a separate page)
- Big balance number: current period balance, coloured green (positive) or rust/amber (negative) — deliberately not alarm-red, to avoid a shame reaction on off days
- Pace line: "averaging +X kcal a day · Y days to next period"
- Prediction line: "at this pace you'll finish Z up"
- Sparkline chart of balance over the period so far
- Three-stat row: Period budget / Consumed / Earned back (exercise credit)
- Recent entries list (ledger-style, tap to edit)
- Floating **"+ Add something"** button, bottom-centre, primary action

### 2. Add composer
- Triggered by the floating button
- Single free-text input + Cancel / Log it buttons
- Submits to AI parse function, entry appears at top of the list immediately

### 3. Edit modal
- Bottom sheet as described above (Description / Type / Amount / Delete / Save)

### 4. Stamps page (separate, not default)
- Horizontal strip of past periods, each rendered as a stamp (ink-stamp visual: circular mark, "IN CREDIT" / "OVERDRAWN", slight rotation for a hand-stamped feel)
- Caption logic: when a negative-stamp period sits between two positive ones, surface a short note (e.g. "P5 ran overdrawn but P4 and P6 either side stayed in credit — the dip didn't spread") to reinforce recovery over restriction

## Visual design system

- **Theme:** dark, matching the real Daily Dosh app
- **Palette:**
  - Background: `#0B0D10`
  - Card surface: `#14171C`
  - Card border: `#2A2F37`
  - Primary text: `#EDEFF2`
  - Secondary/muted text: `#8A9099`
  - Positive/credit: `#3DDC97` (calm green, not neon)
  - Negative/debit: `#E07856` (warm rust/amber — deliberately not alarm red)
  - Divider lines: `#22262D`
- **Type:**
  - Inter — UI text, labels, body
  - IBM Plex Mono — all numeric/balance figures (ledger-figure feel, distinct from UI chrome)
- **Layout notes:**
  - Balance is the largest element on screen, centered, bank-app style
  - Stat boxes and transaction list use consistent 14–16px border radius, dark card surfaces
  - Modals are bottom sheets (mobile-native pattern), not centered dialogs

## Data model (entries)

```
Entry {
  id: string
  label: string          // free-text description, AI-generated or user-edited
  type: "credit" | "debit"
  amount: number          // kcal
  date: string
  source: "ai" | "manual" // for future distinction, not currently surfaced beyond "AI logged" caption
}
```

```
Period {
  id: string
  startDate: string
  endDate: string
  budgetPerDay: number
  entries: Entry[]
  outcome: "positive" | "negative"   // sealed at period close
}
```

## Reference mockups

Two working React mockups were built during design exploration:
- `daily-dosh-mockup.jsx` — initial ledger/passbook-styled exploration (superseded)
- `daily-dosh-food-mockup.jsx` — current direction, matches this spec: dark theme, single add button, AI-structured parsing, tap-to-edit modal

Use `daily-dosh-food-mockup.jsx` as the visual and interaction reference for implementation.

## Open questions for the agent to flag, not solve unilaterally

- Exact TDEE calculation formula/inputs to use during onboarding (likely Mifflin-St Jeor or similar — confirm before hardcoding)
- Where period start/end boundaries fall relative to the user's actual payday (align with existing Daily Dosh cadence, or independent)
- Persistence/auth approach (not yet decided — this spec assumes it will be addressed separately)
