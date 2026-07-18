import { colors, mono } from "../theme";

interface StatBoxProps {
  label: string;
  value: number;
  accent?: boolean;
}

export default function StatBox({ label, value, accent }: StatBoxProps) {
  return (
    <div style={{ flex: 1, background: colors.card, borderRadius: 14, padding: "12px 10px" }}>
      <div style={{ fontSize: 11.5, color: colors.muted, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 16,
          fontWeight: 600,
          color: accent ? colors.positive : colors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}
