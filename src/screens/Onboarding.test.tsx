import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Onboarding from "./Onboarding";

test("computes TDEE live and completes with stats", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(<Onboarding onComplete={onComplete} />);

  await user.click(screen.getByRole("button", { name: /male/i }));
  await user.type(screen.getByLabelText(/age/i), "30");
  await user.type(screen.getByLabelText(/height/i), "180");
  await user.type(screen.getByLabelText(/weight/i), "80");
  await user.selectOptions(screen.getByLabelText(/activity/i), "sedentary");

  expect(await screen.findByText(/2136/)).toBeInTheDocument(); // computed TDEE visible
  await user.click(screen.getByRole("button", { name: /start tracking/i }));
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({
      tdee: 2136,
      deficit: 500,
      periodLengthDays: 14,
      stats: expect.objectContaining({ weightKg: 80 }),
    })
  );
});

test("direct TDEE override works without stats", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(<Onboarding onComplete={onComplete} />);

  await user.click(screen.getByRole("button", { name: /already know my tdee/i }));
  await user.type(screen.getByLabelText(/your tdee/i), "2400");
  await user.click(screen.getByRole("button", { name: /start tracking/i }));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ tdee: 2400 }));
});

test("start disabled until a TDEE exists", () => {
  render(<Onboarding onComplete={vi.fn()} />);
  expect(screen.getByRole("button", { name: /start tracking/i })).toBeDisabled();
});
