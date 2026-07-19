import { vi, type Mock } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { fallbackParse, parseEntry } from "./ai";
import type { Settings } from "./types";

const settings = (over: Partial<Settings> = {}): Settings => ({
  tdee: 2300, deficit: 500, sugarBudget: 30, anchorDate: "2026-07-01", periodLengthDays: 14,
  model: "claude-haiku-4-5", ...over,
});

beforeEach(() => createMock.mockReset());

test("fallbackParse classifies exercise words as credit", () => {
  expect(fallbackParse("100 press ups")).toMatchObject({ type: "credit", source: "fallback" });
  expect(fallbackParse("chicken sandwich")).toMatchObject({ type: "debit", source: "fallback" });
  expect(fallbackParse("30 min run").amount).toBeGreaterThan(0);
});

test("parseEntry without apiKey uses fallback and never calls the API", async () => {
  const r = await parseEntry("toast", settings());
  expect(r.source).toBe("fallback");
  expect(createMock).not.toHaveBeenCalled();
});

test("parseEntry with key returns structured AI result", async () => {
  createMock.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ label: "Chicken sandwich", type: "debit", amount: 480 }) }],
  });
  const r = await parseEntry("chicken sandwich", settings({ apiKey: "sk-ant-test" }));
  expect(r).toEqual({ label: "Chicken sandwich", type: "debit", amount: 480, source: "ai" });
  const req = (createMock as Mock).mock.calls[0][0];
  expect(req.model).toBe("claude-haiku-4-5");
  expect(req.output_config.format.type).toBe("json_schema");
});

test("parseEntry includes stats in the system prompt when present", async () => {
  createMock.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ label: "x", type: "debit", amount: 1 }) }],
  });
  await parseEntry("x", settings({
    apiKey: "k",
    stats: { sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate" },
  }));
  expect((createMock as Mock).mock.calls[0][0].system).toContain("80");
});

test("parseEntry falls back on API error or refusal", async () => {
  createMock.mockRejectedValueOnce(new Error("network"));
  expect((await parseEntry("toast", settings({ apiKey: "k" }))).source).toBe("fallback");
  createMock.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
  expect((await parseEntry("toast", settings({ apiKey: "k" }))).source).toBe("fallback");
});
