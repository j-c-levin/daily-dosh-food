import { useState, type ReactNode } from "react";
import type { Entry, LedgerItem, MealName } from "../lib/types";
import { isMealBreak } from "../lib/types";
import { colors, mono } from "../theme";
import { sugarLevel, SUGAR_LEVEL_COLORS } from "../lib/sugar";
import MealBreakChips from "./MealBreakChips";

export interface DaySummary {
  kcalLeftover: number; // that day's ledger leftover (positive = finished under)
  sugarUsedG: number;   // grams of free sugars consumed that day
}

interface EntryListProps {
  entries: LedgerItem[];
  onSelect: (e: Entry) => void;
  // Raw text of an in-flight submission, shown as a placeholder row above
  // the real entries while parseEntry resolves. Not a persisted Entry.
  pendingText?: string | null;
  daySummaries?: Record<string, DaySummary>; // keyed by ISO date; enables dividers
  today?: string;                            // ISO date rendered as "Today"
  onRenameBreak?: (id: string, meal: MealName) => void;
  onDeleteBreak?: (id: string) => void;
}

const PULSE_KEYFRAMES = `
@keyframes entry-list-pending-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
`;

function sourceCaption(source: Entry["source"]): string {
  switch (source) {
    case "ai":
      return "AI logged";
    case "manual":
      return "manual";
    case "fallback":
      return "estimate — tap to edit";
  }
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]}`;
}

export default function EntryList({ entries, onSelect, pendingText, daySummaries, today, onRenameBreak, onDeleteBreak }: EntryListProps) {
  const [openBreakId, setOpenBreakId] = useState<string | null>(null);
  const rows: ReactNode[] = [];
  let prevDate: string | null = null;
  // Divider grouping assumes entries are date-contiguous (same date never
  // reappears after a different date is seen): the store prepends today's
  // new entries, and EditSheet never lets a date be edited.
  entries.forEach((entry, idx) => {
    if (daySummaries && entry.date !== prevDate) {
      const summary = daySummaries[entry.date];
      const isToday = entry.date === today;
      rows.push(
        <div
          key={`divider-${entry.date}`}
          style={{
            padding: "7px 16px",
            background: colors.bg,
            borderTop: prevDate ? `1px solid ${colors.divider}` : "none",
            borderBottom: `1px solid ${colors.divider}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: colors.muted }}>
            {isToday ? "Today" : formatDate(entry.date)}
          </span>
          {!isToday && summary && (
            <span style={{ fontFamily: mono, fontSize: 11, color: summary.kcalLeftover >= 0 ? colors.positive : colors.negative }}>
              finished {summary.kcalLeftover >= 0 ? "+" : "−"}
              {Math.abs(Math.round(summary.kcalLeftover))} kcal · {Math.round(summary.sugarUsedG)}g sugar
            </span>
          )}
        </div>
      );
    }
    prevDate = entry.date;
    if (isMealBreak(entry)) {
      const open = openBreakId === entry.id;
      rows.push(
        <div
          key={entry.id}
          role="button"
          tabIndex={0}
          aria-label={`${entry.meal} break`}
          onClick={() => setOpenBreakId(open ? null : entry.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              setOpenBreakId(open ? null : entry.id);
            }
          }}
          style={{ padding: "6px 16px", cursor: "pointer" }}
        >
          {open ? (
            // stopPropagation so a chip tap (or Enter/Space on a focused chip)
            // doesn't also toggle the row's own click/keydown handler.
            <div onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
              <MealBreakChips
                current={entry.meal}
                onPick={(m) => { onRenameBreak?.(entry.id, m); setOpenBreakId(null); }}
                onDelete={() => { onDeleteBreak?.(entry.id); setOpenBreakId(null); }}
              />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>
                {entry.meal}
              </span>
              <div style={{ flex: 1, height: 1, background: colors.divider }} />
            </div>
          )}
        </div>
      );
      return;
    }
    rows.push(
      <div
        key={entry.id}
        role="button"
        tabIndex={0}
        aria-label={entry.label}
        onClick={() => onSelect(entry)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(entry);
          }
        }}
        style={{
          padding: "14px 16px",
          borderBottom: (() => {
            const next = entries[idx + 1];
            if (!next || isMealBreak(next)) return "none";
            if (daySummaries) return next.date === entry.date ? `1px solid ${colors.divider}` : "none";
            return `1px solid ${colors.divider}`;
          })(),
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{entry.label}</div>
          <div style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>
            {daySummaries ? sourceCaption(entry.source) : `${formatDate(entry.date)} · ${sourceCaption(entry.source)}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {entry.type === "debit" && entry.sugarG != null && (
            <span
              aria-label={`sugar level ${sugarLevel(entry.sugarG)}`}
              style={{
                fontFamily: mono, fontSize: 11, fontWeight: 700,
                color: colors.bg, background: SUGAR_LEVEL_COLORS[sugarLevel(entry.sugarG)],
                borderRadius: 6, padding: "2px 6px", marginRight: 8,
              }}
            >
              S{sugarLevel(entry.sugarG)}
            </span>
          )}
          <span
            style={{
              fontFamily: mono,
              fontSize: 15,
              fontWeight: 600,
              color: entry.type === "credit" ? colors.positive : colors.negative,
            }}
          >
            {entry.type === "credit" ? "+" : "−"}
            {entry.amount}
          </span>
        </div>
      </div>
    );
  });

  return (
    <div style={{ background: colors.card, borderRadius: 16, overflow: "hidden" }}>
      {pendingText && (
        <>
          <style>{PULSE_KEYFRAMES}</style>
          <div
            style={{
              padding: "14px 16px",
              borderBottom: entries.length > 0 ? `1px solid ${colors.divider}` : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              animation: "entry-list-pending-pulse 1.4s ease-in-out infinite",
            }}
          >
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 500 }}>{pendingText}</div>
              <div style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>estimating…</div>
            </div>
          </div>
        </>
      )}
      {rows}
    </div>
  );
}
