import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlanSettings } from "@/types/plan";
import { RestDayPicker } from "./RestDayPicker";

function makeSettings(patch: Partial<PlanSettings> = {}): PlanSettings {
  return {
    startDate: "2026-11-03",
    weekdayMinutes: [0, 60, 60, 60, 60, 60, 0],
    toleranceMinutes: 10,
    restDates: ["2026-11-05"],
    lectureMultiplier: 1.5,
    ...patch,
  };
}

const cell = (label: string) => screen.getByRole("button", { name: label });

describe("RestDayPicker", () => {
  it("기본은 시작일의 달, 일~토 머리", () => {
    render(<RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={() => {}} />);
    expect(screen.getByText("2026년 11월")).toBeInTheDocument();
    const heads = screen.getAllByTestId("weekday-head").map((h) => h.textContent);
    expect(heads).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
    expect(screen.getAllByRole("button", { pressed: false }).length + 1).toBe(30); // 30일 중 1일은 휴식일
  });

  it("시작일 이전과 가용 0분 요일은 비활성", () => {
    render(<RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={() => {}} />);
    expect(cell("11월 2일 (월)")).toBeDisabled(); // 시작일 이전
    expect(cell("11월 1일 (일)")).toBeDisabled(); // 0분 요일
    expect(cell("11월 7일 (토)")).toBeDisabled(); // 0분 요일
    expect(cell("11월 3일 (화)")).toBeEnabled(); // 시작일 당일
    expect(cell("11월 4일 (수)")).toBeEnabled();
  });

  it("선택된 휴식일은 aria-pressed와 ink 배경, 오늘은 ink 테두리", () => {
    render(<RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={() => {}} />);
    const rest = cell("11월 5일 (목)");
    expect(rest).toHaveAttribute("aria-pressed", "true");
    expect(rest.className).toContain("bg-ink");
    expect(cell("11월 4일 (수)")).toHaveAttribute("aria-pressed", "false");
    expect(cell("11월 3일 (화)").className).toContain("border-ink");
    expect(cell("11월 4일 (수)").className).not.toContain("border-ink");
  });

  it("날짜를 누르면 onToggle(날짜), 비활성 칸은 호출하지 않는다", async () => {
    const onToggle = vi.fn();
    render(<RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={onToggle} />);
    await userEvent.click(cell("11월 4일 (수)"));
    await userEvent.click(cell("11월 5일 (목)"));
    await userEvent.click(cell("11월 2일 (월)"));
    expect(onToggle.mock.calls).toEqual([["2026-11-04"], ["2026-11-05"]]);
  });

  it("이전 달 / 다음 달로 이동한다", async () => {
    render(<RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByText("2026년 12월")).toBeInTheDocument();
    expect(cell("12월 1일 (화)")).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByText("2027년 1월")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "이전 달" }));
    await userEvent.click(screen.getByRole("button", { name: "이전 달" }));
    await userEvent.click(screen.getByRole("button", { name: "이전 달" }));
    expect(screen.getByText("2026년 10월")).toBeInTheDocument();
    expect(cell("10월 28일 (수)")).toBeDisabled(); // 시작일 이전
  });

  it("시작일이 바뀌면 그 달로 다시 맞춘다", async () => {
    const { rerender } = render(
      <RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByText("2026년 12월")).toBeInTheDocument();
    rerender(
      <RestDayPicker settings={makeSettings({ startDate: "2027-03-10" })} today="2026-11-03" onToggle={() => {}} />,
    );
    expect(screen.getByText("2027년 3월")).toBeInTheDocument();
  });

  it("다른 설정이 바뀌어도 보이는 달은 유지한다", async () => {
    const { rerender } = render(
      <RestDayPicker settings={makeSettings()} today="2026-11-03" onToggle={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "다음 달" }));
    rerender(
      <RestDayPicker settings={makeSettings({ restDates: [] })} today="2026-11-03" onToggle={() => {}} />,
    );
    expect(screen.getByText("2026년 12월")).toBeInTheDocument();
  });
});
