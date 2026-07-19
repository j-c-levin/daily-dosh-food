import type { CSSProperties } from "react";
import { colors } from "../theme";
import { MEAL_NAMES, type MealName } from "../lib/types";

interface MealBreakChipsProps {
  current?: MealName;   // highlight the break's existing name when editing
  onPick: (meal: MealName) => void;
  onDelete?: () => void; // present only when editing an existing break
}

const chip: CSSProperties = {
  background: "none", border: `1px solid ${colors.inputBorder}`, color: colors.muted,
  borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer",
};

export default function MealBreakChips({ current, onPick, onDelete }: MealBreakChipsProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {MEAL_NAMES.map((m) => (
        <button
          key={m}
          onClick={() => onPick(m)}
          style={{ ...chip, ...(m === current ? { color: colors.text, borderColor: colors.positive } : {}) }}
        >
          {m}
        </button>
      ))}
      {onDelete && (
        <button onClick={onDelete} style={{ ...chip, color: colors.negative, borderColor: colors.negative }}>
          delete
        </button>
      )}
    </div>
  );
}
