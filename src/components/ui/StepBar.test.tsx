import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepBar } from "./StepBar";

const steps = [
  { key: "type", label: "학습 자료" },
  { key: "url", label: "URL 입력" },
  { key: "edit", label: "목차 확인" },
  { key: "schedule", label: "일정 설정" },
];

describe("StepBar", () => {
  it("단계마다 1부터 시작하는 번호와 라벨을 보인다", () => {
    render(<StepBar steps={steps} currentKey="url" reachableKeys={["type"]} onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["1학습 자료", "2URL 입력", "3목차 확인", "4일정 설정"]);
  });

  it("현재 단계에만 aria-current=step을 둔다", () => {
    render(<StepBar steps={steps} currentKey="url" reachableKeys={["type"]} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /URL 입력/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /학습 자료/ })).not.toHaveAttribute("aria-current");
  });

  it("지난·현재·이후 단계를 구분한다", () => {
    render(<StepBar steps={steps} currentKey="edit" reachableKeys={["edit", "schedule"]} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /학습 자료/ })).toHaveAttribute("data-state", "past");
    expect(screen.getByRole("button", { name: /목차 확인/ })).toHaveAttribute("data-state", "current");
    expect(screen.getByRole("button", { name: /일정 설정/ })).toHaveAttribute("data-state", "upcoming");
  });

  it("reachable 단계만 누를 수 있다", async () => {
    const onSelect = vi.fn();
    render(<StepBar steps={steps} currentKey="url" reachableKeys={["type"]} onSelect={onSelect} />);
    const later = screen.getByRole("button", { name: /목차 확인/ });
    expect(later).toBeDisabled();
    await userEvent.click(later);
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /학습 자료/ }));
    expect(onSelect).toHaveBeenCalledWith("type");
  });

  it("editing이면 앞에 '계획 수정 중' 배지를 보인다", () => {
    const { rerender } = render(<StepBar steps={steps} currentKey="url" reachableKeys={[]} onSelect={() => {}} />);
    expect(screen.queryByText("계획 수정 중")).not.toBeInTheDocument();
    rerender(<StepBar steps={steps} currentKey="url" reachableKeys={[]} onSelect={() => {}} editing />);
    expect(screen.getByText("계획 수정 중")).toBeInTheDocument();
  });
});
