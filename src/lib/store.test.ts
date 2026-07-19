import { renderHook, act } from "@testing-library/react";
import { loadState, saveState, exportJSON, importJSON, useAppState } from "./store";
import { STORAGE_KEY, emptyState } from "./types";
import type { AppState, Period, Settings } from "./types";

const settings: Settings = {
  tdee: 2300, deficit: 500, sugarBudget: 30, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5",
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

test("exportJSON strips the API key so it never lands in a downloadable backup", () => {
  const withKey = { ...settings, apiKey: "sk-ant-super-secret" };
  const s = { ...emptyState(), settings: withKey };
  const json = exportJSON(s);
  expect(json).not.toContain("sk-ant-super-secret");
  expect(json).not.toContain("apiKey");
});

test("exportJSON/importJSON round-trip equals the state minus apiKey", () => {
  const withKey = { ...settings, apiKey: "sk-ant-super-secret" };
  const s = { ...emptyState(), settings: withKey };
  const { apiKey, ...settingsWithoutKey } = withKey;
  void apiKey;
  expect(importJSON(exportJSON(s))).toEqual({ ...s, settings: settingsWithoutKey });
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

test("hook: updateSettings rewrites the current period's budget immediately; sealed periods stay untouched", () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.completeOnboarding(settings));

  act(() => result.current.updateSettings({ deficit: 300 }));
  expect(result.current.current!.budgetPerDay).toBe(settings.tdee - 300);

  const sealed: Period = {
    id: "sealed-1",
    startDate: "2026-06-17",
    endDate: "2026-06-30",
    budgetPerDay: 1700,
    sugarBudgetPerDay: 30,
    entries: [],
    outcome: "positive",
  };
  const open: Period = {
    id: "open-1",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    budgetPerDay: 1800,
    sugarBudgetPerDay: 30,
    entries: [],
  };
  const imported: AppState = { schemaVersion: 2, settings, periods: [sealed, open] };
  act(() => result.current.replaceState(imported));

  act(() => result.current.updateSettings({ deficit: 300 }));
  expect(result.current.state.periods[0]).toMatchObject({ budgetPerDay: 1700, outcome: "positive" });
  expect(result.current.current!.budgetPerDay).toBe(settings.tdee - 300);
});

test("hook: sugarBudget change rewrites the live period's sugar snapshot; sealed periods stay untouched", () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.completeOnboarding(settings));
  act(() => result.current.updateSettings({ sugarBudget: 25 }));
  expect(result.current.current!.sugarBudgetPerDay).toBe(25);

  const sealed: Period = {
    id: "sealed-1", startDate: "2026-06-17", endDate: "2026-06-30",
    budgetPerDay: 1700, sugarBudgetPerDay: 30, entries: [], outcome: "positive", sugarOutcome: "under",
  };
  const open: Period = {
    id: "open-1", startDate: "2026-07-01", endDate: "2026-07-14",
    budgetPerDay: 1800, sugarBudgetPerDay: 30, entries: [],
  };
  act(() => result.current.replaceState({ schemaVersion: 2, settings, periods: [sealed, open] }));
  act(() => result.current.updateSettings({ sugarBudget: 20 }));
  expect(result.current.state.periods[0]).toMatchObject({ sugarBudgetPerDay: 30, sugarOutcome: "under" });
  expect(result.current.current!.sugarBudgetPerDay).toBe(20);
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

const memStorage = (initial?: Record<string, string>): Storage => {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

test("loadState migrates a v1 blob to schema v2 with sugar defaults", () => {
  const v1 = {
    schemaVersion: 1,
    settings: { tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "m" },
    periods: [{ id: "p1", startDate: "2026-07-01", endDate: "2026-07-14", budgetPerDay: 1800, entries: [] }],
  };
  const s = loadState(memStorage({ "daily-dosh-food:v1": JSON.stringify(v1) }));
  expect(s.schemaVersion).toBe(2);
  expect(s.settings?.sugarBudget).toBe(30);
  expect(s.periods[0].sugarBudgetPerDay).toBe(30);
});

test("loadState passes a v2 blob through untouched", () => {
  const v2 = {
    schemaVersion: 2,
    settings: { tdee: 2300, deficit: 500, sugarBudget: 25, anchorDate: "2026-07-01", periodLengthDays: 14, model: "m" },
    periods: [],
  };
  const s = loadState(memStorage({ "daily-dosh-food:v1": JSON.stringify(v2) }));
  expect(s.settings?.sugarBudget).toBe(25);
});

test("importJSON accepts v1 exports and migrates them", () => {
  const v1 = { schemaVersion: 1, periods: [] };
  expect(importJSON(JSON.stringify(v1)).schemaVersion).toBe(2);
  expect(() => importJSON(JSON.stringify({ schemaVersion: 3, periods: [] }))).toThrow();
});
