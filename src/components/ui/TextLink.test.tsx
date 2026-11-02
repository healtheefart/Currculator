import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextLink } from "./TextLink";

describe("TextLink", () => {
  it("button 요소로 렌더링하고 클릭하면 onClick을 호출한다", async () => {
    const onClick = vi.fn();
    render(<TextLink onClick={onClick}>예시 강의로 해보기</TextLink>);
    const link = screen.getByRole("button", { name: "예시 강의로 해보기" });
    expect(link.tagName).toBe("BUTTON");
    expect(link).toHaveAttribute("type", "button");
    expect(link).not.toHaveAttribute("href");
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
