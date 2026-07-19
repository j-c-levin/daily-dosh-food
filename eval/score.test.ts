import { describe, expect, test } from "vitest";
import { median, p95, scoreCall, summarize, type ScoredCall } from "./score";
import type { Fixture } from "./fixtures";

describe("median", () => {
  test("odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  test("even-length list averages the two middle values", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  test("single value", () => {
    expect(median([42])).toBe(42);
  });

  test("empty list", () => {
    expect(median([])).toBe(0);
  });
});

describe("p95", () => {
  test("small list", () => {
    // sorted: [1,2,3,4,5]; rank = ceil(0.95*5) = 5 -> index 4 -> max
    expect(p95([5, 1, 4, 2, 3])).toBe(5);
  });

  test("20-item list excludes the top ~5%", () => {
    const ns = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    // rank = ceil(0.95*20) = 19 -> index 18 -> value 19
    expect(p95(ns)).toBe(19);
  });

  test("empty list", () => {
    expect(p95([])).toBe(0);
  });
});

describe("scoreCall", () => {
  const fixture: Fixture = {
    text: "100 press ups",
    expectedType: "credit",
    kcalRange: [20, 120],
    sugarRange: [0, 0],
  };

  test("correct type and in-range amount", () => {
    expect(scoreCall({ label: "x", type: "credit", amount: 60, sugarG: 0 }, fixture)).toEqual({
      typeCorrect: true,
      kcalInRange: true,
      sugarInRange: true,
    });
  });

  test("wrong type", () => {
    expect(scoreCall({ label: "x", type: "debit", amount: 60, sugarG: 0 }, fixture).typeCorrect).toBe(false);
  });

  test("range is inclusive at the lower bound", () => {
    expect(scoreCall({ label: "x", type: "credit", amount: 20, sugarG: 0 }, fixture).kcalInRange).toBe(true);
  });

  test("range is inclusive at the upper bound", () => {
    expect(scoreCall({ label: "x", type: "credit", amount: 120, sugarG: 0 }, fixture).kcalInRange).toBe(true);
  });

  test("just below the lower bound is out of range", () => {
    expect(scoreCall({ label: "x", type: "credit", amount: 19, sugarG: 0 }, fixture).kcalInRange).toBe(false);
  });

  test("just above the upper bound is out of range", () => {
    expect(scoreCall({ label: "x", type: "credit", amount: 121, sugarG: 0 }, fixture).kcalInRange).toBe(false);
  });
});

describe("summarize", () => {
  test("cost math: 200 in + 60 out tokens on haiku pricing", () => {
    const calls: ScoredCall[] = [
      { ms: 100, inputTokens: 200, outputTokens: 60, error: false, typeCorrect: true, kcalInRange: true, sugarInRange: true },
    ];
    const haiku = { input: 1, output: 5 }; // USD per MTok
    const summary = summarize(calls, haiku);
    const expectedCost = 200e-6 * 1 + 60e-6 * 5;
    expect(summary.totalCostUsd).toBeCloseTo(expectedCost, 10);
    expect(summary.costPer100Usd).toBeCloseTo(expectedCost * 100, 10);
  });

  test("unknown model pricing reports null cost with a note", () => {
    const calls: ScoredCall[] = [
      { ms: 100, inputTokens: 200, outputTokens: 60, error: false, typeCorrect: true, kcalInRange: true, sugarInRange: true },
    ];
    const summary = summarize(calls, null);
    expect(summary.totalCostUsd).toBeNull();
    expect(summary.costPer100Usd).toBeNull();
    expect(summary.costNote).toBeTruthy();
  });

  test("aggregates n, errors, accuracy percentages, and latency stats", () => {
    const calls: ScoredCall[] = [
      { ms: 100, inputTokens: 10, outputTokens: 10, error: false, typeCorrect: true, kcalInRange: true, sugarInRange: true },
      { ms: 200, inputTokens: 10, outputTokens: 10, error: false, typeCorrect: true, kcalInRange: false, sugarInRange: false },
      { ms: 300, inputTokens: 0, outputTokens: 0, error: true, typeCorrect: false, kcalInRange: false, sugarInRange: false },
    ];
    const summary = summarize(calls, { input: 1, output: 5 });
    expect(summary.n).toBe(3);
    expect(summary.errors).toBe(1);
    expect(summary.medianMs).toBe(200);
    expect(summary.typeAccuracyPct).toBeCloseTo((2 / 3) * 100);
    expect(summary.kcalInRangePct).toBeCloseTo((1 / 3) * 100);
    expect(summary.sugarInRangePct).toBeCloseTo((1 / 3) * 100);
  });

  test("empty calls list", () => {
    const summary = summarize([], { input: 1, output: 5 });
    expect(summary.n).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.medianMs).toBe(0);
    expect(summary.p95Ms).toBe(0);
    expect(summary.typeAccuracyPct).toBe(0);
    expect(summary.kcalInRangePct).toBe(0);
    expect(summary.sugarInRangePct).toBe(0);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.costPer100Usd).toBe(0);
  });
});

test("scoreCall checks sugarG against the fixture's sugarRange", () => {
  const fixture = { text: "cola", expectedType: "debit" as const, kcalRange: [180, 250] as [number, number], sugarRange: [40, 60] as [number, number] };
  expect(scoreCall({ label: "cola", type: "debit", amount: 210, sugarG: 53 }, fixture).sugarInRange).toBe(true);
  expect(scoreCall({ label: "cola", type: "debit", amount: 210, sugarG: 5 }, fixture).sugarInRange).toBe(false);
});

test("summarize reports sugarInRangePct", () => {
  const call = { ms: 1, inputTokens: 0, outputTokens: 0, error: false, typeCorrect: true, kcalInRange: true, sugarInRange: true };
  expect(summarize([call, { ...call, sugarInRange: false }], null).sugarInRangePct).toBe(50);
});
