import { emptyState, DEFAULT_MODEL, isMealBreak } from "./types";
import type { Entry, MealBreak } from "./types";

test("emptyState shape", () => {
  expect(emptyState()).toEqual({ schemaVersion: 3, periods: [] });
  expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6");
});

test("isMealBreak discriminates breaks from entries", () => {
  const brk: MealBreak = { kind: "meal-break", id: "b", meal: "dinner", date: "2026-07-01" };
  const entry: Entry = { id: "e", label: "toast", type: "debit", amount: 300, date: "2026-07-01", source: "manual" };
  expect(isMealBreak(brk)).toBe(true);
  expect(isMealBreak(entry)).toBe(false);
});
