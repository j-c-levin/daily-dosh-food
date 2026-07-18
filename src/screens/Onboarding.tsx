import { useState } from "react";
import type { Activity, Settings, Sex, UserStats } from "../lib/types";
import { DEFAULT_MODEL } from "../lib/types";
import { tdee, ACTIVITY_LABELS } from "../lib/tdee";
import { todayISO } from "../lib/period";
import {
  colors,
  sans,
  mono,
  cardStyle,
  inputStyle,
  labelStyle,
  buttonPrimary,
  buttonGhost,
} from "../theme";

interface OnboardingProps {
  onComplete: (settings: Settings) => void;
}

const ACTIVITY_KEYS = Object.keys(ACTIVITY_LABELS) as Activity[];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [sex, setSex] = useState<Sex | undefined>(undefined);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activity, setActivity] = useState<Activity | "">("");
  const [deficit, setDeficit] = useState("500");
  const [showOverride, setShowOverride] = useState(false);
  const [directTdee, setDirectTdee] = useState("");

  const ageNum = Number(age);
  const heightNum = Number(heightCm);
  const weightNum = Number(weightKg);

  const statsValid =
    sex !== undefined &&
    age.trim() !== "" &&
    ageNum > 0 &&
    heightCm.trim() !== "" &&
    heightNum > 0 &&
    weightKg.trim() !== "" &&
    weightNum > 0 &&
    activity !== "";

  const stats: UserStats | undefined = statsValid
    ? { sex: sex as Sex, age: ageNum, heightCm: heightNum, weightKg: weightNum, activity: activity as Activity }
    : undefined;

  const computedTdee = stats ? tdee(stats) : undefined;

  const directTdeeNum = Number(directTdee);
  const directOverride =
    directTdee.trim() !== "" && directTdeeNum > 0 ? directTdeeNum : undefined;

  const effectiveTdee = directOverride ?? computedTdee;

  const deficitNum = Number(deficit);
  const deficitValid = deficit.trim() !== "" && deficitNum >= 0;

  const canStart = effectiveTdee !== undefined && deficitValid;

  const dailyBudget =
    effectiveTdee !== undefined && deficitValid ? effectiveTdee - deficitNum : undefined;

  const handleStart = () => {
    if (!canStart || effectiveTdee === undefined) return;
    onComplete({
      tdee: effectiveTdee,
      deficit: deficitNum,
      stats,
      anchorDate: todayISO(),
      periodLengthDays: 14,
      model: DEFAULT_MODEL,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text,
        fontFamily: sans,
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 18px" }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
          Daily Dosh
        </div>

        <div style={{ ...cardStyle, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            Tell us about yourself
          </div>

          <label style={labelStyle}>Sex</label>
          <div style={{ display: "flex", gap: 8, margin: "6px 0 14px" }}>
            {(["male", "female"] as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: sex === s ? "1px solid transparent" : `1px solid ${colors.inputBorder}`,
                  background: sex === s ? colors.positive : "none",
                  color: sex === s ? colors.bg : colors.muted,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {/* Distinct accessible names — "Female" contains "male" as a substring, which
                    collides with the /male/i test query, so the second option is "Woman". */}
                {s === "male" ? "Male" : "Woman"}
              </button>
            ))}
          </div>

          <label style={labelStyle} htmlFor="onboarding-age">
            Age
          </label>
          <input
            id="onboarding-age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
          />

          <label style={labelStyle} htmlFor="onboarding-height">
            Height (cm)
          </label>
          <input
            id="onboarding-height"
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
          />

          <label style={labelStyle} htmlFor="onboarding-weight">
            Weight (kg)
          </label>
          <input
            id="onboarding-weight"
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
          />

          <label style={labelStyle} htmlFor="onboarding-activity">
            Activity level
          </label>
          <select
            id="onboarding-activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value as Activity)}
            style={{ ...inputStyle, margin: "6px 0 0" }}
          >
            <option value="" disabled>
              Select activity level
            </option>
            {ACTIVITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {ACTIVITY_LABELS[key]}
              </option>
            ))}
          </select>

          {computedTdee !== undefined && (
            <div style={{ marginTop: 14, fontSize: 14, color: colors.muted }}>
              Computed TDEE:{" "}
              <span style={{ fontFamily: mono, color: colors.text, fontWeight: 600 }}>
                {computedTdee}
              </span>{" "}
              kcal
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, padding: 18, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowOverride((v) => !v)}
            style={{ ...buttonGhost, width: "100%" }}
          >
            {showOverride ? "Hide direct TDEE entry" : "I already know my TDEE"}
          </button>

          {showOverride && (
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle} htmlFor="onboarding-direct-tdee">
                Your TDEE (kcal)
              </label>
              <input
                id="onboarding-direct-tdee"
                type="number"
                value={directTdee}
                onChange={(e) => setDirectTdee(e.target.value)}
                style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 0" }}
              />
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, padding: 18, marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="onboarding-deficit">
            Daily deficit (kcal)
          </label>
          <input
            id="onboarding-deficit"
            type="number"
            value={deficit}
            onChange={(e) => setDeficit(e.target.value)}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 0" }}
          />

          {dailyBudget !== undefined && (
            <div style={{ marginTop: 14, fontSize: 14, color: colors.muted }}>
              Daily budget:{" "}
              <span style={{ fontFamily: mono, color: colors.positive, fontWeight: 700 }}>
                {dailyBudget} kcal
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          style={{
            ...buttonPrimary,
            width: "100%",
            opacity: canStart ? 1 : 0.5,
            cursor: canStart ? "pointer" : "not-allowed",
          }}
        >
          Start tracking
        </button>
      </div>
    </div>
  );
}
