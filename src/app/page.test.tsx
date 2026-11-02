import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { PLANS_KEY } from "@/lib/storage/plans";

vi.mock("@/lib/extract-client", () => ({ extractCurriculum: vi.fn(async () => ({ ok: true, curriculum: { title: "테스트 강의", sourceUrl: "https://www.inflearn.com/course/test?cid=123", platform: "inflearn", courseId: "123", instructor: "강사", droppedCount: 0, items: [{ id: "s", title: "섹션", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false }, { id: "i", title: "첫 수업", level: 1, order: 1, sectionId: "s", durationSec: 3600, source: "origin", excluded: false }] } })) }));

beforeEach(() => localStorage.clear());

describe("home flow", () => {
  it("builds and persists a plan", async () => {
    render(<Home />);
    fireEvent.click(await screen.findByRole("button", { name: /강의 커리큘럼/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "강의 URL" }), { target: { value: "https://www.inflearn.com/course/test?cid=123" } });
    fireEvent.click(screen.getByRole("button", { name: "목차 가져오기" }));
    expect(await screen.findByText("테스트 강의")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음: 일정 설정" }));
    fireEvent.click(screen.getByRole("button", { name: "계획 만들기" }));
    expect(await screen.findByRole("heading", { name: "계획확인" })).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PLANS_KEY) ?? "{}").plans).toHaveLength(1));
  });
});
