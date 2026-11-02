import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { PlanViewTabs } from "./PlanViewTabs";

it("switches view tabs", () => {
  const onTab = vi.fn();
  render(<PlanViewTabs heading="일정" tab="list" onTab={onTab}><p>내용</p></PlanViewTabs>);
  expect(screen.getByRole("button", { name: "목록" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "달력" }));
  expect(onTab).toHaveBeenCalledWith("calendar");
});
