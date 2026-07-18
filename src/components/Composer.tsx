import { useEffect, useRef, useState } from "react";
import { colors, inputStyle, buttonPrimary, buttonGhost } from "../theme";

interface ComposerProps {
  onSubmit: (text: string) => void;
  busy: boolean;
}

export default function Composer({ onSubmit, busy }: ComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const awaitingClose = useRef(false);

  useEffect(() => {
    if (!busy && awaitingClose.current) {
      awaitingClose.current = false;
      setExpanded(false);
    }
  }, [busy]);

  const cancel = () => {
    setExpanded(false);
    setText("");
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    awaitingClose.current = true;
    onSubmit(trimmed);
    setText("");
  };

  if (!expanded) {
    return (
      <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: colors.positive,
            color: colors.bg,
            border: "none",
            borderRadius: 30,
            padding: "14px 28px",
            fontSize: 15,
            fontWeight: 700,
            boxShadow: "0 4px 20px rgba(61,220,151,0.35)",
            cursor: "pointer",
          }}
        >
          + Add something
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 14,
          width: "88%",
          maxWidth: 380,
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. 100 press ups, or chicken sandwich"
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cancel} style={{ ...buttonGhost, flex: 1 }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !text.trim()} style={{ ...buttonPrimary, flex: 2 }}>
            Log it
          </button>
        </div>
      </div>
    </div>
  );
}
