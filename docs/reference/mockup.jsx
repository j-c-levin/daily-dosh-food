import React, { useState } from "react";

const initialItems = [
  { id: 1, label: "Chicken sandwich + coffee", type: "debit", amount: 480, date: "18 Jul", source: "ai" },
  { id: 2, label: "100 press ups", type: "credit", amount: 62, date: "18 Jul", source: "ai" },
  { id: 3, label: "Morning walk, 30 min", type: "credit", amount: 140, date: "18 Jul", source: "ai" },
  { id: 4, label: "Toast + eggs", type: "debit", amount: 390, date: "17 Jul", source: "ai" },
];

function mockAIParse(text) {
  // Placeholder for real API call — returns structured guess
  const lower = text.toLowerCase();
  const exerciseWords = ["press up", "pushup", "walk", "run", "gym", "cycle", "swim", "workout"];
  const isExercise = exerciseWords.some((w) => lower.includes(w));
  return {
    label: text,
    type: isExercise ? "credit" : "debit",
    amount: isExercise ? 80 : 350,
  };
}

export default function DailyDoshFoodMockup() {
  const [items, setItems] = useState(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingItem, setEditingItem] = useState(null); // holds a copy of the item being edited

  const balance = items.reduce(
    (acc, i) => acc + (i.type === "credit" ? i.amount : -i.amount),
    0
  );
  const budget = 1850;
  const remaining = budget + balance; // running total for the day, budget as baseline
  const isPositive = remaining >= 0;
  const daysToNext = 5;
  const pacePerDay = 121;

  const submitDraft = () => {
    if (!draft.trim()) return;
    const parsed = mockAIParse(draft);
    setItems([
      { id: Date.now(), label: parsed.label, type: parsed.type, amount: parsed.amount, date: "Today", source: "ai" },
      ...items,
    ]);
    setDraft("");
    setShowAdd(false);
  };

  const saveEdit = () => {
    setItems(items.map((i) => (i.id === editingItem.id ? editingItem : i)));
    setEditingItem(null);
  };

  const deleteEdit = () => {
    setItems(items.filter((i) => i.id !== editingItem.id));
    setEditingItem(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0D10",
        color: "#EDEFF2",
        fontFamily: "'Inter', sans-serif",
        paddingBottom: 100,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

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
          <span style={{ fontSize: 19, fontWeight: 700 }}>Daily Dosh</span>
          <span style={{ fontSize: 14, color: "#8A9099" }}>Stamps →</span>
        </div>

        {/* Main balance */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: "#8A9099", marginBottom: 8 }}>
            {isPositive ? "In credit today" : "Overdrawn today"}
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 56,
              fontWeight: 700,
              color: isPositive ? "#3DDC97" : "#E07856",
              lineHeight: 1,
            }}
          >
            {isPositive ? "+" : "−"}
            {Math.abs(remaining)}
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>kcal</div>
        </div>

        <div style={{ textAlign: "center", color: "#8A9099", fontSize: 14, marginBottom: 4 }}>
          averaging <span style={{ color: "#EDEFF2" }}>+{pacePerDay} kcal</span> a day · {daysToNext} days to next period
        </div>
        <div style={{ textAlign: "center", color: "#8A9099", fontSize: 14, marginBottom: 24 }}>
          at this pace you'll finish <span style={{ color: "#3DDC97" }}>{pacePerDay * daysToNext} up</span>
        </div>

        {/* Sparkline placeholder */}
        <div
          style={{
            background: "#14171C",
            borderRadius: 16,
            padding: "20px 16px",
            marginBottom: 16,
            height: 90,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
            <polyline
              points="0,50 40,35 80,32 120,30 160,26 200,10 240,20 280,15"
              fill="none"
              stroke="#3DDC97"
              strokeWidth="2.5"
            />
            <polyline
              points="0,55 300,45"
              fill="none"
              stroke="#3A3F47"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
          </svg>
        </div>

        {/* Stat row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatBox label="Period budget" value={budget * 14} />
          <StatBox label="Consumed" value={items.filter(i=>i.type==="debit").reduce((a,i)=>a+i.amount,0)} />
          <StatBox label="Earned back" value={items.filter(i=>i.type==="credit").reduce((a,i)=>a+i.amount,0)} accent />
        </div>

        {/* Transactions */}
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Recent entries</div>
        <div style={{ background: "#14171C", borderRadius: 16, overflow: "hidden" }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => setEditingItem({ ...item })}
              style={{
                padding: "14px 16px",
                borderBottom: idx < items.length - 1 ? "1px solid #22262D" : "none",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{item.date} · AI logged</div>
                </div>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 15,
                    fontWeight: 600,
                    color: item.type === "credit" ? "#3DDC97" : "#E07856",
                  }}
                >
                  {item.type === "credit" ? "+" : "−"}
                  {item.amount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && (
        <div
          onClick={() => setEditingItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#14171C",
              border: "1px solid #2A2F37",
              borderRadius: "20px 20px 0 0",
              padding: "20px 18px 28px",
              width: "100%",
              maxWidth: 420,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Edit entry</div>

            <label style={{ fontSize: 12, color: "#8A9099" }}>Description</label>
            <input
              value={editingItem.label}
              onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0B0D10",
                border: "1px solid #3A3F47",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#EDEFF2",
                fontSize: 14,
                margin: "6px 0 14px",
                outline: "none",
              }}
            />

            <label style={{ fontSize: 12, color: "#8A9099" }}>Type</label>
            <div style={{ display: "flex", gap: 8, margin: "6px 0 14px" }}>
              {["debit", "credit"].map((t) => (
                <button
                  key={t}
                  onClick={() => setEditingItem({ ...editingItem, type: t })}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: editingItem.type === t ? "1px solid transparent" : "1px solid #3A3F47",
                    background: editingItem.type === t ? (t === "credit" ? "#3DDC97" : "#E07856") : "none",
                    color: editingItem.type === t ? "#0B0D10" : "#8A9099",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t === "credit" ? "Credit (earned)" : "Debit (eaten)"}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: "#8A9099" }}>Amount (kcal)</label>
            <input
              type="number"
              value={editingItem.amount}
              onChange={(e) =>
                setEditingItem({ ...editingItem, amount: parseInt(e.target.value, 10) || 0 })
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0B0D10",
                border: "1px solid #3A3F47",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#EDEFF2",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 14,
                margin: "6px 0 20px",
                outline: "none",
              }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={deleteEdit}
                style={{
                  flex: 1,
                  background: "none",
                  border: "1px solid #3A3F47",
                  color: "#E07856",
                  borderRadius: 8,
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                onClick={saveEdit}
                style={{
                  flex: 2,
                  background: "#3DDC97",
                  border: "none",
                  color: "#0B0D10",
                  borderRadius: 8,
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Add button */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              background: "#3DDC97",
              color: "#0B0D10",
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
        ) : (
          <div
            style={{
              background: "#14171C",
              border: "1px solid #2A2F37",
              borderRadius: 16,
              padding: 14,
              width: "88%",
              maxWidth: 380,
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDraft()}
              placeholder="e.g. 100 press ups, or chicken sandwich"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0B0D10",
                border: "1px solid #3A3F47",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#EDEFF2",
                fontSize: 14,
                marginBottom: 10,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  flex: 1,
                  background: "none",
                  border: "1px solid #3A3F47",
                  color: "#8A9099",
                  borderRadius: 8,
                  padding: "10px 0",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitDraft}
                style={{
                  flex: 2,
                  background: "#3DDC97",
                  border: "none",
                  color: "#0B0D10",
                  borderRadius: 8,
                  padding: "10px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Log it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#14171C",
        borderRadius: 14,
        padding: "12px 10px",
      }}
    >
      <div style={{ fontSize: 11.5, color: "#8A9099", marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 16,
          fontWeight: 600,
          color: accent ? "#3DDC97" : "#EDEFF2",
        }}
      >
        {value}
      </div>
    </div>
  );
}
