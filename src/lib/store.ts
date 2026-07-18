import { useCallback, useState } from "react";
import type { AppState, Entry, Settings } from "./types";
import { STORAGE_KEY, emptyState } from "./types";
import { currentPeriod, rollover, todayISO } from "./period";
import type { ParsedEntry } from "./ai";

export function loadState(storage: Storage = localStorage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.periods)) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Not a Daily Dosh Food export");
  }
  const s = parsed as AppState;
  if (s?.schemaVersion !== 1 || !Array.isArray(s.periods)) {
    throw new Error("Not a Daily Dosh Food export");
  }
  return s;
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
      update((s) => (s.settings ? { ...s, settings: { ...s.settings, ...patch } } : s)),
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
