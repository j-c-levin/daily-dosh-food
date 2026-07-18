import { useState } from "react";
import type { Activity, Sex, UserStats } from "../lib/types";
import { DEFAULT_MODEL } from "../lib/types";
import { tdee, ACTIVITY_LABELS } from "../lib/tdee";
import { exportJSON, importJSON } from "../lib/store";
import type { useAppState } from "../lib/store";
import { testApiKey } from "../lib/ai";
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

interface SettingsScreenProps {
  app: ReturnType<typeof useAppState>;
  onBack: () => void;
}

const ACTIVITY_KEYS = Object.keys(ACTIVITY_LABELS) as Activity[];

export default function SettingsScreen({ app, onBack }: SettingsScreenProps) {
  const settings = app.state.settings;

  const [tdeeInput, setTdeeInput] = useState(settings ? String(settings.tdee) : "");
  const [deficitInput, setDeficitInput] = useState(settings ? String(settings.deficit) : "");
  const [showStats, setShowStats] = useState(false);
  const [sex, setSex] = useState<Sex | undefined>(settings?.stats?.sex);
  const [age, setAge] = useState(settings?.stats ? String(settings.stats.age) : "");
  const [heightCm, setHeightCm] = useState(settings?.stats ? String(settings.stats.heightCm) : "");
  const [weightKg, setWeightKg] = useState(settings?.stats ? String(settings.stats.weightKg) : "");
  const [activity, setActivity] = useState<Activity | "">(settings?.stats?.activity ?? "");

  const [apiKeyInput, setApiKeyInput] = useState(settings?.apiKey ?? "");
  const [modelInput, setModelInput] = useState(settings?.model ?? DEFAULT_MODEL);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  if (!settings) return null;

  const ageNum = Number(age);
  const heightNum = Number(heightCm);
  const weightNum = Number(weightKg);
  const statsValid =
    sex !== undefined &&
    age.trim() !== "" && ageNum > 0 &&
    heightCm.trim() !== "" && heightNum > 0 &&
    weightKg.trim() !== "" && weightNum > 0 &&
    activity !== "";

  const draftStats: UserStats | undefined = statsValid
    ? { sex: sex as Sex, age: ageNum, heightCm: heightNum, weightKg: weightNum, activity: activity as Activity }
    : undefined;

  const recalculatedTdee = draftStats ? tdee(draftStats) : undefined;

  const tdeeNum = Number(tdeeInput);
  const deficitNum = Number(deficitInput);
  const budgetValid =
    tdeeInput.trim() !== "" && tdeeNum > 0 && deficitInput.trim() !== "" && deficitNum >= 0;

  const handleUseRecalculated = () => {
    if (recalculatedTdee !== undefined) setTdeeInput(String(recalculatedTdee));
  };

  const handleSaveBudget = () => {
    if (!budgetValid) return;
    app.updateSettings({
      tdee: tdeeNum,
      deficit: deficitNum,
      stats: draftStats ?? settings.stats,
    });
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testApiKey(apiKeyInput, modelInput.trim() || DEFAULT_MODEL);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAi = () => {
    app.updateSettings({
      apiKey: apiKeyInput.trim() === "" ? undefined : apiKeyInput,
      model: modelInput.trim() === "" ? DEFAULT_MODEL : modelInput,
    });
  };

  const handleExport = () => {
    const json = exportJSON(app.state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daily-dosh-food-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importJSON(text);
      app.replaceState(imported);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    }
  };

  const handleReset = () => {
    if (confirm("Reset all data? This cannot be undone.")) {
      app.reset();
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: sans }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          <span onClick={onBack} style={{ cursor: "pointer", color: colors.muted, fontSize: 14 }}>
            ← Back
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, marginLeft: "auto", marginRight: "auto" }}>
            Settings
          </span>
        </div>

        {/* Budget */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Budget</div>

          <label style={labelStyle} htmlFor="settings-tdee">
            TDEE (kcal)
          </label>
          <input
            id="settings-tdee"
            type="number"
            value={tdeeInput}
            onChange={(e) => setTdeeInput(e.target.value)}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
          />

          <label style={labelStyle} htmlFor="settings-deficit">
            Daily deficit (kcal)
          </label>
          <input
            id="settings-deficit"
            type="number"
            value={deficitInput}
            onChange={(e) => setDeficitInput(e.target.value)}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 0" }}
          />

          {settings.stats && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setShowStats((v) => !v)}
                style={{ ...buttonGhost, width: "100%" }}
              >
                {showStats ? "Hide recalculate from stats" : "Recalculate from stats"}
              </button>

              {showStats && (
                <div style={{ marginTop: 14 }}>
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
                        {s === "male" ? "Male" : "Female"}
                      </button>
                    ))}
                  </div>

                  <label style={labelStyle} htmlFor="settings-age">
                    Age
                  </label>
                  <input
                    id="settings-age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
                  />

                  <label style={labelStyle} htmlFor="settings-height">
                    Height (cm)
                  </label>
                  <input
                    id="settings-height"
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
                  />

                  <label style={labelStyle} htmlFor="settings-weight">
                    Weight (kg)
                  </label>
                  <input
                    id="settings-weight"
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
                  />

                  <label style={labelStyle} htmlFor="settings-activity">
                    Activity level
                  </label>
                  <select
                    id="settings-activity"
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

                  {recalculatedTdee !== undefined && (
                    <div style={{ marginTop: 14, fontSize: 14, color: colors.muted }}>
                      Computed TDEE:{" "}
                      <span style={{ fontFamily: mono, color: colors.text, fontWeight: 600 }}>
                        {recalculatedTdee}
                      </span>{" "}
                      kcal
                      <button
                        type="button"
                        onClick={handleUseRecalculated}
                        style={{ ...buttonGhost, width: "100%", marginTop: 10 }}
                      >
                        Use this TDEE
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveBudget}
            disabled={!budgetValid}
            style={{
              ...buttonPrimary,
              width: "100%",
              marginTop: 16,
              opacity: budgetValid ? 1 : 0.5,
              cursor: budgetValid ? "pointer" : "not-allowed",
            }}
          >
            Save
          </button>
          <div style={{ marginTop: 10, fontSize: 12, color: colors.faint }}>
            Changes apply from your next period — the current period keeps its budget snapshot.
          </div>
        </div>

        {/* AI */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>AI</div>

          <label style={labelStyle} htmlFor="settings-api-key">
            API key
          </label>
          <input
            id="settings-api-key"
            type="password"
            autoComplete="off"
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              setTestResult(null);
            }}
            style={{ ...inputStyle, margin: "6px 0 14px" }}
          />

          <label style={labelStyle} htmlFor="settings-model">
            Model
          </label>
          <input
            id="settings-model"
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            placeholder={DEFAULT_MODEL}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => void handleTestKey()}
              disabled={testing || apiKeyInput.trim() === ""}
              style={{
                ...buttonGhost,
                flex: 1,
                opacity: testing || apiKeyInput.trim() === "" ? 0.5 : 1,
              }}
            >
              {testing ? "Testing…" : "Test key"}
            </button>
            <button type="button" onClick={handleSaveAi} style={{ ...buttonPrimary, flex: 1 }}>
              Save AI settings
            </button>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: 12,
                fontSize: 14,
                color: testResult.ok ? colors.positive : colors.negative,
              }}
            >
              {testResult.ok ? "✓ Key works" : testResult.error ?? "Key test failed"}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 12, color: colors.faint, lineHeight: 1.5 }}>
            Your key is stored only in this browser and sent only to api.anthropic.com. Use a
            dedicated key with a low spend limit.
          </div>
        </div>

        {/* Data */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Data</div>

          <button
            type="button"
            onClick={handleExport}
            style={{ ...buttonGhost, width: "100%", marginBottom: 14 }}
          >
            Export
          </button>

          <label style={labelStyle} htmlFor="settings-import">
            Import
          </label>
          <input
            id="settings-import"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleImportFile(file);
              e.target.value = "";
            }}
            style={{ ...inputStyle, margin: "6px 0 14px", padding: "8px 6px" }}
          />

          <button
            type="button"
            onClick={handleReset}
            style={{
              ...buttonGhost,
              width: "100%",
              color: colors.negative,
              borderColor: colors.negative,
            }}
          >
            Reset all data
          </button>
        </div>
      </div>
    </div>
  );
}
