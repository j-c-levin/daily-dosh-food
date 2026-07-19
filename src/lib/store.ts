import { useCallback, useState } from "react";
import type { AppState, Entry, Period, Settings } from "./types";
import { STORAGE_KEY, emptyState, DEFAULT_SUGAR_BUDGET_G } from "./types";
import { currentPeriod, rollover, todayISO } from "./period";
import type { ParsedEntry } from "./ai";

interface AppStateV1 {
  schemaVersion: 1;
  settings?: Omit<Settings, "sugarBudget">;
  periods: Array<Omit<Period, "sugarBudgetPerDay" | "sugarOutcome">>;
}

// Returns a valid v2 state, or null if the blob is unrecognisable.
export function migrate(parsed: unknown): AppState | null {
  const s = parsed as { schemaVersion?: unknown; periods?: unknown };
  if (!s || !Array.isArray(s.periods)) return null;
  if (s.schemaVersion === 2) return parsed as AppState;
  if (s.schemaVersion === 1) {
    const v1 = parsed as AppStateV1;
    return {
      schemaVersion: 2,
      settings: v1.settings ? { ...v1.settings, sugarBudget: DEFAULT_SUGAR_BUDGET_G } : undefined,
      periods: v1.periods.map((p) => ({ ...p, sugarBudgetPerDay: DEFAULT_SUGAR_BUDGET_G })),
    };
  }
  return null;
}

export function loadState(storage: Storage = localStorage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return migrate(JSON.parse(raw)) ?? emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportJSON(state: AppState): string {
  // Never write the Anthropic API key into a downloadable backup — strip it
  // from the exported settings entirely rather than serializing `undefined`.
  if (!state.settings) return JSON.stringify(state, null, 2);
  const { apiKey, ...safeSettings } = state.settings;
  void apiKey;
  return JSON.stringify({ ...state, settings: safeSettings }, null, 2);
}

export function importJSON(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Not a Daily Dosh Food export");
  }
  const migrated = migrate(parsed);
  if (!migrated) throw new Error("Not a Daily Dosh Food export");
  return migrated;
}

export function useAppState() {
  const today = todayISO();
  const [state, setState] = useState<AppState>(() => {
    const s = rollover(loadState(), today);
    saveState(s);
    return s;
  });

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const mutateCurrent = (fn: (entries: Entry[]) => Entry[]) =>
    update((s) => {
      const periods = [...s.periods];
      const idx = periods.length - 1;
      if (idx < 0 || periods[idx].outcome) return s;
      periods[idx] = { ...periods[idx], entries: fn(periods[idx].entries) };
      return { ...s, periods };
    });

  return {
    state,
    today,
    current: currentPeriod(state),
    completeOnboarding: (settings: Settings) =>
      update((s) => rollover({ ...s, settings }, today)),
    updateSettings: (patch: Partial<Settings>) =>
      update((s) => {
        if (!s.settings) return s;
        const settings = { ...s.settings, ...patch };
        const idx = s.periods.length - 1;
        const last = s.periods[idx];
        const budgetNow = settings.tdee - settings.deficit;
        const sugarNow = settings.sugarBudget;
        // Budget changes take effect immediately on the current (unsealed) period —
        // rewrite its budgetPerDay/sugarBudgetPerDay snapshot so accrual/balance/pace/
        // sparkline retroactively recompute from the period's start date. Sealed
        // periods (stamps) are immutable history and are never touched here.
        if (
          last && !last.outcome &&
          (last.budgetPerDay !== budgetNow || last.sugarBudgetPerDay !== sugarNow)
        ) {
          const periods = [...s.periods];
          periods[idx] = { ...last, budgetPerDay: budgetNow, sugarBudgetPerDay: sugarNow };
          return { ...s, settings, periods };
        }
        return { ...s, settings };
      }),
    addEntry: (parsed: ParsedEntry | Omit<Entry, "id" | "date">) =>
      mutateCurrent((entries) => [
        { id: crypto.randomUUID(), date: today, label: parsed.label, type: parsed.type, amount: parsed.amount, source: parsed.source },
        ...entries,
      ]),
    updateEntry: (id: string, patch: Partial<Pick<Entry, "label" | "type" | "amount">>) =>
      mutateCurrent((entries) => entries.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    deleteEntry: (id: string) => mutateCurrent((entries) => entries.filter((e) => e.id !== id)),
    replaceState: (imported: AppState) => update(() => rollover(imported, today)),
    reset: () => update(() => emptyState()),
  };
}
