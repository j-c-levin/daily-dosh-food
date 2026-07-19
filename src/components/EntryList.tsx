import type { Entry } from "../lib/types";
import { colors, mono } from "../theme";
import { sugarLevel, SUGAR_LEVEL_COLORS } from "../lib/sugar";

interface EntryListProps {
  entries: Entry[];
  onSelect: (e: Entry) => void;
  // Raw text of an in-flight submission, shown as a placeholder row above
  // the real entries while parseEntry resolves. Not a persisted Entry.
  pendingText?: string | null;
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

export default function EntryList({ entries, onSelect, pendingText }: EntryListProps) {
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
      {entries.map((entry, idx) => (
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
            borderBottom: idx < entries.length - 1 ? `1px solid ${colors.divider}` : "none",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 500 }}>{entry.label}</div>
            <div style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>
              {formatDate(entry.date)} · {sourceCaption(entry.source)}
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
      ))}
    </div>
  );
}
