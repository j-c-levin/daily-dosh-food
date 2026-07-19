import { colors, mono } from "../theme";
import { sugarLevel, SUGAR_LEVEL_COLORS } from "../lib/sugar";

interface SugarGaugeProps {
  usedG: number;      // grams consumed today
  allowanceG: number; // today's base + bonus (can dip ≤ 0 after sugar debt)
}

export default function SugarGauge({ usedG, allowanceG }: SugarGaugeProps) {
  const used = Math.round(usedG);
  const allowance = Math.max(0, Math.round(allowanceG));
  const over = used > allowance;
  const fraction = allowance > 0 ? Math.min(1, usedG / allowanceG) : 1;
  const fill = over ? colors.negative : SUGAR_LEVEL_COLORS[sugarLevel(used)];
  return (
    <div style={{ background: colors.card, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: colors.muted }}>Sugar today</span>
        <span style={{ fontFamily: mono, color: over ? colors.negative : colors.text }}>
          {used}g of {allowance}g
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: colors.divider, overflow: "hidden" }}>
        <div style={{ width: `${fraction * 100}%`, height: "100%", background: fill, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
