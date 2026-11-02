import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("클릭하면 onClick을 호출한다", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>일정 설정</Button>);
    await userEvent.click(screen.getByRole("button", { name: "일정 설정" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled이면 onClick을 호출하지 않고 눌림 효과가 없다", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        계획하기
      </Button>,
    );
    const button = screen.getByRole("button", { name: "계획하기" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveClass("cc-press");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("활성 상태에서는 눌림 효과 클래스를 가진다", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toHaveClass("cc-press");
  });

  it("type 기본값은 button이고 submit을 지정할 수 있다", () => {
    render(
      <>
        <Button>기본</Button>
        <Button type="submit">제출</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "기본" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "제출" })).toHaveAttribute("type", "submit");
  });

  it("variant 기본값은 primary이고 secondary를 지정할 수 있다", () => {
    render(
      <>
        <Button>주</Button>
        <Button variant="secondary">보조</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "주" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "보조" })).toHaveAttribute("data-variant", "secondary");
  });

  it("추가 HTML 속성과 className을 전달한다", () => {
    render(
      <Button aria-describedby="hint" className="h-12">
        취소
      </Button>,
    );
    const button = screen.getByRole("button", { name: "취소" });
    expect(button).toHaveAttribute("aria-describedby", "hint");
    expect(button).toHaveClass("h-12");
  });
});
