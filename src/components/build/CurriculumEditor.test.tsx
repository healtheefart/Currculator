import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import { CurriculumEditor } from "./CurriculumEditor";

function section(id: string, title: string, order: number): CurriculumItem {
  return { id, title, level: 0, order, sectionId: null, durationSec: null, source: "origin", excluded: false };
}

function lesson(id: string, title: string, order: number, sectionId: string, patch: Partial<CurriculumItem> = {}) {
  const item: CurriculumItem = {
    id,
    title,
    level: 1,
    order,
    sectionId,
    durationSec: 600,
    source: "origin",
    excluded: false,
    ...patch,
  };
  return item;
}

function makeCurriculum(patch: Partial<Curriculum> = {}): Curriculum {
  return {
    title: "클로드 입문",
    sourceUrl: "https://www.inflearn.com/course/introduction-to-clau?cid=344799",
    platform: "inflearn",
    courseId: "344799",
    instructor: "Doo it",
    droppedCount: 1,
    items: [
      section("s1", "시작하기", 0),
      lesson("l1", "소개", 1, "s1", { durationSec: 600 }),
      lesson("l2", "설치", 2, "s1", { durationSec: null }),
      lesson("l3", "첫 실행", 3, "s1", { durationSec: 300, source: "manual" }),
      section("s2", "심화", 4),
      lesson("l4", "고급 기능", 5, "s2", { durationSec: 1200, excluded: true }),
    ],
    ...patch,
  };
}

function rowOf(title: string): HTMLElement {
  const input = screen.getByDisplayValue(title);
  const row = input.closest("[data-lesson-row]");
  if (!(row instanceof HTMLElement)) throw new Error("row not found");
  return row;
}

describe("CurriculumEditor (UC-03)", () => {
  it("머리: 플랫폼·강사, 강의명, 포함되고 시간 있는 수업 기준 요약", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    expect(screen.getByText("인프런 · Doo it")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "클로드 입문" })).toBeInTheDocument();
    expect(screen.getByText("계획에 넣을 수업 2개 · 재생 15분 · 예상 23분")).toBeInTheDocument();
  });

  it("강사명이 없으면 인프런만", () => {
    render(<CurriculumEditor curriculum={makeCurriculum({ instructor: null })} multiplier={1.5} onAction={() => {}} />);
    expect(screen.getByText("인프런")).toBeInTheDocument();
    expect(screen.queryByText(/인프런 ·/)).not.toBeInTheDocument();
  });

  it("안내 문구: 뺀 개수가 있으면 앞 문장 포함", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    expect(
      screen.getByText("퀴즈·과제 1개는 목차에서 뺐어요. 이미 들은 수업은 체크를 풀어 계획에서 빼세요."),
    ).toBeInTheDocument();
  });

  it("안내 문구: 뺀 개수가 0이면 앞 문장 생략", () => {
    render(<CurriculumEditor curriculum={makeCurriculum({ droppedCount: 0 })} multiplier={1.5} onAction={() => {}} />);
    expect(screen.getByText("이미 들은 수업은 체크를 풀어 계획에서 빼세요.")).toBeInTheDocument();
    expect(screen.queryByText(/퀴즈·과제/)).not.toBeInTheDocument();
  });

  it("시간 누락 상자: 포함된 누락 수업 수", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    expect(
      screen.getByText("재생시간이 없는 수업이 1개 있어요. 입력하기 전까지 배분에서 빠집니다."),
    ).toBeInTheDocument();
  });

  it("누락 수업을 제외하면 상자가 없다", () => {
    const c = makeCurriculum();
    c.items = c.items.map((i) => (i.id === "l2" ? { ...i, excluded: true } : i));
    render(<CurriculumEditor curriculum={c} multiplier={1.5} onAction={() => {}} />);
    expect(screen.queryByText(/재생시간이 없는 수업이/)).not.toBeInTheDocument();
    expect(within(rowOf("설치")).queryByText("시간 누락")).not.toBeInTheDocument();
  });

  it("섹션 카드: 번호·이름·섹션 예상 합, 표 머리", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    const s1 = screen.getByText("시작하기").closest("[data-section]") as HTMLElement;
    expect(within(s1).getByText("섹션 1")).toBeInTheDocument();
    expect(within(s1).getByText("23분")).toBeInTheDocument();
    for (const head of ["추가", "수업", "재생(분)", "예상"]) expect(within(s1).getByText(head)).toBeInTheDocument();
    const s2 = screen.getByText("심화").closest("[data-section]") as HTMLElement;
    expect(within(s2).getByText("섹션 2")).toBeInTheDocument();
    expect(within(s2).getByText("0분")).toBeInTheDocument();
  });

  it("수업 행: 체크·제목·재생 분·예상", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    const row = rowOf("소개");
    expect(within(row).getByRole("checkbox", { name: "계획에 추가" })).toBeChecked();
    expect(within(row).getByDisplayValue("10")).toBeInTheDocument();
    expect(within(row).getByText("15분")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-excluded", "false");
  });

  it("시간 누락 수업: 빈 칸·placeholder —·배지·굵은 테두리·예상 —", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    const row = rowOf("설치");
    const minutes = within(row).getByRole("textbox", { name: "재생 시간(분)" });
    expect(minutes).toHaveValue("");
    expect(minutes).toHaveAttribute("placeholder", "—");
    expect(minutes.className).toContain("border-2");
    expect(within(row).getByText("시간 누락")).toBeInTheDocument();
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("직접 입력한 시간에는 직접 입력 배지", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    expect(within(rowOf("첫 실행")).getByText("직접 입력")).toBeInTheDocument();
    expect(within(rowOf("첫 실행")).getByText("8분")).toBeInTheDocument();
    expect(within(rowOf("소개")).queryByText("직접 입력")).not.toBeInTheDocument();
  });

  it("제외한 수업: 체크 해제·pearl 배경·취소선·예상 —", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    const row = rowOf("고급 기능");
    expect(within(row).getByRole("checkbox", { name: "계획에 추가" })).not.toBeChecked();
    expect(row).toHaveAttribute("data-excluded", "true");
    expect(row.className).toContain("bg-pearl");
    expect(within(row).getByDisplayValue("고급 기능").className).toContain("line-through");
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("체크박스 → TOGGLE_EXCLUDE", async () => {
    const onAction = vi.fn();
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={onAction} />);
    await userEvent.click(within(rowOf("소개")).getByRole("checkbox"));
    expect(onAction).toHaveBeenCalledWith({ type: "TOGGLE_EXCLUDE", itemId: "l1" });
  });

  it("제목 입력 → 바로 EDIT_TITLE", () => {
    const onAction = vi.fn();
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={onAction} />);
    fireEvent.change(screen.getByDisplayValue("소개"), { target: { value: "소개 영상" } });
    expect(onAction).toHaveBeenCalledWith({ type: "EDIT_TITLE", itemId: "l1", title: "소개 영상" });
  });

  it("빈 제목은 dispatch하지 않고 오류를 보이며, 입력값은 그대로 둔다", () => {
    const onAction = vi.fn();
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={onAction} />);
    const input = screen.getByDisplayValue("소개");
    fireEvent.change(input, { target: { value: "   " } });
    expect(onAction).not.toHaveBeenCalled();
    expect(input).toHaveValue("   ");
    expect(input.className).toContain("border-2");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("제목을 비울 수 없어요")).toBeInTheDocument();
    fireEvent.blur(input);
    expect(screen.getByText("제목을 비울 수 없어요")).toBeInTheDocument();
  });

  it("blur 시 오류가 없으면 입력 상태를 지우고 목차 값을 보인다", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    const input = screen.getByDisplayValue("소개");
    fireEvent.change(input, { target: { value: "새 제목 " } });
    expect(input).toHaveValue("새 제목 ");
    fireEvent.blur(input);
    // props가 바뀌지 않았으므로 원래 값으로 돌아온다
    expect(input).toHaveValue("소개");
  });

  it("재생 분 입력 → EDIT_MINUTES", () => {
    const onAction = vi.fn();
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={onAction} />);
    fireEvent.change(within(rowOf("설치")).getByRole("textbox", { name: "재생 시간(분)" }), {
      target: { value: "12" },
    });
    expect(onAction).toHaveBeenCalledWith({ type: "EDIT_MINUTES", itemId: "l2", minutes: 12 });
  });

  it.each(["1441", "-1", "1.5", "abc"])("잘못된 재생 분 %s → dispatch 없음·오류 문구", (value) => {
    const onAction = vi.fn();
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={onAction} />);
    const input = within(rowOf("소개")).getByRole("textbox", { name: "재생 시간(분)" });
    fireEvent.change(input, { target: { value } });
    expect(onAction).not.toHaveBeenCalled();
    expect(input).toHaveValue(value);
    expect(input.className).toContain("border-2");
    expect(screen.getByText("0~1440 사이 분으로 입력해 주세요")).toBeInTheDocument();
  });

  it("배수가 바뀌면 예상이 다시 계산된다", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={2} onAction={() => {}} />);
    expect(screen.getByText("계획에 넣을 수업 2개 · 재생 15분 · 예상 30분")).toBeInTheDocument();
    expect(within(rowOf("소개")).getByText("20분")).toBeInTheDocument();
  });

  it("제목 칸은 min-width 0으로 줄어들 수 있다 (375px 가로 스크롤 방지)", () => {
    render(<CurriculumEditor curriculum={makeCurriculum()} multiplier={1.5} onAction={() => {}} />);
    expect(screen.getByDisplayValue("소개").className).toContain("min-w-0");
    expect(rowOf("소개").className).toContain("grid-cols-[36px_minmax(0,1fr)_72px_76px]");
  });
});
