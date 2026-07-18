// Model comparison harness for the app's entry-parsing job. Dev tool only —
// not part of the built site, not run in CI. Usage: `npm run eval`.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SCHEMA, systemPrompt } from "../src/lib/ai";
import type { EntryType } from "../src/lib/types";
import { EVAL_STATS, FIXTURES, type Fixture } from "./fixtures";
import { scoreCall, summarize, type ModelPricing, type ScoredCall } from "./score";

const DEFAULT_MODELS = ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-sonnet-5"];

// USD per million tokens (input/output).
const PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

const CONCURRENCY = 5;

interface ParsedResult {
  label: string;
  type: EntryType;
  amount: number;
}

interface RawCall {
  fixture: Fixture;
  model: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  parsed: ParsedResult | null;
  error: string | null;
}

async function runChunked<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

async function callModel(client: Anthropic, model: string, fixture: Fixture): Promise<RawCall> {
  const start = performance.now();
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 300,
      system: systemPrompt(EVAL_STATS),
      messages: [{ role: "user", content: fixture.text }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
    const ms = performance.now() - start;
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const block = response.content.find((b: { type: string }) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    if (!block) {
      return {
        fixture,
        model,
        ms,
        inputTokens,
        outputTokens,
        parsed: null,
        error: `no text block in response (stop_reason=${response.stop_reason})`,
      };
    }
    const parsed = JSON.parse(block.text) as ParsedResult;
    return { fixture, model, ms, inputTokens, outputTokens, parsed, error: null };
  } catch (e) {
    const ms = performance.now() - start;
    return {
      fixture,
      model,
      ms,
      inputTokens: 0,
      outputTokens: 0,
      parsed: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function toScoredCall(raw: RawCall): ScoredCall {
  if (raw.error || !raw.parsed) {
    return { ms: raw.ms, inputTokens: raw.inputTokens, outputTokens: raw.outputTokens, error: true, typeCorrect: false, kcalInRange: false };
  }
  const { typeCorrect, kcalInRange } = scoreCall(raw.parsed, raw.fixture);
  return { ms: raw.ms, inputTokens: raw.inputTokens, outputTokens: raw.outputTokens, error: false, typeCorrect, kcalInRange };
}

function timestampSlug(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "Missing ANTHROPIC_API_KEY. Copy .env.example to .env, add your key, and rerun `npm run eval`.",
    );
    process.exit(1);
  }

  const models = process.env.EVAL_MODELS
    ? process.env.EVAL_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : DEFAULT_MODELS;

  const client = new Anthropic({ apiKey });
  const allRaw: RawCall[] = [];

  for (const model of models) {
    console.error(`Running ${FIXTURES.length} fixtures against ${model}...`);
    const results = await runChunked(FIXTURES, CONCURRENCY, (fixture) => callModel(client, model, fixture));
    allRaw.push(...results);
  }

  const summaries = models.map((model) => {
    const scored = allRaw.filter((c) => c.model === model).map(toScoredCall);
    const pricing = PRICING[model] ?? null;
    return { model, ...summarize(scored, pricing) };
  });

  console.log("\nPer-model summary:");
  console.table(
    summaries.map((s) => ({
      model: s.model,
      n: s.n,
      errors: s.errors,
      medianMs: Math.round(s.medianMs),
      p95Ms: Math.round(s.p95Ms),
      typeAcc: `${s.typeAccuracyPct.toFixed(0)}%`,
      kcalInRange: `${s.kcalInRangePct.toFixed(0)}%`,
      totalCostUsd: s.totalCostUsd == null ? "n/a" : `$${s.totalCostUsd.toFixed(4)}`,
      costPer100: s.costPer100Usd == null ? "n/a" : `$${s.costPer100Usd.toFixed(2)}`,
      note: s.costNote ?? "",
    })),
  );

  const fixtureTable: Record<string, Record<string, string>> = {};
  for (const fixture of FIXTURES) fixtureTable[fixture.text] = {};
  for (const raw of allRaw) {
    fixtureTable[raw.fixture.text][raw.model] = raw.error ? "ERROR" : `${raw.parsed!.type}/${raw.parsed!.amount}`;
  }
  console.log("\nPer-fixture outputs (type/amount):");
  console.table(fixtureTable);

  const outPath = path.join(import.meta.dirname, `results-${timestampSlug(new Date())}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        models,
        fixtures: FIXTURES,
        calls: allRaw,
        summaries,
      },
      null,
      2,
    ),
  );
  console.error(`\nWrote ${outPath}`);
}

main();
