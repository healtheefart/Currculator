// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Curriculum } from "@/types/curriculum";
import { ExtractError } from "./errors";
import {
  FETCH_TIMEOUT_MS,
  FETCH_USER_AGENT,
  MAX_REDIRECTS,
  fetchInflearnCurriculum,
  parseInflearnHtml,
} from "./inflearn";

const FIXTURE = readFileSync(
  join(process.cwd(), "tests/fixtures/inflearn/introduction-to-clau.html"),
  "utf8",
);
const COURSE_URL = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";
const FIXTURE_TITLE =
  "클로드(Claude) 코워크 업무 자동화 입문편: 비개발자 직장인 실무 11가지 (회의록부터 제안서·엑셀·FAQ까지)";

// ───────────── 합성 HTML 도우미 ─────────────

interface UnitInput {
  id: number | string;
  title: string;
  type: string;
  runtime: number;
}
interface SectionInput {
  id: number | string;
  title: string;
  units: UnitInput[];
}

function nextDataHtml(
  queries: unknown[],
  { ogTitle, raw }: { ogTitle?: string; raw?: string } = {},
): string {
  const json = raw ?? JSON.stringify({ props: { pageProps: { dehydratedState: { queries } } } });
  const og = ogTitle === undefined ? "" : `<meta property="og:title" content="${ogTitle}"/>`;
  return `<!DOCTYPE html><html><head>${og}</head><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json" crossorigin="anonymous">${json}</script></body></html>`;
}

function curriculumQuery(sections: SectionInput[], courseId = 123): unknown {
  return {
    queryKey: [`/client/api/v2/courses/${courseId}/curriculum`],
    state: { data: { data: { curriculum: sections } } },
  };
}

function infoQuery(data: unknown, courseId = 123): unknown {
  return { queryKey: [`/client/api/v1/course/${courseId}/online/info`], state: { data: { data } } };
}

const SIMPLE_SECTIONS: SectionInput[] = [
  {
    id: 10,
    title: "섹션 A",
    units: [
      { id: 11, title: "수업 1", type: "LECTURE", runtime: 300 },
      { id: 12, title: "퀴즈", type: "QUIZ", runtime: 0 },
      { id: 13, title: "수업 2", type: "LECTURE", runtime: 0 },
    ],
  },
  {
    id: 20,
    title: "과제만 있는 섹션",
    units: [{ id: 21, title: "과제", type: "ASSIGNMENT", runtime: 0 }],
  },
  {
    id: 30,
    title: "섹션 B",
    units: [{ id: 31, title: "수업 3", type: "LECTURE", runtime: 120 }],
  },
];

function expectExtractError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ExtractError);
    expect((err as ExtractError).code).toBe(code);
    return;
  }
  throw new Error(`ExtractError(${code})가 발생하지 않았습니다`);
}

async function expectRejectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(ExtractError);
  await expect(promise).rejects.toMatchObject({ code });
}

// ───────────── parseInflearnHtml ─────────────

describe("parseInflearnHtml — 실측 fixture (introduction-to-clau)", () => {
  const curriculum: Curriculum = parseInflearnHtml(FIXTURE, COURSE_URL);
  const sections = curriculum.items.filter((i) => i.level === 0);
  const lectures = curriculum.items.filter((i) => i.level === 1);

  it("강의 정보", () => {
    expect(curriculum.title).toBe(FIXTURE_TITLE);
    expect(curriculum.courseId).toBe("344799");
    expect(curriculum.instructor).toBe("Doo it");
    expect(curriculum.platform).toBe("inflearn");
    expect(curriculum.sourceUrl).toBe(COURSE_URL);
    expect(curriculum.droppedCount).toBe(1);
  });

  it("섹션 4개, 영상 수업 12개, 재생시간 합 6385초", () => {
    expect(sections).toHaveLength(4);
    expect(lectures).toHaveLength(12);
    expect(lectures.reduce((sum, i) => sum + (i.durationSec ?? 0), 0)).toBe(6385);
    expect(sections[0].title).toBe("시작하기: 설치부터 첫 스킬 저장까지");
  });

  it("항목 형태: order 연속, 섹션 id 연결, origin·미제외", () => {
    curriculum.items.forEach((item, idx) => {
      expect(item.order).toBe(idx);
      expect(item.source).toBe("origin");
      expect(item.excluded).toBe(false);
      expect(typeof item.id).toBe("string");
    });
    expect(curriculum.items[0]).toMatchObject({
      id: "506792",
      level: 0,
      sectionId: null,
      durationSec: null,
    });
    expect(curriculum.items[1]).toMatchObject({
      id: "506795",
      level: 1,
      sectionId: "506792",
      durationSec: 543,
    });
    const sectionIds = new Set(sections.map((s) => s.id));
    lectures.forEach((l) => expect(sectionIds.has(l.sectionId ?? "")).toBe(true));
  });
});

describe("parseInflearnHtml — 합성 HTML", () => {
  it("LECTURE만 남기고 나머지는 droppedCount로 센다. LECTURE가 없는 섹션은 버린다", () => {
    const c = parseInflearnHtml(nextDataHtml([curriculumQuery(SIMPLE_SECTIONS)]), "src");
    expect(c.droppedCount).toBe(2);
    expect(c.items.map((i) => [i.id, i.level, i.sectionId, i.durationSec, i.order])).toEqual([
      ["10", 0, null, null, 0],
      ["11", 1, "10", 300, 1],
      ["13", 1, "10", null, 2],
      ["30", 0, null, null, 3],
      ["31", 1, "30", 120, 4],
    ]);
    expect(c.courseId).toBe("123");
    expect(c.sourceUrl).toBe("src");
  });

  it("runtime이 0·음수·숫자가 아니면 durationSec null", () => {
    const html = nextDataHtml([
      curriculumQuery([
        {
          id: 1,
          title: "S",
          units: [
            { id: 2, title: "a", type: "LECTURE", runtime: 0 },
            { id: 3, title: "b", type: "LECTURE", runtime: -5 },
            { id: 4, title: "c", type: "LECTURE", runtime: "60" as unknown as number },
            { id: 5, title: "d", type: "LECTURE", runtime: 61 },
          ],
        },
      ]),
    ]);
    const c = parseInflearnHtml(html, "src");
    expect(c.items.filter((i) => i.level === 1).map((i) => i.durationSec)).toEqual([
      null,
      null,
      null,
      61,
    ]);
  });

  it("강의명은 online/info → og:title(| 앞) → 기본값 순서", () => {
    const withInfo = nextDataHtml(
      [curriculumQuery(SIMPLE_SECTIONS), infoQuery({ title: "정보 제목", instructors: [] })],
      { ogTitle: "OG 제목| 강사 - 인프런 강의" },
    );
    expect(parseInflearnHtml(withInfo, "src").title).toBe("정보 제목");

    const ogOnly = nextDataHtml([curriculumQuery(SIMPLE_SECTIONS)], {
      ogTitle: "OG 제목 &amp; 부제 | 강사 - 인프런 강의",
    });
    expect(parseInflearnHtml(ogOnly, "src").title).toBe("OG 제목 & 부제");

    const none = nextDataHtml([curriculumQuery(SIMPLE_SECTIONS)]);
    expect(parseInflearnHtml(none, "src").title).toBe("제목 없는 강의");
  });

  it("강사명: 문자열 name만 ', '로 잇고, 없으면 null", () => {
    const many = nextDataHtml([
      curriculumQuery(SIMPLE_SECTIONS),
      infoQuery({ title: "t", instructors: [{ name: "가" }, { name: 3 }, null, { name: "나" }] }),
    ]);
    expect(parseInflearnHtml(many, "src").instructor).toBe("가, 나");

    const empty = nextDataHtml([
      curriculumQuery(SIMPLE_SECTIONS),
      infoQuery({ title: "t", instructors: [] }),
    ]);
    expect(parseInflearnHtml(empty, "src").instructor).toBeNull();

    const noInfo = nextDataHtml([curriculumQuery(SIMPLE_SECTIONS)]);
    expect(parseInflearnHtml(noInfo, "src").instructor).toBeNull();
  });

  it("__NEXT_DATA__가 없으면 NO_CURRICULUM", () => {
    expectExtractError(() => parseInflearnHtml("<html><body>hi</body></html>", "src"), "NO_CURRICULUM");
  });

  it("__NEXT_DATA__ JSON이 깨졌으면 NO_CURRICULUM", () => {
    expectExtractError(
      () => parseInflearnHtml(nextDataHtml([], { raw: "{not json" }), "src"),
      "NO_CURRICULUM",
    );
  });

  it("queries 구조가 없거나 curriculum 쿼리가 없으면 NO_CURRICULUM", () => {
    expectExtractError(() => parseInflearnHtml(nextDataHtml([], { raw: "{}" }), "src"), "NO_CURRICULUM");
    expectExtractError(
      () => parseInflearnHtml(nextDataHtml([infoQuery({ title: "t" })]), "src"),
      "NO_CURRICULUM",
    );
  });

  it("영상 수업이 0개면 NO_CURRICULUM", () => {
    const html = nextDataHtml([
      curriculumQuery([{ id: 1, title: "S", units: [{ id: 2, title: "q", type: "QUIZ", runtime: 0 }] }]),
    ]);
    expectExtractError(() => parseInflearnHtml(html, "src"), "NO_CURRICULUM");
  });
});

// ───────────── fetchInflearnCurriculum ─────────────

type Route = { status: number; location?: string; body?: string } | Error;

function fakeFetch(routes: Record<string, Route>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    void init;
    const href = input instanceof URL ? input.href : String(input);
    const route = routes[href];
    if (!route) throw new Error(`예상하지 못한 요청: ${href}`);
    if (route instanceof Error) throw route;
    const headers = new Headers();
    if (route.location !== undefined) headers.set("Location", route.location);
    return new Response(route.body ?? null, { status: route.status, headers });
  });
}

function requestedUrls(mock: ReturnType<typeof fakeFetch>): string[] {
  return mock.mock.calls.map(([input]) => (input instanceof URL ? input.href : String(input)));
}

describe("fetchInflearnCurriculum", () => {
  it("상수", () => {
    expect(FETCH_TIMEOUT_MS).toBe(30_000);
    expect(MAX_REDIRECTS).toBe(5);
    expect(FETCH_USER_AGENT).toMatch(/Mozilla\/5\.0 .*Chrome\/\d+/);
  });

  it("정상: fixture 본문을 파싱한다", async () => {
    const f = fakeFetch({ [COURSE_URL]: { status: 200, body: FIXTURE } });
    const c = await fetchInflearnCurriculum(new URL(COURSE_URL), f);
    expect(c.title).toBe(FIXTURE_TITLE);
    expect(c.sourceUrl).toBe(COURSE_URL);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("404 → NOT_FOUND", async () => {
    const f = fakeFetch({ [COURSE_URL]: { status: 404, body: "nope" } });
    await expectRejectCode(fetchInflearnCurriculum(new URL(COURSE_URL), f), "NOT_FOUND");
  });

  it.each([500, 403, 429, 304])("%i → FETCH_FAILED", async (status) => {
    const f = fakeFetch({ [COURSE_URL]: { status } });
    await expectRejectCode(fetchInflearnCurriculum(new URL(COURSE_URL), f), "FETCH_FAILED");
  });

  it("fetch 예외(네트워크·타임아웃) → FETCH_FAILED", async () => {
    const f = fakeFetch({ [COURSE_URL]: new TypeError("fetch failed") });
    await expectRejectCode(fetchInflearnCurriculum(new URL(COURSE_URL), f), "FETCH_FAILED");
    const t = fakeFetch({ [COURSE_URL]: new DOMException("timeout", "TimeoutError") });
    await expectRejectCode(fetchInflearnCurriculum(new URL(COURSE_URL), t), "FETCH_FAILED");
  });

  it("2xx지만 커리큘럼이 없으면 NO_CURRICULUM", async () => {
    const f = fakeFetch({ [COURSE_URL]: { status: 200, body: "<html></html>" } });
    await expectRejectCode(fetchInflearnCurriculum(new URL(COURSE_URL), f), "NO_CURRICULUM");
  });

  it("inf.run 단축 링크 → slug → cid URL 리다이렉트를 따라간다", async () => {
    const f = fakeFetch({
      "https://inf.run/abc": { status: 301, location: "https://www.inflearn.com/course/introduction-to-clau" },
      "https://www.inflearn.com/course/introduction-to-clau": {
        status: 308,
        location: "/course/introduction-to-clau?cid=344799",
      },
      [COURSE_URL]: { status: 200, body: FIXTURE },
    });
    const c = await fetchInflearnCurriculum(new URL("https://inf.run/abc"), f);
    expect(c.courseId).toBe("344799");
    expect(c.sourceUrl).toBe("https://inf.run/abc");
    expect(requestedUrls(f)).toEqual([
      "https://inf.run/abc",
      "https://www.inflearn.com/course/introduction-to-clau",
      COURSE_URL,
    ]);
  });

  it("모든 홉에 redirect: manual, 같은 timeout signal, 브라우저 UA를 쓴다", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const f = fakeFetch({
      "https://inf.run/abc": { status: 302, location: COURSE_URL },
      [COURSE_URL]: { status: 200, body: FIXTURE },
    });
    await fetchInflearnCurriculum(new URL("https://inf.run/abc"), f);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
    timeoutSpy.mockRestore();

    const inits = f.mock.calls.map(([, init]) => init as RequestInit);
    expect(inits).toHaveLength(2);
    for (const init of inits) {
      expect(init.redirect).toBe("manual");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal).toBe(inits[0].signal);
      const headers = new Headers(init.headers);
      expect(headers.get("User-Agent")).toBe(FETCH_USER_AGENT);
      expect(headers.get("Accept-Language")).toBe("ko");
    }
  });

  it.each([
    ["외부 호스트", "https://evil.com/course/abc"],
    ["호스트 우회", "https://www.inflearn.com.evil.com/course/abc"],
    ["http", "http://www.inflearn.com/course/abc"],
    ["인프런 로드맵", "https://www.inflearn.com/roadmaps/1"],
    ["인프런 API", "https://www.inflearn.com/api/courses/1"],
    ["course-api", "https://course-api.inflearn.com/client/api/v2/courses/1/curriculum"],
  ])("리다이렉트 대상이 %s이면 그 대상에 요청하지 않고 UNSUPPORTED", async (_label, target) => {
    const f = fakeFetch({ "https://inf.run/abc": { status: 301, location: target } });
    await expectRejectCode(fetchInflearnCurriculum(new URL("https://inf.run/abc"), f), "UNSUPPORTED");
    expect(requestedUrls(f)).toEqual(["https://inf.run/abc"]);
  });

  it("inf.run이 리다이렉트 없이 응답하면(강의 경로 아님) UNSUPPORTED", async () => {
    const f = fakeFetch({ "https://inf.run/abc": { status: 200, body: FIXTURE } });
    await expectRejectCode(fetchInflearnCurriculum(new URL("https://inf.run/abc"), f), "UNSUPPORTED");
  });

  it("Location 누락 → FETCH_FAILED", async () => {
    const f = fakeFetch({ "https://inf.run/abc": { status: 302 } });
    await expectRejectCode(fetchInflearnCurriculum(new URL("https://inf.run/abc"), f), "FETCH_FAILED");
  });

  it("잘못된 Location → FETCH_FAILED", async () => {
    const f = fakeFetch({ "https://inf.run/abc": { status: 302, location: "https://exa mple:99999/" } });
    await expectRejectCode(fetchInflearnCurriculum(new URL("https://inf.run/abc"), f), "FETCH_FAILED");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("리다이렉트 루프 → FETCH_FAILED", async () => {
    const a = "https://www.inflearn.com/course/a";
    const b = "https://www.inflearn.com/course/b";
    const f = fakeFetch({ [a]: { status: 307, location: b }, [b]: { status: 307, location: a } });
    await expectRejectCode(fetchInflearnCurriculum(new URL(a), f), "FETCH_FAILED");
    expect(requestedUrls(f)).toEqual([a, b]);
  });

  it(`리다이렉트 ${MAX_REDIRECTS}회는 허용, 초과하면 FETCH_FAILED`, async () => {
    const hop = (n: number) => `https://www.inflearn.com/course/hop-${n}`;
    const routesOk: Record<string, Route> = {};
    for (let n = 0; n < MAX_REDIRECTS; n++) routesOk[hop(n)] = { status: 302, location: hop(n + 1) };
    routesOk[hop(MAX_REDIRECTS)] = { status: 200, body: FIXTURE };
    const ok = fakeFetch(routesOk);
    await expect(fetchInflearnCurriculum(new URL(hop(0)), ok)).resolves.toMatchObject({
      courseId: "344799",
    });
    expect(ok).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);

    const routesTooMany: Record<string, Route> = {};
    for (let n = 0; n <= MAX_REDIRECTS; n++) routesTooMany[hop(n)] = { status: 302, location: hop(n + 1) };
    routesTooMany[hop(MAX_REDIRECTS + 1)] = { status: 200, body: FIXTURE };
    const tooMany = fakeFetch(routesTooMany);
    await expectRejectCode(fetchInflearnCurriculum(new URL(hop(0)), tooMany), "FETCH_FAILED");
    expect(tooMany).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it.each([
    "https://evil.com/course/abc",
    "http://www.inflearn.com/course/abc",
    "https://inflearn.com.evil.com/course/abc",
    "https://www.inflearn.com/roadmaps/1",
    "https://course-api.inflearn.com/client/api/v2/courses/1/curriculum",
  ])("허용 범위 밖의 최초 URL은 fetch를 호출하지 않는다: %s", async (raw) => {
    const f = fakeFetch({});
    await expectRejectCode(fetchInflearnCurriculum(new URL(raw), f), "UNSUPPORTED");
    expect(f).not.toHaveBeenCalled();
  });
});
