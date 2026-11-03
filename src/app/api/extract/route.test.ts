// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractResponse } from "@/types/curriculum";
import { POST, runtime } from "./route";

function post(body: string | undefined): Request {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function call(body: string | undefined): Promise<{ status: number; json: ExtractResponse }> {
  const res = await POST(post(body));
  expect(res.headers.get("content-type")).toContain("application/json");
  return { status: res.status, json: (await res.json()) as ExtractResponse };
}

describe("POST /api/extract (EXTRACT_FIXTURES=1)", () => {
  beforeEach(() => {
    vi.stubEnv("EXTRACT_FIXTURES", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("nodejs 런타임", () => {
    expect(runtime).toBe("nodejs");
  });

  it("UC-02 정상 URL → ok + 영상 수업 12개", async () => {
    const { status, json } = await call(
      JSON.stringify({ url: "https://www.inflearn.com/course/introduction-to-clau?cid=344799" }),
    );
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.curriculum.courseId).toBe("344799");
    expect(json.curriculum.items.filter((i) => i.level === 1)).toHaveLength(12);
  });

  it("UC-02 scheme 없음·공백 입력도 정규화한다", async () => {
    const { status, json } = await call(
      JSON.stringify({ url: "  www.inflearn.com/course/introduction-to-clau#curriculum " }),
    );
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it.each([
    ["빈 body", undefined],
    ["잘못된 JSON", "{not json"],
    ["url이 문자열이 아님", JSON.stringify({ url: 3 })],
    ["url 없음", JSON.stringify({})],
    ["빈 url", JSON.stringify({ url: "   " })],
    ["JSON null", "null"],
  ])("E1 %s → INVALID_URL 400", async (_name, body) => {
    const { status, json } = await call(body);
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, code: "INVALID_URL" });
  });

  it("E2 udemy → UNSUPPORTED 422", async () => {
    const { status, json } = await call(JSON.stringify({ url: "https://www.udemy.com/course/x" }));
    expect(status).toBe(422);
    expect(json).toEqual({ ok: false, code: "UNSUPPORTED" });
  });

  it("E2 로드맵 URL → UNSUPPORTED 422", async () => {
    const { status, json } = await call(JSON.stringify({ url: "https://www.inflearn.com/roadmaps/1" }));
    expect(status).toBe(422);
    expect(json).toEqual({ ok: false, code: "UNSUPPORTED" });
  });

  it("패스트캠퍼스 fixture URL → 200, platform fastcampus", async () => {
    const { status, json } = await call(
      JSON.stringify({ url: "https://fastcampus.co.kr/biz_online_claude" }),
    );
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.curriculum.platform).toBe("fastcampus");
  });

  it("메가스터디 /chr/ URL은 정규화되어 200, 강의명 확인", async () => {
    const { status, json } = await call(
      JSON.stringify({ url: "https://megastudy.net/chr/lecture_detailview.asp?CHR_CD=54549" }),
    );
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.curriculum.platform).toBe("megastudy");
    expect(json.curriculum.title).toBe("중국어 어휘 폭풍성장");
  });

  it("E2 youtube.com을 접미사로 가진 다른 호스트 → UNSUPPORTED 422", async () => {
    const { status, json } = await call(
      JSON.stringify({ url: "https://youtube.com.evil.com/playlist?list=x" }),
    );
    expect(status).toBe(422);
    expect(json).toEqual({ ok: false, code: "UNSUPPORTED" });
  });

  it("YouTube도 fixture fetch를 받아 외부에 요청하지 않는다 (fixture 없음 → 404)", async () => {
    const realFetch = vi.fn(async () => {
      throw new Error("network must not be used");
    });
    vi.stubGlobal("fetch", realFetch);
    try {
      const { status, json } = await call(
        JSON.stringify({ url: "https://www.youtube.com/playlist?list=PLabc" }),
      );
      expect(realFetch).not.toHaveBeenCalled();
      expect(status).toBe(404);
      expect(json).toEqual({ ok: false, code: "NOT_FOUND" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("E3 fixture 없는 slug → NOT_FOUND 404", async () => {
    const { status, json } = await call(
      JSON.stringify({ url: "https://www.inflearn.com/course/no-such-course" }),
    );
    expect(status).toBe(404);
    expect(json).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("POST /api/extract — 예상하지 못한 예외", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("네트워크 예외는 FETCH_FAILED 502이고 응답에 원문을 넣지 않는다", async () => {
    vi.stubEnv("EXTRACT_FIXTURES", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // 실제 네트워크 대신 항상 실패하는 가짜 fetch
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("SECRET internal detail");
      }),
    );
    const res = await POST(
      post(JSON.stringify({ url: "https://www.inflearn.com/course/introduction-to-clau" })),
    );
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, code: "FETCH_FAILED" });
    expect(text).not.toContain("SECRET");
    expect(errorSpy).toHaveBeenCalled();
  });
});
