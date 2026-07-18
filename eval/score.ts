// Pure scoring/statistics helpers for the model eval. No network calls here —
// keeps this file (and its test) fast, deterministic, and safe to run in CI.
import type { EntryType } from "../src/lib/types";
import type { Fixture } from "./fixtures";

/** Median of a list of numbers. Averages the two middle values for even-length lists. */
export function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** 95th percentile via the nearest-rank method. */
export function p95(ns: number[]): number {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
}

export interface ParsedResult {
  label: string;
  type: EntryType;
  amount: number;
}

export interface ScoreResult {
  typeCorrect: boolean;
  kcalInRange: boolean;
}

/** Score one successfully-parsed call against its fixture's expectations. */
export function scoreCall(parsed: ParsedResult, fixture: Fixture): ScoreResult {
  const typeCorrect = parsed.type === fixture.expectedType;
  const [lo, hi] = fixture.kcalRange;
  const kcalInRange = parsed.amount >= lo && parsed.amount <= hi;
  return { typeCorrect, kcalInRange };
}

/** One eval call, already scored (errors pre-marked with both flags false). */
export interface ScoredCall {
  ms: number;
  inputTokens: number;
  outputTokens: number;
  error: boolean;
  typeCorrect: boolean;
  kcalInRange: boolean;
}

/** USD per million tokens. */
export interface ModelPricing {
  input: number;
  output: number;
}

export interface ModelSummary {
  n: number;
  errors: number;
  medianMs: number;
  p95Ms: number;
  typeAccuracyPct: number;
  kcalInRangePct: number;
  totalCostUsd: number | null;
  costPer100Usd: number | null;
  costNote?: string;
}

/** Aggregate a single model's scored calls into a summary row. `pricing` is null for unknown models. */
export function summarize(calls: ScoredCall[], pricing: ModelPricing | null): ModelSummary {
  const n = calls.length;
  const errors = calls.filter((c) => c.error).length;
  const msValues = calls.map((c) => c.ms);
  const typeAccuracyPct = n ? (calls.filter((c) => c.typeCorrect).length / n) * 100 : 0;
  const kcalInRangePct = n ? (calls.filter((c) => c.kcalInRange).length / n) * 100 : 0;

  let totalCostUsd: number | null = null;
  let costPer100Usd: number | null = null;
  let costNote: string | undefined;
  if (pricing) {
    totalCostUsd = calls.reduce(
      (sum, c) => sum + c.inputTokens * 1e-6 * pricing.input + c.outputTokens * 1e-6 * pricing.output,
      0,
    );
    costPer100Usd = n ? (totalCostUsd / n) * 100 : 0;
  } else {
    costNote = "unknown model — pricing not available";
  }

  return {
    n,
    errors,
    medianMs: median(msValues),
    p95Ms: p95(msValues),
    typeAccuracyPct,
    kcalInRangePct,
    totalCostUsd,
    costPer100Usd,
    costNote,
  };
}
