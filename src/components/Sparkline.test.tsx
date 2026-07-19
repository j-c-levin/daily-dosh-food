import { render } from "@testing-library/react";
import Sparkline from "./Sparkline";

test("renders one line without secondary, two with", () => {
  const one = render(<Sparkline values={[1, 2, 3]} />);
  const two = render(<Sparkline values={[1, 2, 3]} secondary={[30, 0, 12]} />);
  const lines = (c: HTMLElement) => c.querySelectorAll("polyline, path[data-series]").length;
  expect(lines(two.container)).toBe(lines(one.container) + 1);
});
