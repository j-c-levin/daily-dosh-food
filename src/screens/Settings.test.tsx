import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
vi.mock("../lib/ai", () => ({ testApiKey: vi.fn(async () => ({ ok: true })) }));
import SettingsScreen from "./Settings";
import { useAppState, exportJSON } from "../lib/store";
import type { Settings } from "../lib/types";
import { testApiKey } from "../lib/ai";

const settings: Settings = { tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5" };

const settingsWithStats: Settings = {
  ...settings,
  stats: { sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate" },
};

beforeEach(() => {
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("saves budget changes and tests API key", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  const deficit = screen.getByLabelText(/deficit/i);
  await user.clear(deficit);
  await user.type(deficit, "300");
  await user.click(screen.getByRole("button", { name: /^save$/i }));
  expect(hook.result.current.state.settings!.deficit).toBe(300);
  await user.type(screen.getByLabelText(/api key/i), "sk-ant-x");
  await user.click(screen.getByRole("button", { name: /test key/i }));
  expect(await screen.findByText(/✓/)).toBeInTheDocument();
});

test("shows the error message when key test fails", async () => {
  vi.mocked(testApiKey).mockResolvedValueOnce({ ok: false, error: "invalid x-api-key" });
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  await user.type(screen.getByLabelText(/api key/i), "sk-ant-bad");
  await user.click(screen.getByRole("button", { name: /test key/i }));
  expect(await screen.findByText(/invalid x-api-key/i)).toBeInTheDocument();
});

test("saving an empty API key persists undefined, not an empty string", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding({ ...settings, apiKey: "sk-ant-old" }));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  const apiKey = screen.getByLabelText(/api key/i);
  await user.clear(apiKey);
  await user.click(screen.getByRole("button", { name: /save ai settings/i }));
  expect(hook.result.current.state.settings!.apiKey).toBeUndefined();
});

test("recalculate-from-stats expander is hidden when settings has no stats", () => {
  localStorage.clear();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /recalculate from stats/i })).not.toBeInTheDocument();
});

test("recalculate-from-stats expander is shown and reuses Mifflin fields when stats is present", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settingsWithStats));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /recalculate from stats/i }));
  expect(screen.getByLabelText(/^age$/i)).toHaveValue(30);
  expect(screen.getByLabelText(/height/i)).toHaveValue(180);
  expect(screen.getByLabelText(/weight/i)).toHaveValue(80);
});

test("export downloads a JSON file via a Blob URL", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));

  const createObjectURL = vi.fn(() => "blob:mock-url");
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  let downloadName = "";
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloadName = this.download;
  });

  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /^export$/i }));

  expect(downloadName).toBe("daily-dosh-food-export.json");
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
});

test("import replaces state on success", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);

  const backup = exportJSON({ schemaVersion: 1, settings: settingsWithStats, periods: [] });
  const file = new File([backup], "backup.json", { type: "application/json" });
  const input = screen.getByLabelText(/import/i);
  await user.upload(input, file);

  expect(hook.result.current.state.settings).toEqual(settingsWithStats);
});

test("import shows an alert and does not throw on invalid data", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);

  const file = new File(["not valid json"], "bad.json", { type: "application/json" });
  const input = screen.getByLabelText(/import/i);
  await user.upload(input, file);

  expect(alertSpy).toHaveBeenCalled();
});

test("reset asks for confirmation and only resets when confirmed", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));

  vi.spyOn(window, "confirm").mockReturnValueOnce(false);
  render(<SettingsScreen app={hook.result.current} onBack={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /reset/i }));
  expect(hook.result.current.state.settings).toBeDefined();

  vi.spyOn(window, "confirm").mockReturnValueOnce(true);
  await user.click(screen.getByRole("button", { name: /reset/i }));
  expect(hook.result.current.state.settings).toBeUndefined();
});

test("back button calls onBack", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  const onBack = vi.fn();
  render(<SettingsScreen app={hook.result.current} onBack={onBack} />);
  await user.click(screen.getByText(/back/i));
  expect(onBack).toHaveBeenCalled();
});
