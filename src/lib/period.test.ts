import {
  addDays, daysBetween, makePeriod, daysElapsed, accruedBudget, entryTotals,
  balance, paceInfo, rollover, currentPeriod, dailyBalances, stampCaption,
} from "./period";
import type { AppState, Entry, Period } from "./types";

const entry = (over: Partial<Entry>): Entry => ({
  id: "x", label: "t", type: "debit", amount: 100, date: "2026-07-01", source: "manual", ...over,
});

const settingsState = (periods: Period[] = []): AppState => ({
  schemaVersion: 2,
  settings: { tdee: 2300, deficit: 500, sugarBudget: 30, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5" },
  periods,
});

test("date helpers", () => {
  expect(addDays("2026-07-01", 13)).toBe("2026-07-14");
  expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  expect(daysBetween("2026-07-01", "2026-07-14")).toBe(13);
});

test("accrual: day 1 counts one budget, clamped at period length", () => {
  const p = makePeriod("2026-07-01", 1800, 30, 14);
  expect(p.endDate).toBe("2026-07-14");
  expect(daysElapsed(p, "2026-07-01")).toBe(1);
  expect(accruedBudget(p, "2026-07-01")).toBe(1800);
  expect(accruedBudget(p, "2026-07-14")).toBe(25200);
  expect(accruedBudget(p, "2026-08-01")).toBe(25200); // clamp
});

test("balance = accrued − debits + credits", () => {
  const p = makePeriod("2026-07-01", 1800, 30, 14);
  p.entries = [entry({ type: "debit", amount: 1500 }), entry({ type: "credit", amount: 200 })];
  expect(entryTotals(p.entries)).toEqual({ consumed: 1500, earned: 200 });
  expect(balance(p, "2026-07-01")).toBe(500); // 1800 − 1500 + 200
});

test("paceInfo averages and projects", () => {
  const p = makePeriod("2026-07-01", 1800, 30, 14);
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
  const p = makePeriod("2026-07-01", 1000, 30, 14);
  p.entries = [entry({ type: "debit", amount: 1500, date: "2026-07-02" })];
  expect(dailyBalances(p, "2026-07-03")).toEqual([1000, 500, 1500]);
});

test("stampCaption flags recovery dips", () => {
  const mk = (outcome: "positive" | "negative"): Period =>
    ({ ...makePeriod("2026-01-01", 1, 30, 14), outcome });
  const sealed = [mk("positive"), mk("negative"), mk("positive")];
  expect(stampCaption(sealed, 1)).toMatch(/didn't spread/);
  expect(stampCaption(sealed, 0)).toBeNull();
  expect(stampCaption([mk("negative"), mk("negative"), mk("positive")], 1)).toBeNull();
});
