import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { PlanCalendar } from "./PlanCalendar";

it("selects today by default and resets selection on month change", () => {
  render(<PlanCalendar days={[{ date: "2026-11-03", items: [{ key: "a", itemId: "a", title: "수업", label: "섹션", effortSec: 600, moved: false }], effortSec: 600, targetSec: 3600, outOfRange: false }]} today="2026-11-03" defaultMonth="2026-11" />);
  expect(screen.getByText("수업", { selector: "li *" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
  expect(screen.getByText("2026년 12월")).toBeInTheDocument();
});
