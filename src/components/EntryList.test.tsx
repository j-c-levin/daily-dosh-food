import { render, screen, fireEvent } from "@testing-library/react";
import EntryList from "./EntryList";
import type { Entry, MealBreak, MealName } from "../lib/types";

const e = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), label: "item", type: "debit", amount: 300, date: "2026-07-02", source: "manual", ...over,
});

test("groups entries under day dividers with per-day summaries", () => {
  render(
    <EntryList
      entries={[e({ date: "2026-07-03", label: "lunch" }), e({ date: "2026-07-02", label: "dinner" })]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{
        "2026-07-03": { kcalLeftover: 1980, sugarUsedG: 12.4 },
        "2026-07-02": { kcalLeftover: -220, sugarUsedG: 38 },
      }}
    />
  );
  // Today's divider is label-only — its live numbers already headline the dashboard.
  expect(screen.getByText("Today")).toBeInTheDocument();
  expect(screen.queryByText(/1980/)).not.toBeInTheDocument();
  // Past days carry their sealed result.
  expect(screen.getByText("2 Jul")).toBeInTheDocument();
  expect(screen.getByText("finished −220 kcal · 38g sugar")).toBeInTheDocument();
});

test("renders the old flat list when no daySummaries are provided", () => {
  render(<EntryList entries={[e({})]} onSelect={() => {}} />);
  expect(screen.queryByText(/finished/)).not.toBeInTheDocument();
  expect(screen.getByText("item")).toBeInTheDocument();
});

test("in divider mode, row borders only separate entries within the same day group", () => {
  render(
    <EntryList
      entries={[
        e({ date: "2026-07-03", label: "lunch" }),
        e({ date: "2026-07-03", label: "dinner" }),
        e({ date: "2026-07-02", label: "breakfast" }),
      ]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{
        "2026-07-03": { kcalLeftover: 1980, sugarUsedG: 12.4 },
        "2026-07-02": { kcalLeftover: -220, sugarUsedG: 38 },
      }}
    />
  );
  // First row of the day: another same-day row follows, so it keeps the border.
  expect(screen.getByRole("button", { name: "lunch" })).toHaveStyle({ borderBottom: "1px solid #22262D" });
  // Last row of that day group: next row is a different date, so no border.
  expect((screen.getByRole("button", { name: "dinner" }) as HTMLElement).style.borderBottomStyle).toBe("none");
  // Last row overall: no border, matching the no-divider path's final-row behavior.
  expect((screen.getByRole("button", { name: "breakfast" }) as HTMLElement).style.borderBottomStyle).toBe("none");
});

const mb = (meal: MealName, date: string): MealBreak => ({
  kind: "meal-break", id: crypto.randomUUID(), meal, date,
});

test("renders a meal break as a small labelled rule; the entry above it drops its own border", () => {
  render(
    <EntryList
      entries={[e({ date: "2026-07-03", label: "coffee" }), mb("lunch", "2026-07-03"), e({ date: "2026-07-03", label: "porridge" })]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{ "2026-07-03": { kcalLeftover: 100, sugarUsedG: 5 } }}
    />
  );
  const brk = screen.getByRole("button", { name: "lunch break" });
  expect(brk).toBeInTheDocument();
  // Subordinate to the day divider: no background fill on the break row.
  expect((brk as HTMLElement).style.background).toBe("");
  // The break line is the separator — the entry above draws no border of its own.
  expect((screen.getByRole("button", { name: "coffee" }) as HTMLElement).style.borderBottomStyle).toBe("none");
});

test("tapping a break opens the chip editor; picking renames, delete removes", () => {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  render(
    <EntryList
      entries={[mb("snack", "2026-07-03")]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{ "2026-07-03": { kcalLeftover: 100, sugarUsedG: 5 } }}
      onRenameBreak={onRename}
      onDeleteBreak={onDelete}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "snack break" }));
  fireEvent.click(screen.getByRole("button", { name: "dinner" }));
  expect(onRename).toHaveBeenCalledWith(expect.any(String), "dinner");
  // Chips collapse after picking; reopen to delete.
  expect(screen.queryByRole("button", { name: "dinner" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "snack break" }));
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  expect(onDelete).toHaveBeenCalledWith(expect.any(String));
});

test("tapping outside the open chip editor closes it", () => {
  render(
    <EntryList
      entries={[mb("snack", "2026-07-03")]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{ "2026-07-03": { kcalLeftover: 100, sugarUsedG: 5 } }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "snack break" }));
  expect(screen.getByRole("button", { name: "dinner" })).toBeInTheDocument();
  fireEvent.click(document.body);
  expect(screen.queryByRole("button", { name: "dinner" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "snack break" })).toBeInTheDocument();
});

test("keydown on an open chip doesn't bubble to the break row and close the editor", () => {
  render(
    <EntryList
      entries={[mb("snack", "2026-07-03")]}
      onSelect={() => {}}
      today="2026-07-03"
      daySummaries={{ "2026-07-03": { kcalLeftover: 100, sugarUsedG: 5 } }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "snack break" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "dinner" }), { key: "Enter" });
  // Still open: the row's own keydown handler (which would toggle it closed)
  // must not have fired.
  expect(screen.getByRole("button", { name: "dinner" })).toBeInTheDocument();
});
