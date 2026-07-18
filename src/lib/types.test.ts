import { emptyState, DEFAULT_MODEL } from "./types";

test("emptyState shape", () => {
  expect(emptyState()).toEqual({ schemaVersion: 1, periods: [] });
  expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6");
});
