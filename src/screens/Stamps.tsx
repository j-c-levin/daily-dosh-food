import type { Period } from "../lib/types";
import { balance, daysBetween, stampCaption, todayISO } from "../lib/period";
import { colors, mono } from "../theme";

interface StampsProps {
  periods: Period[];
  onBack: () => void;
}

export default function Stamps({ periods, onBack }: StampsProps) {
  const sealed = periods.filter((p) => p.outcome != null);
  const captions = sealed.map((_, i) => stampCaption(sealed, i)).filter((c): c is string => c != null);

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          <span onClick={onBack} style={{ cursor: "pointer", color: colors.muted, fontSize: 14 }}>
            ← Back
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, marginLeft: "auto", marginRight: "auto" }}>
            Stamps
          </span>
        </div>

        {sealed.length === 0 ? (
          <EmptyState periods={periods} />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "row", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
              {sealed.map((period, i) => (
                <Stamp key={period.id} period={period} index={i} />
              ))}
            </div>
            {captions.length > 0 && (
              <div style={{ marginTop: 20 }}>
                {captions.map((caption, i) => (
                  <p key={i} style={{ color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
                    {caption}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ periods }: { periods: Period[] }) {
  const last = periods[periods.length - 1];
  const days = last ? daysBetween(todayISO(), last.endDate) : 0;
  return (
    <p style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
      No sealed periods yet — your first stamp lands in {days} days.
    </p>
  );
}

function Stamp({ period, index }: { period: Period; index: number }) {
  const isPositive = period.outcome === "positive";
  const color = isPositive ? colors.positive : colors.negative;
  const rotation = ((index % 5) - 2) * 2;
  const finalBalance = balance(period, period.endDate);

  return (
    <div
      style={{
        flex: "0 0 auto",
        width: 120,
        height: 120,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transform: `rotate(${rotation}deg)`,
        textAlign: "center",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color }}>
        {isPositive ? "IN CREDIT" : "OVERDRAWN"}
      </span>
      <span style={{ fontSize: 11, color: colors.muted }}>
        P{index + 1} · {period.startDate}–{period.endDate}
      </span>
      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: colors.text }}>
        {finalBalance >= 0 ? "+" : "−"}
        {Math.abs(finalBalance)}
      </span>
    </div>
  );
}
