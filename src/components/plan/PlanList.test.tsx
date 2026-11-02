import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { PlanList } from "./PlanList";
import type { ViewDay } from "./view-model";

const days: ViewDay[] = [
  { date: "2026-11-03", items: [{ key: "i", itemId: "i", title: "첫 수업", label: "섹션", effortSec: 600, moved: false }], effortSec: 600, targetSec: 3600, outOfRange: false },
  { date: "2026-11-04", items: [], effortSec: 0, targetSec: 3600, outOfRange: false },
];

it("offers keyboard movement and removal in edit mode", () => {
  const onAction = vi.fn();
  render(<PlanList days={days} today="2026-11-03" editable baseDateById={{ i: "2026-11-03" }} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: /첫 수업 선택/ }));
  fireEvent.click(screen.getByRole("button", { name: /11월 4일.*에 놓기/ }));
  expect(onAction).toHaveBeenCalledWith({ type: "MOVE_ITEM", itemId: "i", date: "2026-11-04", baseDate: "2026-11-03" });
  fireEvent.click(screen.getByRole("button", { name: "계획에서 제외" }));
  expect(onAction).toHaveBeenCalledWith({ type: "REMOVE_ITEM", itemId: "i" });
});

it("keeps read-only list free of edit controls", () => {
  render(<PlanList days={days} today="2026-11-03" />);
  expect(screen.queryByRole("button", { name: "계획에서 제외" })).not.toBeInTheDocument();
  expect(screen.getByText("오늘")).toBeInTheDocument();
});
