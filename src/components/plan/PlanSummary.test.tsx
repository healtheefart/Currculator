import { fireEvent, render, screen, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { PlanSummary } from "./PlanSummary";

it("shows total, date span, study days and warnings", () => {
  render(<PlanSummary title="내 계획" days={[{ date: "2026-11-03", items: [{ key: "a", itemId: "a", title: "수업", label: "섹션", effortSec: 600, moved: false }], effortSec: 600, targetSec: 600, outOfRange: true }]} />);
  expect(screen.getByText("내 계획")).toBeInTheDocument();
  expect(screen.getByText(/경고 1일/)).toBeInTheDocument();
});

it("shows labeled icon actions inside the summary only when provided", () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const { rerender } = render(<PlanSummary title="내 계획" days={[]} onEdit={onEdit} onDelete={onDelete} />);
  const summary = screen.getByRole("region", { name: "계획 요약" });
  fireEvent.click(within(summary).getByRole("button", { name: "계획 수정" }));
  fireEvent.click(within(summary).getByRole("button", { name: "계획 삭제" }));
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onDelete).toHaveBeenCalledOnce();

  rerender(<PlanSummary title="전체 계획" days={[]} />);
  expect(within(summary).queryByRole("button")).not.toBeInTheDocument();
});
