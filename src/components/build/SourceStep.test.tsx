import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourceStep } from "./SourceStep";

describe("SourceStep (UC-01)", () => {
  it("제목·설명과 학습 자료 카드 2개를 보인다", () => {
    render(<SourceStep bookNotice={false} onPick={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "무엇으로 공부하나요?" })).toBeInTheDocument();
    expect(screen.getByText("목차를 가져올 학습 자료를 고르세요.")).toBeInTheDocument();
    const course = screen.getByRole("button", { name: /강의 커리큘럼/ });
    expect(course).toHaveTextContent("인프런 강의나 YouTube 재생목록 URL로 목차를 가져와요.");
    const book = screen.getByRole("button", { name: /책 목차/ });
    expect(book).toHaveTextContent("책 제목이나 ISBN으로 목차와 페이지 정보를 찾아요.");
    expect(book).not.toHaveTextContent("준비 중");
    expect(course).not.toHaveTextContent("준비 중");
  });

  it("카드를 누르면 onPick에 자료 종류를 넘긴다", async () => {
    const onPick = vi.fn();
    render(<SourceStep bookNotice={false} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /강의 커리큘럼/ }));
    await userEvent.click(screen.getByRole("button", { name: /책 목차/ }));
    expect(onPick.mock.calls).toEqual([["course"], ["book"]]);
  });

  it("bookNotice가 없으면 안내 문구가 없다", () => {
    render(<SourceStep bookNotice={false} onPick={() => {}} />);
    expect(screen.queryByText(/책 목차로 계획 짜기는 준비 중이에요/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /책 목차/ })).toHaveAttribute("data-selected", "false");
  });

  it("bookNotice면 책 카드를 선택 테두리로 바꾸고, 준비 중 안내 문구는 없다", () => {
    render(<SourceStep bookNotice onPick={() => {}} />);
    expect(screen.queryByText(/책 목차로 계획 짜기는 준비 중이에요/)).not.toBeInTheDocument();
    const book = screen.getByRole("button", { name: /책 목차/ });
    expect(book).toHaveAttribute("data-selected", "true");
    expect(book.className).toContain("border-primary-focus");
  });
});
