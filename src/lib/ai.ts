import Anthropic from "@anthropic-ai/sdk";
import type { EntryType, Settings, UserStats } from "./types";

export interface ParsedEntry {
  label: string;
  type: EntryType;
  amount: number;
  source: "ai" | "fallback";
}

const EXERCISE_WORDS = [
  "press up", "pressup", "push up", "pushup", "sit up", "situp", "squat", "plank",
  "walk", "run", "jog", "sprint", "hike", "gym", "cycle", "cycling", "bike",
  "swim", "workout", "lift", "weights", "yoga", "row", "climb", "stairs", "burpee",
];

export function fallbackParse(text: string): ParsedEntry {
  const lower = text.toLowerCase();
  const isExercise = EXERCISE_WORDS.some((w) => lower.includes(w));
  return {
    label: text.trim(),
    type: isExercise ? "credit" : "debit",
    amount: isExercise ? 100 : 350,
    source: "fallback",
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: "Short tidy description of what was logged" },
    type: { type: "string", enum: ["credit", "debit"], description: "credit = exercise performed, debit = food/drink consumed" },
    amount: { type: "number", description: "Estimated kcal, positive" },
  },
  required: ["label", "type", "amount"],
  additionalProperties: false,
} as const;

function systemPrompt(stats?: UserStats): string {
  const statsLine = stats
    ? ` The person is ${stats.sex}, ${stats.age} years old, ${stats.heightCm} cm, ${stats.weightKg} kg — scale exercise burn estimates to them.`
    : "";
  return (
    "You are the entry parser for a calorie ledger. The user logs one item as free text: " +
    "either something eaten/drunk (a debit) or exercise performed (a credit). " +
    "Estimate total calories for the item as described, using typical portions when unspecified." +
    statsLine
  );
}

export async function parseEntry(text: string, settings: Settings): Promise<ParsedEntry> {
  if (!settings.apiKey) return fallbackParse(text);
  try {
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: settings.model,
      max_tokens: 300,
      system: systemPrompt(settings.stats),
      messages: [{ role: "user", content: text }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
    if (response.stop_reason === "refusal") return fallbackParse(text);
    const block = response.content.find((b: { type: string }) => b.type === "text") as
      | { type: "text"; text: string } | undefined;
    if (!block) return fallbackParse(text);
    const parsed = JSON.parse(block.text) as { label: string; type: EntryType; amount: number };
    return { label: parsed.label, type: parsed.type, amount: Math.max(0, Math.round(parsed.amount)), source: "ai" };
  } catch {
    return fallbackParse(text);
  }
}

export async function testApiKey(apiKey: string, model: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    await client.messages.create({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
