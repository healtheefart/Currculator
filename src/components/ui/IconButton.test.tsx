import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "./IconButton";
import { ChevronLeftIcon } from "./icons";

describe("IconButton", () => {
  it("label을 접근 이름과 title로 쓴다", () => {
    render(<IconButton label="이전 달" icon={<ChevronLeftIcon />} />);
    const button = screen.getByRole("button", { name: "이전 달" });
    expect(button).toHaveAttribute("title", "이전 달");
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("클릭하면 onClick을 호출한다", async () => {
    const onClick = vi.fn();
    render(<IconButton label="다음 달" icon={<ChevronLeftIcon />} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("size로 크기를 바꿀 수 있다(기본 44)", () => {
    render(
      <>
        <IconButton label="기본" icon={<ChevronLeftIcon />} />
        <IconButton label="작게" icon={<ChevronLeftIcon />} size={32} />
      </>,
    );
    expect(screen.getByRole("button", { name: "기본" })).toHaveStyle({ width: "44px", height: "44px" });
    expect(screen.getByRole("button", { name: "작게" })).toHaveStyle({ width: "32px", height: "32px" });
  });
});
