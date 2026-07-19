import { useState } from "react";
import type { CSSProperties } from "react";
import type { Entry, EntryType } from "../lib/types";
import { colors, mono, inputStyle, labelStyle, buttonGhost } from "../theme";

interface EditSheetProps {
  entry: Entry;
  onSave: (patch: { label: string; type: EntryType; amount: number; sugarG?: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}

const toggleBase: CSSProperties = {
  flex: 1,
  border: "none",
  borderRadius: 8,
  padding: "10px 0",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const deleteButtonStyle: CSSProperties = {
  flex: 1,
  background: "none",
  border: `1px solid ${colors.negative}`,
  color: colors.negative,
  borderRadius: 8,
  padding: "12px 0",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const saveButtonStyle: CSSProperties = {
  flex: 2,
  background: colors.positive,
  border: "none",
  color: colors.bg,
  borderRadius: 8,
  padding: "12px 0",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

export default function EditSheet({ entry, onSave, onDelete, onClose }: EditSheetProps) {
  const [label, setLabel] = useState(entry.label);
  const [type, setType] = useState<EntryType>(entry.type);
  const [amount, setAmount] = useState(String(entry.amount));
  const [sugar, setSugar] = useState(entry.sugarG != null ? String(entry.sugarG) : "");

  const numericAmount = Number(amount);
  const numericSugar = sugar.trim() === "" ? undefined : Number(sugar);
  const sugarValid = numericSugar === undefined || (!Number.isNaN(numericSugar) && numericSugar >= 0);
  const isValid = label.trim() !== "" && amount !== "" && !Number.isNaN(numericAmount) && numericAmount >= 0 && sugarValid;

  const handleSave = () => {
    if (!isValid) {
      return;
    }
    onSave({ label, type, amount: numericAmount, sugarG: type === "debit" ? numericSugar : undefined });
  };

  return (
    <div
      data-testid="sheet-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 30,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          boxSizing: "border-box",
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
        }}
      >
        <label style={labelStyle} htmlFor="edit-sheet-label">
          Description
        </label>
        <input
          id="edit-sheet-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ ...inputStyle, margin: "6px 0 14px" }}
        />

        <div style={{ ...labelStyle, marginBottom: 6 }}>Type</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setType("debit")}
            style={
              type === "debit"
                ? { ...toggleBase, background: colors.negative, color: colors.bg }
                : { ...toggleBase, ...buttonGhost, flex: 1 }
            }
          >
            Debit
          </button>
          <button
            type="button"
            onClick={() => setType("credit")}
            style={
              type === "credit"
                ? { ...toggleBase, background: colors.positive, color: colors.bg }
                : { ...toggleBase, ...buttonGhost, flex: 1 }
            }
          >
            Credit
          </button>
        </div>

        <label style={labelStyle} htmlFor="edit-sheet-amount">
          Amount
        </label>
        <input
          id="edit-sheet-amount"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 18px" }}
        />

        {type === "debit" && (
          <>
            <label style={labelStyle} htmlFor="edit-sheet-sugar">
              Sugar (g free sugars, blank = unknown)
            </label>
            <input
              id="edit-sheet-sugar"
              type="number"
              min="0"
              value={sugar}
              onChange={(e) => setSugar(e.target.value)}
              style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 18px" }}
            />
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onDelete} style={deleteButtonStyle}>
            Delete
          </button>
          <button type="button" onClick={handleSave} disabled={!isValid} style={saveButtonStyle}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
