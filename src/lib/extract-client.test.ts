import { describe, expect, it, vi } from "vitest";
import type { Curriculum } from "@/types/curriculum";
import { extractCurriculum } from "./extract-client";

const CURRICULUM: Curriculum = {
  title: "강의",
  sourceUrl: "https://www.inflearn.com/course/x",
  platform: "inflearn",
  courseId: "1",
  instructor: null,
  droppedCount: 0,
  items: [],
};

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

const FAILED = { ok: false, code: "FETCH_FAILED" };

describe("extractCurriculum", () => {
  it("POST /api/extract에 {url}을 보낸다", async () => {
    const f = jsonFetch({ ok: true, curriculum: CURRICULUM });
    await extractCurriculum("https://www.inflearn.com/course/x", f);
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls).toHaveLength(1);
    const [input, init] = calls[0];
    expect(input).toBe("/api/extract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ url: "https://www.inflearn.com/course/x" });
  });

  it("성공 응답을 그대로 돌려준다", async () => {
    const res = await extractCurriculum("u", jsonFetch({ ok: true, curriculum: CURRICULUM }));
    expect(res).toEqual({ ok: true, curriculum: CURRICULUM });
  });

  it("오류 응답(4xx/5xx)의 code를 그대로 돌려준다", async () => {
    const res = await extractCurriculum("u", jsonFetch({ ok: false, code: "NOT_FOUND" }, 404));
    expect(res).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("네트워크 예외 → FETCH_FAILED (던지지 않음)", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    await expect(extractCurriculum("u", f)).resolves.toEqual(FAILED);
  });

  it("JSON이 아님 → FETCH_FAILED", async () => {
    await expect(extractCurriculum("u", jsonFetch("<html>502</html>", 502))).resolves.toEqual(FAILED);
  });

  it.each([
    ["null", null],
    ["ok 없음", { code: "NOT_FOUND" }],
    ["모르는 코드", { ok: false, code: "BOOM" }],
    ["클라이언트 전용 코드", { ok: false, code: "ALREADY_PLANNED" }],
    ["curriculum 없음", { ok: true }],
    ["title이 문자열 아님", { ok: true, curriculum: { ...CURRICULUM, title: 1 } }],
    ["courseId가 문자열 아님", { ok: true, curriculum: { ...CURRICULUM, courseId: 1 } }],
    ["items가 배열 아님", { ok: true, curriculum: { ...CURRICULUM, items: {} } }],
  ])("모양이 틀림(%s) → FETCH_FAILED", async (_name, body) => {
    await expect(extractCurriculum("u", jsonFetch(body))).resolves.toEqual(FAILED);
  });
});
