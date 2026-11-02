import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { PlanPicker } from "./PlanPicker";

it("selects a saved plan", () => {
  const onSelect = vi.fn();
  render(<PlanPicker rows={[{ id: "all", title: "전체 보기", sub: "모든 계획" }, { id: "p", title: "강의", sub: "10개 수업" }]} selected="all" onSelect={onSelect} />);
  expect(screen.getByRole("listbox", { name: "저장한 계획" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: /강의/ }));
  expect(onSelect).toHaveBeenCalledWith("p");
});
