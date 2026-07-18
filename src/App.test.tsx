import { render, screen } from "@testing-library/react";
import App from "./App";

test("shows onboarding when no settings", () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
});
