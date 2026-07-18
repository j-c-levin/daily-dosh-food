import { renderHook, act } from "@testing-library/react";
import { loadState, saveState, exportJSON, importJSON, useAppState } from "./store";
import { STORAGE_KEY, emptyState } from "./types";
import type { Settings } from "./types";

const settings: Settings = {
  tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5",
};

// The hook computes "today" from the real system clock (todayISO() with no
// override, per the brief). Pin it inside settings.anchorDate's first period
// so the hook/rollover tests are deterministic regardless of the calendar
// date this suite runs on.
beforeEach(() => {
  localStorage.clear();
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

test("loadState returns empty state when nothing stored or corrupt", () => {
  expect(loadState()).toEqual(emptyState());
  localStorage.setItem(STORAGE_KEY, "{corrupt");
  expect(loadState()).toEqual(emptyState());
});

test("save/load round-trip", () => {
  const s = { ...emptyState(), settings };
  saveState(s);
  expect(loadState()).toEqual(s);
});

test("import rejects foreign JSON", () => {
  expect(() => importJSON('{"foo": 1}')).toThrow(/Daily Dosh Food/);
  const s = { ...emptyState(), settings };
  expect(importJSON(exportJSON(s))).toEqual(s);
});

test("hook: onboarding creates settings and first period, addEntry lands in current period", () => {
  const { result } = renderHook(() => useAppState());
  expect(result.current.state.settings).toBeUndefined();
  act(() => result.current.completeOnboarding(settings));
  expect(result.current.current).toBeDefined();
  act(() => result.current.addEntry({ label: "toast", type: "debit", amount: 300, source: "manual" }));
  expect(result.current.current!.entries).toHaveLength(1);
  expect(result.current.current!.entries[0].date).toBe(result.current.today);
  // persisted
  expect(loadState().periods[0].entries).toHaveLength(1);
});

test("hook: updateEntry and deleteEntry", () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.completeOnboarding(settings));
  act(() => result.current.addEntry({ label: "toast", type: "debit", amount: 300, source: "manual" }));
  const id = result.current.current!.entries[0].id;
  act(() => result.current.updateEntry(id, { amount: 250, type: "credit" }));
  expect(result.current.current!.entries[0]).toMatchObject({ amount: 250, type: "credit" });
  act(() => result.current.deleteEntry(id));
  expect(result.current.current!.entries).toHaveLength(0);
});
