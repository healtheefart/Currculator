import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("내용을 렌더링하고 tone을 나타낸다", () => {
    render(
      <>
        <Badge tone="gray">준비 중</Badge>
        <Badge tone="dark">시간 누락</Badge>
        <Badge tone="primary">오늘</Badge>
      </>,
    );
    expect(screen.getByText("준비 중")).toHaveAttribute("data-tone", "gray");
    expect(screen.getByText("시간 누락")).toHaveAttribute("data-tone", "dark");
    expect(screen.getByText("오늘")).toHaveAttribute("data-tone", "primary");
  });

  it("size 기본값은 sm이고 md는 큰 패딩을 쓴다", () => {
    render(
      <>
        <Badge tone="gray">작게</Badge>
        <Badge tone="dark" size="md">
          허용 범위 밖
        </Badge>
      </>,
    );
    expect(screen.getByText("작게")).toHaveAttribute("data-size", "sm");
    expect(screen.getByText("작게")).toHaveClass("px-[10px]", "py-[4px]");
    expect(screen.getByText("허용 범위 밖")).toHaveAttribute("data-size", "md");
    expect(screen.getByText("허용 범위 밖")).toHaveClass("px-[12px]", "py-[6px]");
  });
});
