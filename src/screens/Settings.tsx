import { useEffect, useState } from "react";
import type { Activity, Settings, Sex, UserStats } from "../lib/types";
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
  const [sugarInput, setSugarInput] = useState(settings ? String(settings.sugarBudget) : "");
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

  // Per-field dirty tracking. A field becomes dirty the moment the user edits it, and stays
  // dirty until its card's Save clears it. This lets Save write only the fields the user
  // actually touched (an unrelated card's Save can't clobber this card's in-progress draft),
  // and lets the settings-identity resync below skip any field the user is mid-edit on (so a
  // stale mount-time value can never overwrite freshly-imported settings on the next Save,
  // since untouched fields are never included in Save's patch to begin with).
  type DirtyField = "tdee" | "deficit" | "sugarBudget" | "stats" | "apiKey" | "model";
  const [dirty, setDirty] = useState<Set<DirtyField>>(new Set());
  const markDirty = (field: DirtyField) =>
    setDirty((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  const clearDirty = (fields: DirtyField[]) =>
    setDirty((prev) => {
      const next = new Set(prev);
      for (const field of fields) next.delete(field);
      return next;
    });

  // Local form state above is only seeded at mount. If `settings` is replaced wholesale
  // (e.g. via Import), resync every *non-dirty* local field from the new object so a stale
  // draft can't silently overwrite the freshly-imported settings on the next Save. Fields the
  // user is actively editing are left alone — an import (or another card's Save, which also
  // produces a new `settings` reference) must not clobber an in-progress, unsaved draft.
  useEffect(() => {
    if (!settings) return;
    if (!dirty.has("tdee")) setTdeeInput(String(settings.tdee));
    if (!dirty.has("deficit")) setDeficitInput(String(settings.deficit));
    if (!dirty.has("sugarBudget")) setSugarInput(String(settings.sugarBudget));
    if (!dirty.has("stats")) {
      setSex(settings.stats?.sex);
      setAge(settings.stats ? String(settings.stats.age) : "");
      setHeightCm(settings.stats ? String(settings.stats.heightCm) : "");
      setWeightKg(settings.stats ? String(settings.stats.weightKg) : "");
      setActivity(settings.stats?.activity ?? "");
    }
    if (!dirty.has("apiKey")) {
      setApiKeyInput(settings.apiKey ?? "");
      setTestResult(null);
    }
    if (!dirty.has("model")) setModelInput(settings.model ?? DEFAULT_MODEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

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
  const sugarNum = Number(sugarInput);
  const sugarBudgetValid = sugarInput.trim() !== "" && sugarNum >= 0;
  const budgetValid =
    tdeeInput.trim() !== "" &&
    tdeeNum > 0 &&
    deficitInput.trim() !== "" &&
    deficitNum >= 0 &&
    sugarBudgetValid;

  const handleUseRecalculated = () => {
    if (recalculatedTdee !== undefined) {
      setTdeeInput(String(recalculatedTdee));
      markDirty("tdee");
    }
  };

  const handleSaveBudget = () => {
    if (!budgetValid) return;
    const patch: Partial<Settings> = {};
    if (dirty.has("tdee")) patch.tdee = tdeeNum;
    if (dirty.has("deficit")) patch.deficit = deficitNum;
    if (dirty.has("sugarBudget")) patch.sugarBudget = sugarNum;
    if (dirty.has("stats")) patch.stats = draftStats ?? settings.stats;
    app.updateSettings(patch);
    clearDirty(["tdee", "deficit", "sugarBudget", "stats"]);
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testApiKey(apiKeyInput.trim(), modelInput.trim() || DEFAULT_MODEL);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAi = () => {
    const patch: Partial<Settings> = {};
    if (dirty.has("apiKey")) {
      const trimmedKey = apiKeyInput.trim();
      patch.apiKey = trimmedKey === "" ? undefined : trimmedKey;
    }
    if (dirty.has("model")) {
      const trimmedModel = modelInput.trim();
      patch.model = trimmedModel === "" ? DEFAULT_MODEL : trimmedModel;
    }
    app.updateSettings(patch);
    clearDirty(["apiKey", "model"]);
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
      // exportJSON never writes the API key into a backup, so a normal
      // export/import round-trip would otherwise silently delete the
      // current in-browser key. Carry it forward unless the imported file
      // itself specifies one (an explicit key in the import wins).
      const currentApiKey = settings.apiKey;
      const mergedSettings =
        imported.settings && !imported.settings.apiKey && currentApiKey
          ? { ...imported.settings, apiKey: currentApiKey }
          : imported.settings;
      app.replaceState({ ...imported, settings: mergedSettings });
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
            onChange={(e) => {
              setTdeeInput(e.target.value);
              markDirty("tdee");
            }}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
          />

          <label style={labelStyle} htmlFor="settings-deficit">
            Daily deficit (kcal)
          </label>
          <input
            id="settings-deficit"
            type="number"
            value={deficitInput}
            onChange={(e) => {
              setDeficitInput(e.target.value);
              markDirty("deficit");
            }}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 0" }}
          />

          <label style={labelStyle} htmlFor="settings-sugar-budget">
            Daily sugar budget (g free sugars)
          </label>
          <input
            id="settings-sugar-budget"
            type="number"
            min="0"
            value={sugarInput}
            onChange={(e) => {
              setSugarInput(e.target.value);
              markDirty("sugarBudget");
            }}
            style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
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
                        onClick={() => {
                          setSex(s);
                          markDirty("stats");
                        }}
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
                    onChange={(e) => {
                      setAge(e.target.value);
                      markDirty("stats");
                    }}
                    style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
                  />

                  <label style={labelStyle} htmlFor="settings-height">
                    Height (cm)
                  </label>
                  <input
                    id="settings-height"
                    type="number"
                    value={heightCm}
                    onChange={(e) => {
                      setHeightCm(e.target.value);
                      markDirty("stats");
                    }}
                    style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
                  />

                  <label style={labelStyle} htmlFor="settings-weight">
                    Weight (kg)
                  </label>
                  <input
                    id="settings-weight"
                    type="number"
                    value={weightKg}
                    onChange={(e) => {
                      setWeightKg(e.target.value);
                      markDirty("stats");
                    }}
                    style={{ ...inputStyle, fontFamily: mono, margin: "6px 0 14px" }}
                  />

                  <label style={labelStyle} htmlFor="settings-activity">
                    Activity level
                  </label>
                  <select
                    id="settings-activity"
                    value={activity}
                    onChange={(e) => {
                      setActivity(e.target.value as Activity);
                      markDirty("stats");
                    }}
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
            Changes apply immediately to the current period — sealed stamps keep the rules they
            were played under.
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
              markDirty("apiKey");
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
            onChange={(e) => {
              setModelInput(e.target.value);
              markDirty("model");
            }}
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
