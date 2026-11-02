import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlanSettings as Settings } from "@/types/plan";
import { PlanSettings } from "./PlanSettings";

function makeSettings(patch: Partial<Settings> = {}): Settings {
  return {
    startDate: "2026-11-03",
    weekdayMinutes: [60, 60, 60, 60, 60, 60, 60],
    toleranceMinutes: 10,
    restDates: [],
    lectureMultiplier: 1.5,
    ...patch,
  };
}

const LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const weekdayInput = (label: string) => screen.getByRole("textbox", { name: `${label}요일 가용 분` });
const MIN_ERROR = "0~1440 사이 숫자로 입력해 주세요. 이전 값을 유지합니다.";
const TOL_MULT_ERROR = "오차는 0 이상, 배수는 0.5~5 사이로 입력해 주세요. 이전 값을 유지합니다.";

describe("PlanSettings (UC-04)", () => {
  it("제목과 항목 라벨을 보인다", () => {
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={() => {}} />);
    expect(screen.getByRole("heading", { level: 2, name: "일정 설정" })).toBeInTheDocument();
    expect(screen.getByText("요일별 가용 시간 (분, 0 = 쉬는 요일)")).toBeInTheDocument();
    expect(screen.getByText("허용 오차")).toBeInTheDocument();
    expect(screen.getByText("예상 학습시간")).toBeInTheDocument();
    expect(screen.getByText("시작일")).toBeInTheDocument();
    expect(screen.getByText("휴식일")).toBeInTheDocument();
    expect(
      screen.getByText("날짜를 눌러 휴식일로 지정하거나 해제하세요. 쉬는 요일과 시작일 이전은 고를 수 없어요."),
    ).toBeInTheDocument();
  });

  it("프리셋 칩: 현재 값과 같으면 aria-pressed", () => {
    render(
      <PlanSettings
        settings={makeSettings({ weekdayMinutes: [0, 60, 60, 60, 60, 60, 0] })}
        today="2026-11-03"
        onAction={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "매일 60분" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "평일만 60분" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "평일 60분·주말 120분" })).toHaveAttribute("aria-pressed", "false");
  });

  it("프리셋과 다르면 아무 칩도 선택되지 않는다", () => {
    render(
      <PlanSettings
        settings={makeSettings({ weekdayMinutes: [60, 30, 60, 60, 60, 60, 60] })}
        today="2026-11-03"
        onAction={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { pressed: true })).not.toBeInTheDocument();
  });

  it("프리셋 칩 → APPLY_PRESET, 입력 중 요일 문자열을 지운다", async () => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    fireEvent.change(weekdayInput("월"), { target: { value: "abc" } });
    expect(screen.getByText(MIN_ERROR)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "평일만 60분" }));
    expect(onAction).toHaveBeenCalledWith({ type: "APPLY_PRESET", preset: "WEEKDAYS_60" });
    expect(weekdayInput("월")).toHaveValue("60");
    expect(screen.queryByText(MIN_ERROR)).not.toBeInTheDocument();
  });

  it("요일 칸은 월화수목금토일 순서이고 값은 데이터 인덱스(0 = 일)에 맞는다", () => {
    render(
      <PlanSettings
        settings={makeSettings({ weekdayMinutes: [70, 10, 20, 30, 40, 50, 60] })}
        today="2026-11-03"
        onAction={() => {}}
      />,
    );
    const inputs = screen.getAllByRole("textbox", { name: /요일 가용 분$/ });
    expect(inputs.map((i) => i.getAttribute("aria-label"))).toEqual(LABELS.map((l) => `${l}요일 가용 분`));
    expect(inputs.map((i) => (i as HTMLInputElement).value)).toEqual(["10", "20", "30", "40", "50", "60", "70"]);
  });

  it("요일 입력 → SET_WEEKDAY (일요일은 인덱스 0)", () => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    fireEvent.change(weekdayInput("일"), { target: { value: "90" } });
    fireEvent.change(weekdayInput("월"), { target: { value: "0" } });
    expect(onAction.mock.calls).toEqual([
      [{ type: "SET_WEEKDAY", weekday: 0, minutes: 90 }],
      [{ type: "SET_WEEKDAY", weekday: 1, minutes: 0 }],
    ]);
  });

  it.each(["1441", "-5", "", "1.5"])("잘못된 요일 분 %s → dispatch 없음·오류 문구·굵은 테두리", (value) => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    const input = weekdayInput("화");
    fireEvent.change(input, { target: { value } });
    expect(onAction).not.toHaveBeenCalled();
    expect(input).toHaveValue(value);
    expect(input.className).toContain("border-2");
    expect(screen.getByText(MIN_ERROR)).toBeInTheDocument();
  });

  it("0분 요일은 parchment 배경", () => {
    render(
      <PlanSettings
        settings={makeSettings({ weekdayMinutes: [0, 60, 60, 60, 60, 60, 0] })}
        today="2026-11-03"
        onAction={() => {}}
      />,
    );
    expect(weekdayInput("일").className).toContain("bg-parchment");
    expect(weekdayInput("토").className).toContain("bg-parchment");
    expect(weekdayInput("월").className).not.toContain("bg-parchment");
  });

  it("모든 요일이 0분이면 안내 문구", () => {
    render(
      <PlanSettings
        settings={makeSettings({ weekdayMinutes: [0, 0, 0, 0, 0, 0, 0] })}
        today="2026-11-03"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText("학습할 요일을 하나 이상 정해 주세요.")).toBeInTheDocument();
  });

  it("학습 요일이 있으면 그 문구가 없다", () => {
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={() => {}} />);
    expect(screen.queryByText("학습할 요일을 하나 이상 정해 주세요.")).not.toBeInTheDocument();
  });

  it("허용 오차 → SET_TOLERANCE, 잘못된 값은 공통 오류", () => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    const tol = screen.getByRole("textbox", { name: "허용 오차 (분)" });
    expect(tol).toHaveValue("10");
    fireEvent.change(tol, { target: { value: "15" } });
    expect(onAction).toHaveBeenCalledWith({ type: "SET_TOLERANCE", minutes: 15 });
    onAction.mockClear();
    fireEvent.change(tol, { target: { value: "-1" } });
    expect(onAction).not.toHaveBeenCalled();
    expect(tol.className).toContain("border-2");
    expect(screen.getByText(TOL_MULT_ERROR)).toBeInTheDocument();
  });

  it("배수 → SET_MULTIPLIER, 범위 밖은 공통 오류", () => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    const mult = screen.getByRole("textbox", { name: "재생시간 배수" });
    expect(mult).toHaveValue("1.5");
    fireEvent.change(mult, { target: { value: "2" } });
    expect(onAction).toHaveBeenCalledWith({ type: "SET_MULTIPLIER", value: 2 });
    onAction.mockClear();
    fireEvent.change(mult, { target: { value: "6" } });
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText(TOL_MULT_ERROR)).toBeInTheDocument();
  });

  it("blur 시 오류가 없으면 입력 상태를 지운다", () => {
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={() => {}} />);
    const tol = screen.getByRole("textbox", { name: "허용 오차 (분)" });
    fireEvent.change(tol, { target: { value: "015" } });
    expect(tol).toHaveValue("015");
    fireEvent.blur(tol);
    expect(tol).toHaveValue("10"); // props가 바뀌지 않았으므로 원래 값
  });

  it("오류가 있으면 blur 후에도 입력값과 문구를 유지한다", () => {
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={() => {}} />);
    const mult = screen.getByRole("textbox", { name: "재생시간 배수" });
    fireEvent.change(mult, { target: { value: "0.1" } });
    fireEvent.blur(mult);
    expect(mult).toHaveValue("0.1");
    expect(screen.getByText(TOL_MULT_ERROR)).toBeInTheDocument();
  });

  it("시작일 → 값이 있을 때만 SET_START", () => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    const start = screen.getByLabelText("시작일");
    expect(start).toHaveAttribute("type", "date");
    expect(start).toHaveValue("2026-11-03");
    fireEvent.change(start, { target: { value: "2026-11-10" } });
    expect(onAction).toHaveBeenCalledWith({ type: "SET_START", date: "2026-11-10" });
    onAction.mockClear();
    fireEvent.change(start, { target: { value: "" } });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("휴식일 달력을 누르면 TOGGLE_REST", async () => {
    const onAction = vi.fn();
    render(<PlanSettings settings={makeSettings()} today="2026-11-03" onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "11월 6일 (금)" }));
    expect(onAction).toHaveBeenCalledWith({ type: "TOGGLE_REST", date: "2026-11-06" });
  });

  it("선택한 휴식일 칩과 × → REMOVE_REST", async () => {
    const onAction = vi.fn();
    render(
      <PlanSettings
        settings={makeSettings({ restDates: ["2026-11-05", "2026-11-12"] })}
        today="2026-11-03"
        onAction={onAction}
      />,
    );
    const chips = screen.getAllByRole("button", { name: "휴식일 삭제" });
    expect(chips.map((c) => c.textContent)).toEqual(["11월 5일 (목)", "11월 12일 (목)"]);
    await userEvent.click(chips[1]);
    expect(onAction).toHaveBeenCalledWith({ type: "REMOVE_REST", date: "2026-11-12" });
  });
});
