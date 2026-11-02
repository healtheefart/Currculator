import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionChip } from "./OptionChip";

describe("OptionChip", () => {
  it("selected를 aria-pressed로 나타낸다", () => {
    render(
      <>
        <OptionChip label="인프런" selected />
        <OptionChip label="Udemy" />
      </>,
    );
    expect(screen.getByRole("button", { name: "인프런" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Udemy/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("detail 문구를 함께 표시한다", () => {
    render(<OptionChip label="Udemy" detail="준비 중" />);
    const chip = screen.getByRole("button", { name: /Udemy/ });
    expect(chip).toHaveTextContent("Udemy");
    expect(chip).toHaveTextContent("준비 중");
  });

  it("클릭하면 onClick을 호출하고 type은 button이다", async () => {
    const onClick = vi.fn();
    render(<OptionChip label="목록" onClick={onClick} />);
    const chip = screen.getByRole("button", { name: "목록" });
    expect(chip).toHaveAttribute("type", "button");
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
