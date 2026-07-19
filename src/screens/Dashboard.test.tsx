import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../lib/ai", () => ({
  parseEntry: vi.fn(async (text: string) => ({ label: text, type: "debit", amount: 400, source: "ai" })),
}));

import Dashboard from "./Dashboard";
import { useAppState } from "../lib/store";
import { parseEntry, type ParsedEntry } from "../lib/ai";
import type { Entry, Period, Settings } from "../lib/types";

const settings: Settings = {
  tdee: 2300, deficit: 500, sugarBudget: 30, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5", apiKey: "k",
};

beforeEach(() => {
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  localStorage.clear();
  const hook = renderHook(() => useAppState());
  act(() => hook.result.current.completeOnboarding(settings));
  const view = () =>
    render(
      <Dashboard app={hook.result.current} settings={settings} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
    );
  return { hook, view };
}

test("shows balance, pace and stat row", () => {
  const { view } = setup();
  view();
  expect(screen.getByText(/left today/i)).toBeInTheDocument();
  expect(screen.getByText(/daily budget/i)).toBeInTheDocument();
  expect(screen.getByText(/earned back/i)).toBeInTheDocument();
});

test("shows plain daily intake averages instead of period pace/projection", () => {
  // 1800 kcal day 1 + 1200 kcal day 2, today 2026-07-03 (elapsed 3 days),
  // period 07-01..07-14 → consumed 3000 ÷ 3 = 1000 kcal/day, sugar 0g/day,
  // daysLeft = daysBetween(07-03, 07-14) = 11.
  renderWithEntries([
    day({ amount: 1800, date: "2026-07-01" }),
    day({ amount: 1200, date: "2026-07-02" }),
  ]);
  expect(screen.getByText(/eating/i)).toHaveTextContent(
    "eating ~1000 kcal a day · ~0g sugar a day · 11 days to next period"
  );
  expect(screen.queryByText(/at this pace/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/period \+/i)).not.toBeInTheDocument();
});

test("composer logs an entry through parseEntry", async () => {
  const user = userEvent.setup();
  const { hook, view } = setup();
  const { rerender } = view();
  await user.click(screen.getByRole("button", { name: /add something/i }));
  await user.type(screen.getByPlaceholderText(/press ups/i), "chicken sandwich");
  await user.click(screen.getByRole("button", { name: /log it/i }));
  rerender(
    <Dashboard app={hook.result.current} settings={settings} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
  );
  expect(hook.result.current.current!.entries[0]).toMatchObject({ label: "chicken sandwich", amount: 400 });
});

test("shows a pulsing pending row while parseEntry is in flight, then swaps it for the real entry", async () => {
  let resolveParse!: (value: ParsedEntry) => void;
  const pending = new Promise<ParsedEntry>((resolve) => {
    resolveParse = resolve;
  });
  vi.mocked(parseEntry).mockReturnValueOnce(pending);

  const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

  const user = userEvent.setup();
  const { hook, view } = setup();
  const { rerender } = view();

  await user.click(screen.getByRole("button", { name: /add something/i }));
  await user.type(screen.getByPlaceholderText(/press ups/i), "chicken sandwich");
  await user.click(screen.getByRole("button", { name: /log it/i }));

  // Composer collapses and the pending row appears before parseEntry resolves.
  expect(screen.queryByPlaceholderText(/press ups/i)).not.toBeInTheDocument();
  expect(screen.getByText("chicken sandwich")).toBeInTheDocument();
  expect(screen.getByText(/estimating/i)).toBeInTheDocument();
  expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));

  await act(async () => {
    resolveParse({ label: "chicken sandwich", type: "debit", amount: 400, source: "ai" });
    await pending;
  });
  rerender(
    <Dashboard app={hook.result.current} settings={settings} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
  );

  expect(screen.queryByText(/estimating/i)).not.toBeInTheDocument();
  expect(hook.result.current.current!.entries[0]).toMatchObject({ label: "chicken sandwich", amount: 400 });

  scrollToSpy.mockRestore();
});

test("caption shows a this-period/next-period split when an imported backup's period budget diverges from settings", () => {
  // updateSettings now self-heals the current period's budget immediately, so mid-period
  // divergence can no longer arise from the Settings save path. It's still reachable via
  // an imported backup whose open period predates a settings change made elsewhere —
  // exercise that path instead to keep this caption branch covered.
  const { hook, view } = setup();
  const { rerender } = view();

  const importedSettings: Settings = { ...settings, tdee: 2000 };
  const openPeriod: Period = {
    id: "open-1",
    startDate: hook.result.current.current!.startDate,
    endDate: hook.result.current.current!.endDate,
    budgetPerDay: 1800,
    sugarBudgetPerDay: 30,
    entries: [],
  };
  act(() =>
    hook.result.current.replaceState({ schemaVersion: 2, settings: importedSettings, periods: [openPeriod] })
  );
  rerender(
    <Dashboard
      app={hook.result.current}
      settings={hook.result.current.state.settings!}
      onShowStamps={vi.fn()}
      onShowSettings={vi.fn()}
    />
  );

  const caption = screen.getByText(/from next period/i);
  expect(caption).toHaveTextContent("1800 kcal a day this period · 1500 from next period");
});

const day = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), label: "x", type: "debit", amount: 0, date: "2026-07-01", source: "manual", ...over,
});

function renderWithEntries(entries: Entry[]) {
  const { hook, view } = setup();
  const { rerender } = view();
  const open: Period = {
    id: "open-1", startDate: "2026-07-01", endDate: "2026-07-14",
    budgetPerDay: 1800, sugarBudgetPerDay: 30, entries,
  };
  act(() => hook.result.current.replaceState({
    schemaVersion: 2, settings: hook.result.current.state.settings!, periods: [open],
  }));
  rerender(
    <Dashboard app={hook.result.current} settings={hook.result.current.state.settings!} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
  );
  return hook;
}

test("big number shows calories left today including the decayed bonus", () => {
  // Day 1: ate 1800 → leftover 0. Day 2: ate 1200 → leftover 600.
  // Today (day 3): bonus = 0.30×600 = 180, left = 1800 + 180 = 1980.
  renderWithEntries([
    day({ amount: 1800, date: "2026-07-01" }),
    day({ amount: 1200, date: "2026-07-02" }),
  ]);
  expect(screen.getByText("Left today")).toBeInTheDocument();
  expect(screen.getByText("+1980")).toBeInTheDocument();
  expect(screen.getByText(/includes \+180 fading bonus/)).toBeInTheDocument();
});

test("debt carry shows a negative subline", () => {
  // Day 1: ate 1800 → leftover 0. Day 2: ate 2800 → leftover −1000.
  // Today: bonus = 0.50×−1000 = −500, left = 1300.
  renderWithEntries([
    day({ amount: 1800, date: "2026-07-01" }),
    day({ amount: 2800, date: "2026-07-02" }),
  ]);
  expect(screen.getByText("+1300")).toBeInTheDocument();
  expect(screen.getByText(/−500 carried from yesterday/)).toBeInTheDocument();
});

test("sugar gauge shows used vs decayed allowance", () => {
  // Sugar: day 1 used 30 → leftover 0. Day 2 used 10 → leftover 20.
  // Today: bonus = 0.30×20 = 6 → allowance 36; today's entry has 12 g.
  renderWithEntries([
    day({ amount: 1800, sugarG: 30, date: "2026-07-01" }),
    day({ amount: 1800, sugarG: 10, date: "2026-07-02" }),
    day({ amount: 300, sugarG: 12, date: "2026-07-03" }),
  ]);
  expect(screen.getByText("12g of 36g")).toBeInTheDocument();
});

test("renders nothing (doesn't crash) when today precedes the only period's start date", () => {
  // System date is pinned to 2026-07-03; give the app a single open period
  // that starts the day after "today" (e.g. a timezone shift or clock
  // correction moved `today` backwards). computeLedger returns [] in that
  // case, so calToday/sugarToday are undefined — Dashboard must bail out
  // rather than throw on the missing tail entry.
  const { hook, view } = setup();
  const { rerender, container } = view();
  const open: Period = {
    id: "open-1", startDate: "2026-07-04", endDate: "2026-07-17",
    budgetPerDay: 1800, sugarBudgetPerDay: 30, entries: [],
  };
  act(() => {
    hook.result.current.replaceState({
      schemaVersion: 2, settings: hook.result.current.state.settings!, periods: [open],
    });
  });
  expect(() =>
    rerender(
      <Dashboard app={hook.result.current} settings={hook.result.current.state.settings!} onShowStamps={vi.fn()} onShowSettings={vi.fn()} />
    )
  ).not.toThrow();
  expect(container.firstChild).toBeNull();
  expect(screen.queryByText(/left today/i)).not.toBeInTheDocument();
});
