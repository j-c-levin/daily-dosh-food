import type { AppState, Entry, Period } from "./types";

const DAY_MS = 86_400_000;

const parts = (d: string) => d.split("-").map(Number) as [number, number, number];

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY_MS);
}

export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function makePeriod(
  startDate: string,
  budgetPerDay: number,
  sugarBudgetPerDay: number,
  lengthDays: number,
): Period {
  return {
    id: crypto.randomUUID(),
    startDate,
    endDate: addDays(startDate, lengthDays - 1),
    budgetPerDay,
    sugarBudgetPerDay,
    entries: [],
  };
}

export function daysElapsed(period: Period, today: string): number {
  const length = daysBetween(period.startDate, period.endDate) + 1;
  return Math.max(0, Math.min(daysBetween(period.startDate, today) + 1, length));
}

export function accruedBudget(period: Period, today: string): number {
  return daysElapsed(period, today) * period.budgetPerDay;
}

export function entryTotals(entries: Entry[]): { consumed: number; earned: number } {
  let consumed = 0, earned = 0;
  for (const e of entries) e.type === "debit" ? (consumed += e.amount) : (earned += e.amount);
  return { consumed, earned };
}

export function balance(period: Period, today: string): number {
  const { consumed, earned } = entryTotals(period.entries);
  return accruedBudget(period, today) - consumed + earned;
}

export function paceInfo(period: Period, today: string) {
  const elapsed = Math.max(1, daysElapsed(period, today));
  const bal = balance(period, today);
  const avgPerDay = Math.round(bal / elapsed);
  const daysLeft = Math.max(0, daysBetween(today, period.endDate));
  return { avgPerDay, daysLeft, projectedEnd: bal + avgPerDay * daysLeft };
}

export function currentPeriod(state: AppState): Period | undefined {
  const last = state.periods[state.periods.length - 1];
  return last && !last.outcome ? last : undefined;
}

export function rollover(state: AppState, today: string): AppState {
  const settings = state.settings;
  if (!settings) return state;
  const budgetNow = settings.tdee - settings.deficit;
  const sugarNow = settings.sugarBudget;
  const periods = state.periods.map((p) => ({ ...p, entries: [...p.entries] }));

  if (periods.length === 0) {
    periods.push(makePeriod(settings.anchorDate, budgetNow, sugarNow, settings.periodLengthDays));
  }
  let changed = state.periods.length === 0;

  let last = periods[periods.length - 1];
  while (!last.outcome && daysBetween(last.endDate, today) > 0) {
    last.outcome = balance(last, last.endDate) >= 0 ? "positive" : "negative";
    const next = makePeriod(addDays(last.endDate, 1), budgetNow, sugarNow, settings.periodLengthDays);
    periods.push(next);
    last = next;
    changed = true;
  }
  return changed ? { ...state, periods } : state;
}

export function dailyBalances(period: Period, today: string): number[] {
  const days = daysElapsed(period, today);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(period.startDate, i);
    const upTo = period.entries.filter((e) => daysBetween(e.date, day) >= 0);
    const { consumed, earned } = entryTotals(upTo);
    out.push((i + 1) * period.budgetPerDay - consumed + earned);
  }
  return out;
}

export function stampCaption(sealed: Period[], index: number): string | null {
  const p = sealed[index];
  if (!p || p.outcome !== "negative") return null;
  const prev = sealed[index - 1];
  const next = sealed[index + 1];
  if (prev?.outcome === "positive" && next?.outcome === "positive") {
    return `P${index + 1} ran overdrawn but P${index} and P${index + 2} either side stayed in credit — the dip didn't spread`;
  }
  return null;
}
