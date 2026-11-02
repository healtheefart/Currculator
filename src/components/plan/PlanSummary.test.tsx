import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { PlanSummary } from "./PlanSummary";

it("shows total, date span, study days and warnings", () => {
  render(<PlanSummary title="내 계획" days={[{ date: "2026-11-03", items: [{ key: "a", itemId: "a", title: "수업", label: "섹션", effortSec: 600, moved: false }], effortSec: 600, targetSec: 600, outOfRange: true }]} />);
  expect(screen.getByText("내 계획")).toBeInTheDocument();
  expect(screen.getByText(/경고 1일/)).toBeInTheDocument();
});
