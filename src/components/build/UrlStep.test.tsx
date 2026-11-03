import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { UrlStep } from "./UrlStep";

type Props = ComponentProps<typeof UrlStep>;

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    url: "",
    site: "inflearn",
    siteNotice: null,
    extracting: false,
    elapsedSec: 0,
    errorCode: null,
    hasDup: false,
    onUrlChange: vi.fn(),
    onSubmit: vi.fn(),
    onPickSite: vi.fn(),
    onFillSample: vi.fn(),
    onBack: vi.fn(),
    onOpenDup: vi.fn(),
    ...overrides,
  };
  render(<UrlStep {...props} />);
  return props;
}

describe("UrlStep (UC-02)", () => {
  it("제목·설명·입력·버튼을 보인다", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "강의 또는 재생목록 URL을 넣어 주세요." })).toBeInTheDocument();
    expect(screen.getByText("목차를 가져와 날짜별 학습 계획으로 나눠 드립니다.")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "강의 또는 재생목록 URL" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputMode", "url");
    expect(input).toHaveAttribute("placeholder", "https://www.inflearn.com/course/...");
    expect(screen.getByRole("button", { name: "목차 가져오기" })).toBeEnabled();
  });

  it("사이트 칩: 인프런 선택, 지원 사이트는 부가 문구 없음, Udemy·클래스101은 준비 중", async () => {
    const props = setup();
    const chips = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
    expect(chips.map((b) => b.textContent)).toEqual([
      "인프런",
      "YouTube",
      "패스트캠퍼스",
      "메가스터디",
      "Udemy준비 중",
      "클래스101준비 중",
    ]);
    expect(screen.getByRole("button", { name: "인프런" })).toHaveAttribute("aria-pressed", "true");
    for (const label of ["YouTube", "패스트캠퍼스", "메가스터디"]) {
      const chip = screen.getByRole("button", { name: label });
      expect(chip).toHaveAttribute("aria-pressed", "false");
      expect(chip).not.toHaveTextContent("준비 중");
    }
    for (const label of ["Udemy", "클래스101"]) {
      const chip = screen.getByRole("button", { name: new RegExp(label) });
      expect(chip).toHaveAttribute("aria-pressed", "false");
      expect(chip).toHaveTextContent("준비 중");
    }
    await userEvent.click(screen.getByRole("button", { name: /Udemy/ }));
    expect(props.onPickSite).toHaveBeenCalledWith("udemy");
  });

  it("siteNotice면 준비 중 안내를 보인다", () => {
    setup({ siteNotice: "class101" });
    expect(screen.getByText("클래스101 강의는 준비 중이에요.")).toBeInTheDocument();
  });

  it.each([
    ["inflearn", "https://www.inflearn.com/course/..."],
    ["youtube", "https://www.youtube.com/playlist?list=..."],
    ["fastcampus", "https://fastcampus.co.kr/..."],
    ["megastudy", "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=..."],
  ] as const)("placeholder는 선택한 사이트(%s)를 따른다", (site, placeholder) => {
    setup({ site });
    expect(screen.getByRole("textbox", { name: "강의 또는 재생목록 URL" })).toHaveAttribute("placeholder", placeholder);
  });

  it("입력하면 onUrlChange, 버튼·Enter면 onSubmit", async () => {
    const props = setup();
    const input = screen.getByRole("textbox", { name: "강의 또는 재생목록 URL" });
    await userEvent.type(input, "a");
    expect(props.onUrlChange).toHaveBeenCalledWith("a");
    await userEvent.click(screen.getByRole("button", { name: "목차 가져오기" }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    await userEvent.type(input, "{Enter}");
    expect(props.onSubmit).toHaveBeenCalledTimes(2);
  });

  it("링크: 학습 자료 다시 고르기 → onBack, 예시 강의로 해보기 → onFillSample", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "학습 자료 다시 고르기" }));
    await userEvent.click(screen.getByRole("button", { name: "예시 강의로 해보기" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onFillSample).toHaveBeenCalledTimes(1);
  });

  it("추출 중이면 입력·버튼 비활성, 링크 숨김, 경과 초 표시 (E6)", async () => {
    const props = setup({ extracting: true, elapsedSec: 3, url: "https://www.inflearn.com/course/x" });
    const input = screen.getByRole("textbox", { name: "강의 또는 재생목록 URL" });
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "목차 가져오기" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "학습 자료 다시 고르기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "예시 강의로 해보기" })).not.toBeInTheDocument();
    const status = screen.getByText("강의 정보 가져오는 중…").closest("[aria-live]");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("3초");
    await userEvent.type(input, "{Enter}");
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("추출 중이 아니면 진행 문구가 없다", () => {
    setup();
    expect(screen.queryByText("강의 정보 가져오는 중…")).not.toBeInTheDocument();
  });

  it("errorCode면 role=alert 문구 (E1)", () => {
    setup({ errorCode: "INVALID_URL" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "링크 형식이 올바르지 않아요. 강의나 재생목록 주소를 붙여 넣어 주세요.",
    );
    expect(screen.queryByRole("button", { name: "계획확인에서 보기" })).not.toBeInTheDocument();
  });

  it("오류가 없으면 alert가 없다", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ALREADY_PLANNED + hasDup이면 계획확인에서 보기 링크 (E7)", async () => {
    const props = setup({ errorCode: "ALREADY_PLANNED", hasDup: true });
    expect(screen.getByRole("alert")).toHaveTextContent("이미 계획을 만든 강의예요.");
    await userEvent.click(screen.getByRole("button", { name: "계획확인에서 보기" }));
    expect(props.onOpenDup).toHaveBeenCalledTimes(1);
  });
});
