import type { Period } from "./types";
import { addDays, daysBetween } from "./period";

// Decaying carryover: each day's unused surplus feeds the next three days at
// SURPLUS_KERNEL weights; overspend fades on the slower DEBT_KERNEL. Index 0
// is "yesterday". These six numbers are the whole tuning surface.
export const SURPLUS_KERNEL = [0.3, 0.15, 0.05] as const;
export const DEBT_KERNEL = [0.5, 0.25, 0.1] as const;

export type LedgerMode = "calories" | "sugar";

export interface DayLedger {
  date: string;
  base: number;
  bonus: number;
  credits: number;
  debits: number;
  leftover: number;
}

export function computeLedger(periods: Period[], today: string, mode: LedgerMode): DayLedger[] {
  if (periods.length === 0) return [];
  const start = periods[0].startDate;
  const days = daysBetween(start, today) + 1;
  if (days <= 0) return [];

  const debitsByDate = new Map<string, number>();
  const creditsByDate = new Map<string, number>();
  for (const p of periods) {
    for (const e of p.entries) {
      if (e.type === "debit") {
        const value = mode === "calories" ? e.amount : e.sugarG ?? 0;
        debitsByDate.set(e.date, (debitsByDate.get(e.date) ?? 0) + value);
      } else if (mode === "calories") {
        creditsByDate.set(e.date, (creditsByDate.get(e.date) ?? 0) + e.amount);
      }
    }
  }

  const budgetForDay = (date: string): number => {
    for (const p of periods) {
      if (daysBetween(p.startDate, date) >= 0 && daysBetween(date, p.endDate) >= 0) {
        return mode === "calories" ? p.budgetPerDay : p.sugarBudgetPerDay;
      }
    }
    // Past the last period's end (rollover not yet run today): use the
    // latest snapshot rather than pretending there is no budget.
    const last = periods[periods.length - 1];
    return mode === "calories" ? last.budgetPerDay : last.sugarBudgetPerDay;
  };

  const out: DayLedger[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    let bonus = 0;
    for (let k = 0; k < SURPLUS_KERNEL.length; k++) {
      const prev = out[i - 1 - k];
      if (!prev) break;
      bonus += prev.leftover * (prev.leftover >= 0 ? SURPLUS_KERNEL[k] : DEBT_KERNEL[k]);
    }
    const base = budgetForDay(date);
    const credits = creditsByDate.get(date) ?? 0;
    const debits = debitsByDate.get(date) ?? 0;
    out.push({ date, base, bonus, credits, debits, leftover: base + bonus + credits - debits });
  }
  return out;
}

export function todayLedger(periods: Period[], today: string, mode: LedgerMode): DayLedger | undefined {
  const ledger = computeLedger(periods, today, mode);
  return ledger[ledger.length - 1];
}
