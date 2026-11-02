import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import ErrorPage from "./error";

it("offers a clean restart after an app error", () => {
  const reset = vi.fn();
  render(<ErrorPage error={new Error("failure")} reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "다시 시작" }));
  expect(reset).toHaveBeenCalled();
});
