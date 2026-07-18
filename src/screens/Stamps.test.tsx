import { render, screen } from "@testing-library/react";
import Stamps from "./Stamps";
import type { Period } from "../lib/types";

const p = (n: number, outcome?: "positive" | "negative"): Period => ({
  id: String(n), startDate: "2026-07-01", endDate: "2026-07-14",
  budgetPerDay: 1800, entries: [], outcome,
});

test("renders sealed stamps and recovery caption", () => {
  render(<Stamps periods={[p(1, "positive"), p(2, "negative"), p(3, "positive"), p(4)]} onBack={() => {}} />);
  expect(screen.getAllByText("IN CREDIT")).toHaveLength(2);
  expect(screen.getByText("OVERDRAWN")).toBeInTheDocument();
  expect(screen.getByText(/didn't spread/)).toBeInTheDocument();
});

test("empty state", () => {
  render(<Stamps periods={[p(1)]} onBack={() => {}} />);
  expect(screen.getByText(/first stamp lands/i)).toBeInTheDocument();
});
