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
