import { useState } from "react";
import type { Entry, Settings } from "../lib/types";
import { daysElapsed, daysBetween, dailyBalances, dailySugarGrams, entryTotals, sugarConsumed } from "../lib/period";
import { parseEntry } from "../lib/ai";
import { computeLedger } from "../lib/carryover";
import type { useAppState } from "../lib/store";
import { colors, mono, sans } from "../theme";
import Sparkline from "../components/Sparkline";
import StatBox from "../components/StatBox";
import EntryList from "../components/EntryList";
import MealBreakChips from "../components/MealBreakChips";
import Composer from "../components/Composer";
import EditSheet from "../components/EditSheet";
import SugarGauge from "../components/SugarGauge";

interface DashboardProps {
  app: ReturnType<typeof useAppState>;
  settings: Settings;
  onShowStamps: () => void;
  onShowSettings: () => void;
}

export default function Dashboard({ app, settings, onShowStamps, onShowSettings }: DashboardProps) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  // Local-only placeholder row shown while parseEntry is in flight — never
  // persisted to the store, just what the entry list renders on top.
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pickingMeal, setPickingMeal] = useState(false);

  const period = app.current;

  const handleSubmit = (text: string) => {
    setBusy(true);
    setPendingText(text);
    try {
      // Bring the pending row into view — jsdom doesn't implement scrollTo.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore — non-essential UX polish
    }
    void (async () => {
      try {
        const result = await parseEntry(text, settings);
        app.addEntry(result);
        if (result.source === "fallback" && settings.apiKey) {
          setToast("AI unavailable — logged an estimate, tap to correct");
          setTimeout(() => setToast(null), 4000);
        }
      } finally {
        setBusy(false);
        setPendingText(null);
      }
    })();
  };

  const handleSelect = (entry: Entry) => {
    setEditing(entry);
  };

  if (!period) {
    return null;
  }

  const calLedger = computeLedger(app.state.periods, app.today, "calories");
  const sugarLedger = computeLedger(app.state.periods, app.today, "sugar");
  const calToday = calLedger[calLedger.length - 1];
  const sugarToday = sugarLedger[sugarLedger.length - 1];
  // computeLedger returns [] when `today` precedes the first period's start
  // date (e.g. a timezone shift or clock correction moves "today" backwards)
  // — bail rather than crash on the undefined tail entry.
  if (!calToday || !sugarToday) return null;
  const daySummaries = Object.fromEntries(
    calLedger.map((d, i) => [d.date, { kcalLeftover: d.leftover, sugarUsedG: sugarLedger[i].debits }]),
  );
  const leftToday = Math.round(calToday.leftover);
  const bonusToday = Math.round(calToday.bonus);
  const isPositive = leftToday >= 0;
  const { consumed, earned } = entryTotals(period.entries);
  const dailyBudget = period.budgetPerDay;
  const captionBudgetPerDay = dailyBudget;
  const liveBudgetPerDay = settings.tdee - settings.deficit;
  const budgetChangedMidPeriod = captionBudgetPerDay !== liveBudgetPerDay;
  const sparklineValues = dailyBalances(period, app.today);
  const elapsed = Math.max(1, daysElapsed(period, app.today));
  const avgKcal = Math.round(consumed / elapsed);
  const avgSugar = Math.round(sugarConsumed(period.entries) / elapsed);
  const daysLeft = Math.max(0, daysBetween(app.today, period.endDate));

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: sans, paddingBottom: 100 }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 18px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <span style={{ fontSize: 19, fontWeight: 700 }}>Daily Dosh Food</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={onShowStamps}
              style={{ background: "none", border: "none", color: colors.muted, fontSize: 14, cursor: "pointer" }}
            >
              Stamps →
            </button>
            <button
              onClick={onShowSettings}
              aria-label="Settings"
              style={{ background: "none", border: "none", color: colors.muted, fontSize: 18, cursor: "pointer" }}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Today */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
            {isPositive ? "Left today" : "Over today"}
          </div>
          <div style={{ fontFamily: mono, fontSize: 56, fontWeight: 700, color: isPositive ? colors.positive : colors.negative, lineHeight: 1 }}>
            {isPositive ? "+" : "−"}
            {Math.abs(leftToday)}
          </div>
          <div style={{ fontSize: 13, color: colors.faint, marginTop: 4 }}>
            kcal
            {bonusToday !== 0 && (
              <>
                {" · "}
                {bonusToday > 0
                  ? `includes +${bonusToday} fading bonus`
                  : `−${Math.abs(bonusToday)} carried from yesterday`}
              </>
            )}
          </div>
        </div>

        <SugarGauge usedG={sugarToday.debits} allowanceG={sugarToday.base + sugarToday.bonus} />

        <div style={{ textAlign: "center", color: colors.muted, fontSize: 14, marginBottom: 4 }}>
          eating <span style={{ color: colors.text }}>~{avgKcal} kcal</span> a day ·{" "}
          <span style={{ color: colors.text }}>~{avgSugar}g sugar</span> a day · {daysLeft} days to next period
        </div>
        <div style={{ textAlign: "center", color: colors.faint, fontSize: 12, marginBottom: 24 }}>
          {budgetChangedMidPeriod ? (
            <>
              <span style={{ fontFamily: mono }}>{captionBudgetPerDay}</span> kcal a day this period ·{" "}
              <span style={{ fontFamily: mono }}>{liveBudgetPerDay}</span> from next period
            </>
          ) : (
            <>
              <span style={{ fontFamily: mono }}>{captionBudgetPerDay}</span> kcal a day ·{" "}
              <span style={{ fontFamily: mono }}>{settings.tdee}</span> TDEE −{" "}
              <span style={{ fontFamily: mono }}>{settings.deficit}</span> deficit
            </>
          )}
        </div>

        {/* Sparkline card */}
        <div
          style={{
            background: colors.card,
            borderRadius: 16,
            padding: "20px 16px",
            marginBottom: 16,
            height: 90,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <Sparkline values={sparklineValues} secondary={dailySugarGrams(period, app.today)} />
        </div>

        {/* Stat row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatBox label="Daily budget" value={dailyBudget} />
          <StatBox label="Consumed" value={consumed} />
          <StatBox label="Earned back" value={earned} accent />
        </div>

        {/* Entries */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Recent entries</span>
          <button
            onClick={() => setPickingMeal((p) => !p)}
            style={{
              background: "none", border: `1px solid ${colors.inputBorder}`, color: colors.muted,
              borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer",
            }}
          >
            + Meal break
          </button>
        </div>
        {pickingMeal && (
          <div style={{ marginBottom: 12 }}>
            <MealBreakChips onPick={(m) => { app.addMealBreak(m); setPickingMeal(false); }} />
          </div>
        )}
        <EntryList
          entries={period.entries}
          onSelect={handleSelect}
          pendingText={pendingText}
          daySummaries={daySummaries}
          today={app.today}
          onRenameBreak={app.updateMealBreak}
          onDeleteBreak={app.deleteEntry}
        />
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.card,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            zIndex: 20,
          }}
        >
          {toast}
        </div>
      )}

      <Composer onSubmit={handleSubmit} busy={busy} />

      {editing && (
        <EditSheet
          key={editing.id}
          entry={editing}
          onSave={(patch) => {
            app.updateEntry(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            app.deleteEntry(editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
