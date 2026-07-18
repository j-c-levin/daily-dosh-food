import { useState } from "react";
import type { Entry, Settings } from "../lib/types";
import { balance, paceInfo, dailyBalances, entryTotals } from "../lib/period";
import { parseEntry } from "../lib/ai";
import type { useAppState } from "../lib/store";
import { colors, mono, sans } from "../theme";
import Sparkline from "../components/Sparkline";
import StatBox from "../components/StatBox";
import EntryList from "../components/EntryList";
import Composer from "../components/Composer";
import EditSheet from "../components/EditSheet";

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

  const bal = balance(period, app.today);
  const isPositive = bal >= 0;
  const pace = paceInfo(period, app.today);
  const paceIsPositive = pace.avgPerDay >= 0;
  const finishUp = pace.projectedEnd >= 0;
  const { consumed, earned } = entryTotals(period.entries);
  const dailyBudget = period.budgetPerDay;
  const captionBudgetPerDay = dailyBudget;
  const liveBudgetPerDay = settings.tdee - settings.deficit;
  const budgetChangedMidPeriod = captionBudgetPerDay !== liveBudgetPerDay;
  const sparklineValues = dailyBalances(period, app.today);

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

        {/* Main balance */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
            {isPositive ? "In credit this period" : "Overdrawn this period"}
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 56,
              fontWeight: 700,
              color: isPositive ? colors.positive : colors.negative,
              lineHeight: 1,
            }}
          >
            {isPositive ? "+" : "−"}
            {Math.abs(bal)}
          </div>
          <div style={{ fontSize: 13, color: colors.faint, marginTop: 4 }}>kcal</div>
        </div>

        <div style={{ textAlign: "center", color: colors.muted, fontSize: 14, marginBottom: 4 }}>
          averaging{" "}
          <span style={{ color: colors.text }}>
            {paceIsPositive ? "+" : "−"}
            {Math.abs(pace.avgPerDay)} kcal
          </span>{" "}
          a day · {pace.daysLeft} days to next period
        </div>
        <div style={{ textAlign: "center", color: colors.muted, fontSize: 14, marginBottom: 4 }}>
          at this pace you'll finish{" "}
          <span style={{ color: finishUp ? colors.positive : colors.negative }}>
            {Math.abs(pace.projectedEnd)} {finishUp ? "up" : "down"}
          </span>
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
          <Sparkline values={sparklineValues} />
        </div>

        {/* Stat row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatBox label="Daily budget" value={dailyBudget} />
          <StatBox label="Consumed" value={consumed} />
          <StatBox label="Earned back" value={earned} accent />
        </div>

        {/* Entries */}
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Recent entries</div>
        <EntryList entries={period.entries} onSelect={handleSelect} pendingText={pendingText} />
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
