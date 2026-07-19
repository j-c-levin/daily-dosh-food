import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import EditSheet from "./EditSheet";
import type { Entry } from "../lib/types";

const entry: Entry = { id: "1", label: "Toast", type: "debit", amount: 390, date: "2026-07-18", source: "ai" };

test("edits and saves", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<EditSheet entry={entry} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
  await user.clear(screen.getByLabelText(/description/i));
  await user.type(screen.getByLabelText(/description/i), "Toast + eggs");
  await user.click(screen.getByRole("button", { name: /credit/i }));
  await user.clear(screen.getByLabelText(/amount/i));
  await user.type(screen.getByLabelText(/amount/i), "120");
  await user.click(screen.getByRole("button", { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith({ label: "Toast + eggs", type: "credit", amount: 120 });
});

test("delete and overlay-close", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(<EditSheet entry={entry} onSave={vi.fn()} onDelete={onDelete} onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: /delete/i }));
  expect(onDelete).toHaveBeenCalled();
  await user.click(screen.getByTestId("sheet-overlay"));
  expect(onClose).toHaveBeenCalled();
});

test("clearing amount blocks save", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<EditSheet entry={entry} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
  await user.clear(screen.getByLabelText(/amount/i));
  await user.click(screen.getByRole("button", { name: /save/i }));
  expect(onSave).not.toHaveBeenCalled();
});

test("saving a debit passes the sugar grams through", async () => {
  const onSave = vi.fn();
  render(<EditSheet entry={{ id: "1", label: "flapjack", type: "debit", amount: 300, sugarG: 18, date: "2026-07-19", source: "ai" }} onSave={onSave} onDelete={() => {}} onClose={() => {}} />);
  const sugar = screen.getByLabelText(/sugar/i);
  await userEvent.clear(sugar);
  await userEvent.type(sugar, "25");
  await userEvent.click(screen.getByText("Save"));
  expect(onSave).toHaveBeenCalledWith({ label: "flapjack", type: "debit", amount: 300, sugarG: 25 });
});

test("empty sugar field saves as unknown (undefined)", async () => {
  const onSave = vi.fn();
  render(<EditSheet entry={{ id: "1", label: "stew", type: "debit", amount: 400, date: "2026-07-19", source: "ai" }} onSave={onSave} onDelete={() => {}} onClose={() => {}} />);
  await userEvent.click(screen.getByText("Save"));
  expect(onSave).toHaveBeenCalledWith({ label: "stew", type: "debit", amount: 400, sugarG: undefined });
});

test("invalid sugar on a debit no longer blocks save after toggling to credit", async () => {
  const onSave = vi.fn();
  render(<EditSheet entry={{ id: "1", label: "flapjack", type: "debit", amount: 300, sugarG: 18, date: "2026-07-19", source: "ai" }} onSave={onSave} onDelete={() => {}} onClose={() => {}} />);
  const sugar = screen.getByLabelText(/sugar/i);
  await userEvent.clear(sugar);
  await userEvent.type(sugar, "-5");
  await userEvent.click(screen.getByText("Save"));
  expect(onSave).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Credit"));
  await userEvent.click(screen.getByText("Save"));
  expect(onSave).toHaveBeenCalledWith({ label: "flapjack", type: "credit", amount: 300, sugarG: undefined });
});
