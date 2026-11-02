import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

function setup(open = true) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmDialog
      open={open}
      title="이 계획을 삭제할까요?"
      body="삭제한 계획은 되돌릴 수 없어요."
      confirmLabel="삭제"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel, ...utils };
}

describe("ConfirmDialog", () => {
  it("open이 false면 아무것도 렌더링하지 않는다", () => {
    const { container } = setup(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("제목으로 이름 붙은 모달 대화상자와 본문을 보인다", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "이 계획을 삭제할까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("삭제한 계획은 되돌릴 수 없어요.");
  });

  it("열리면 확인 버튼에 포커스한다", () => {
    setup();
    expect(screen.getByRole("button", { name: "삭제" })).toHaveFocus();
  });

  it("확인·취소 버튼이 각각 콜백을 호출한다", async () => {
    const { onConfirm, onCancel } = setup();
    expect(screen.getByRole("button", { name: "취소" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("button", { name: "삭제" })).toHaveAttribute("data-variant", "primary");
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape를 누르면 onCancel을 호출한다", async () => {
    const { onCancel, onConfirm } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("오버레이 클릭은 onCancel, 카드 클릭은 아무것도 하지 않는다", async () => {
    const { onCancel } = setup();
    await userEvent.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("confirm-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
