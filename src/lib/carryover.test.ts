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
