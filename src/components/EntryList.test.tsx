import { render, screen } from "@testing-library/react";
import EntryList from "./EntryList";
import type { Entry } from "../lib/types";

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
