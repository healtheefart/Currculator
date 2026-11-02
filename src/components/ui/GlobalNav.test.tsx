import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalNav } from "./GlobalNav";

describe("GlobalNav", () => {
  it("주 메뉴 nav 안에 브랜드와 두 메뉴만 보인다", () => {
    render(<GlobalNav active="build" onNavigate={() => {}} onBrand={() => {}} />);
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Currculator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계획짜기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계획확인" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("현재 메뉴에만 aria-current=page를 둔다", () => {
    const { rerender } = render(<GlobalNav active="build" onNavigate={() => {}} onBrand={() => {}} />);
    expect(screen.getByRole("button", { name: "계획짜기" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "계획확인" })).not.toHaveAttribute("aria-current");
    rerender(<GlobalNav active="view" onNavigate={() => {}} onBrand={() => {}} />);
    expect(screen.getByRole("button", { name: "계획확인" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "계획짜기" })).not.toHaveAttribute("aria-current");
  });

  it("메뉴와 브랜드 클릭을 콜백으로 알린다", async () => {
    const onNavigate = vi.fn();
    const onBrand = vi.fn();
    render(<GlobalNav active="build" onNavigate={onNavigate} onBrand={onBrand} />);
    await userEvent.click(screen.getByRole("button", { name: "계획확인" }));
    expect(onNavigate).toHaveBeenLastCalledWith("view");
    await userEvent.click(screen.getByRole("button", { name: "계획짜기" }));
    expect(onNavigate).toHaveBeenLastCalledWith("build");
    await userEvent.click(screen.getByRole("button", { name: "Currculator" }));
    expect(onBrand).toHaveBeenCalledTimes(1);
  });
});
