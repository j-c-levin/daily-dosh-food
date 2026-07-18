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
import type { Settings } from "../lib/types";

const settings: Settings = {
  tdee: 2300, deficit: 500, anchorDate: "2026-07-01", periodLengthDays: 14, model: "claude-haiku-4-5", apiKey: "k",
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
  expect(screen.getByText(/in credit this period/i)).toBeInTheDocument();
  expect(screen.getByText(/daily budget/i)).toBeInTheDocument();
  expect(screen.getByText(/earned back/i)).toBeInTheDocument();
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

test("caption shows a this-period/next-period split when settings change mid-period", () => {
  const { hook, view } = setup();
  const { rerender } = view();

  act(() => hook.result.current.updateSettings({ tdee: 2000 }));
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
