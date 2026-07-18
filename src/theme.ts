import type { CSSProperties } from "react";

export const colors = {
  bg: "#0B0D10",
  card: "#14171C",
  border: "#2A2F37",
  text: "#EDEFF2",
  muted: "#8A9099",
  faint: "#6B7280",
  positive: "#3DDC97",
  negative: "#E07856",
  divider: "#22262D",
  inputBorder: "#3A3F47",
} as const;

export const mono = "'IBM Plex Mono', monospace";
export const sans = "'Inter', sans-serif";

export const cardStyle: CSSProperties = { background: colors.card, borderRadius: 16 };

export const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: colors.bg,
  border: `1px solid ${colors.inputBorder}`, borderRadius: 8,
  padding: "10px 12px", color: colors.text, fontSize: 14, outline: "none",
};

export const labelStyle: CSSProperties = { fontSize: 12, color: colors.muted };

export const buttonPrimary: CSSProperties = {
  background: colors.positive, border: "none", color: colors.bg,
  borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

export const buttonGhost: CSSProperties = {
  background: "none", border: `1px solid ${colors.inputBorder}`, color: colors.muted,
  borderRadius: 8, padding: "12px 0", fontSize: 14, cursor: "pointer",
};
