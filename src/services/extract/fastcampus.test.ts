// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Curriculum } from "@/types/curriculum";
import { ExtractError } from "./errors";
import { fetchFastcampusCurriculum, parseFastcampusHtml } from "./fastcampus";

const FIXTURE = readFileSync(
  join(process.cwd(), "tests/fixtures/fastcampus/biz_online_claude.html"),
  "utf8",
);
const COURSE_URL = "https://fastcampus.co.kr/biz_online_claude";
/** fixture의 PART 7개 `time` 합(01:49:56 + 03:01:37 + 01:54:03 + 01:36:20 + 01:52:56 + 00:46:14 + 01:07:40) */
const FIXTURE_TOTAL_SEC = 43_726;

// ───────────── 합성 HTML 도우미 ─────────────

/** RSC payload를 여러 `self.__next_f.push([1,"..."])` 조각으로 나눠 HTML을 만든다. */
function rscHtml(payload: string, { ogTitle, title, pieces = 3 }: { ogTitle?: string; title?: string; pieces?: number } = {}): string {
  const size = Math.ceil(payload.length / pieces);
  const scripts: string[] = [];
  for (let i = 0; i < payload.length; i += size) {
    scripts.push(`<script>self.__next_f.push([1,${JSON.stringify(payload.slice(i, i + size))}])</script>`);
  }
  const head = [
    ogTitle !== undefined ? `<meta property="og:title" content="${ogTitle}"/>` : "",
    title !== undefined ? `<title>${title}</title>` : "",
  ].join("");
  return `<!DOCTYPE html><html><head>${head}</head><body><script>(self.__next_f=self.__next_f||[]).push([0])</script>${scripts.join("")}</body></html>`;
}

function payloadWith(curriculum: unknown, courseId: number | null = 99): string {
  const query = courseId === null ? "" : `{"queryKey":["courses","getCourseById",{"courseId":${courseId}}]},`;
  return `1:["$","div",null,{"state":[${query}{"data":{"curriculum":${JSON.stringify(curriculum)}}}]}]\n`;
}

function clip(id: number, title: string, time: string, isAppendix = false) {
  return { id, type: "CLIP", title, time, isAppendix };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ExtractError);
    expect((err as ExtractError).code).toBe(code);
    return;
  }
  throw new Error("expected ExtractError");
}

// ───────────── fixture 계약 ─────────────

describe("parseFastcampusHtml — fixture biz_online_claude", () => {
  const curriculum: Curriculum = parseFastcampusHtml(FIXTURE, COURSE_URL);
  const sections = curriculum.items.filter((i) => i.level === 0);
  const lectures = curriculum.items.filter((i) => i.level === 1);

  it("courseId는 fastcampus:{getCourseById의 courseId}", () => {
    expect(curriculum.courseId).toBe("fastcampus:261444");
  });

  it("og:title에서 ' | 패스트캠퍼스'를 떼고 &amp;를 디코딩한다", () => {
    expect(curriculum.title.startsWith("Claude의 모든 것")).toBe(true);
    expect(curriculum.title).toContain("자동화&Agent");
    expect(curriculum.title).not.toContain("&amp;");
    expect(curriculum.title).not.toContain("패스트캠퍼스");
  });

  it("platform·sourceUrl·droppedCount·instructor", () => {
    expect(curriculum.platform).toBe("fastcampus");
    expect(curriculum.sourceUrl).toBe(COURSE_URL);
    expect(curriculum.droppedCount).toBe(0);
    expect(curriculum.instructor).toBeNull();
  });

  it("섹션은 CHAPTER 16개, 수업은 CLIP 51개", () => {
    expect(sections).toHaveLength(16);
    expect(lectures).toHaveLength(51);
  });

  it("첫 섹션 제목은 'Part 제목 · Chapter 제목'", () => {
    expect(sections[0]).toMatchObject({
      id: "1262322",
      title: "Part 1. Claude 입문 & 핵심 기능 이해 · Ch 1. Claude 시작하기",
      sectionId: null,
      durationSec: null,
    });
  });

  it("첫 수업은 704초", () => {
    expect(lectures[0]).toMatchObject({
      id: "8268438",
      title: "01. OT 이 강의로 무엇을 할 수 있게 되나요",
      durationSec: 704,
      source: "origin",
      excluded: false,
    });
  });

  it("전체 durationSec 합은 PART time 합과 같다", () => {
    const total = lectures.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
    expect(total).toBe(FIXTURE_TOTAL_SEC);
    expect(lectures.every((l) => l.durationSec !== null && l.durationSec > 0)).toBe(true);
  });

  it("order는 0부터 연속이고 sectionId는 앞선 섹션을 가리킨다", () => {
    curriculum.items.forEach((item, index) => expect(item.order).toBe(index));
    expect(curriculum.items[0].level).toBe(0);
    let currentSection: string | null = null;
    for (const item of curriculum.items) {
      if (item.level === 0) {
        currentSection = item.id;
        expect(item.sectionId).toBeNull();
      } else {
        expect(item.sectionId).toBe(currentSection);
      }
    }
  });

  it("모든 항목 source=origin, excluded=false, id는 유일", () => {
    expect(curriculum.items.every((i) => i.source === "origin" && !i.excluded)).toBe(true);
    expect(new Set(curriculum.items.map((i) => i.id)).size).toBe(curriculum.items.length);
  });
});

// ───────────── 변환 규칙 (합성) ─────────────

describe("parseFastcampusHtml — 변환 규칙", () => {
  it("PART 바로 아래 CLIP이 있으면 PART를 섹션으로 쓴다", () => {
    const html = rscHtml(
      payloadWith([{ id: 1, type: "PART", title: "Part A", time: "00:10:00", child: [clip(11, "a", "00:10:00")] }]),
    );
    const c = parseFastcampusHtml(html, COURSE_URL);
    expect(c.items).toEqual([
      { id: "1", title: "Part A", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
      { id: "11", title: "a", level: 1, order: 1, sectionId: "1", durationSec: 600, source: "origin", excluded: false },
    ]);
  });

  it("isAppendix CLIP도 수업으로 포함하고 CLIP 없는 CHAPTER는 버린다", () => {
    const html = rscHtml(
      payloadWith([
        {
          id: 1,
          type: "PART",
          title: "P",
          time: "00:00:00",
          child: [
            { id: 2, type: "CHAPTER", title: "빈 챕터", time: "00:00:00", child: [] },
            { id: 3, type: "CHAPTER", title: "C", time: "00:05:00", child: [clip(31, "부록", "00:05:00", true)] },
          ],
        },
      ]),
    );
    const c = parseFastcampusHtml(html, COURSE_URL);
    expect(c.items.map((i) => [i.id, i.title, i.order])).toEqual([
      ["3", "P · C", 0],
      ["31", "부록", 1],
    ]);
  });

  it("time은 H:MM:SS와 MM:SS를 받고, 0이나 잘못된 형식은 null", () => {
    const html = rscHtml(
      payloadWith([
        {
          id: 1,
          type: "PART",
          title: "P",
          time: "x",
          child: [
            {
              id: 2,
              type: "CHAPTER",
              title: "C",
              time: "x",
              child: [
                clip(21, "a", "1:02:03"),
                clip(22, "b", "12:34"),
                clip(23, "c", "00:00:00"),
                clip(24, "d", "abc"),
                clip(25, "e", "00:61:00"),
                { id: 26, type: "CLIP", title: "f" },
              ],
            },
          ],
        },
      ]),
    );
    const c = parseFastcampusHtml(html, COURSE_URL);
    expect(c.items.filter((i) => i.level === 1).map((i) => i.durationSec)).toEqual([3723, 754, null, null, null, null]);
  });

  it("문자열 안의 괄호는 배열 경계로 보지 않는다", () => {
    const html = rscHtml(
      payloadWith([
        { id: 1, type: "PART", title: "P ] [", time: "00:01:00", child: [clip(11, '괄호 ]] "따옴표" [', "00:01:00")] },
      ]) + `2:{"curriculum":"뒤"}`,
    );
    const c = parseFastcampusHtml(html, COURSE_URL);
    expect(c.items[1].title).toBe('괄호 ]] "따옴표" [');
  });

  it("og:title이 없으면 <title>, 둘 다 없으면 '제목 없는 강의'", () => {
    const payload = payloadWith([{ id: 1, type: "PART", title: "P", time: "", child: [clip(11, "a", "00:01:00")] }]);
    expect(parseFastcampusHtml(rscHtml(payload, { title: "제목 &lt;A&gt; | 패스트캠퍼스" }), COURSE_URL).title).toBe(
      "제목 <A>",
    );
    expect(parseFastcampusHtml(rscHtml(payload), COURSE_URL).title).toBe("제목 없는 강의");
  });

  it("마지막 ' | 패스트캠퍼스'만 뗀다", () => {
    const payload = payloadWith([{ id: 1, type: "PART", title: "P", time: "", child: [clip(11, "a", "00:01:00")] }]);
    expect(parseFastcampusHtml(rscHtml(payload, { ogTitle: "A | B | 패스트캠퍼스" }), COURSE_URL).title).toBe("A | B");
  });
});

// ───────────── NO_CURRICULUM ─────────────

describe("parseFastcampusHtml — NO_CURRICULUM", () => {
  const one = [{ id: 1, type: "PART", title: "P", time: "", child: [clip(11, "a", "00:01:00")] }];

  it("curriculum이 없는 HTML", () => {
    expectCode(() => parseFastcampusHtml("<html><body>패스트캠퍼스</body></html>", COURSE_URL), "NO_CURRICULUM");
    expectCode(() => parseFastcampusHtml(rscHtml(`1:{"other":[]}`), COURSE_URL), "NO_CURRICULUM");
  });

  it("손상된 payload (배열이 닫히지 않음, 조각 문자열 손상)", () => {
    expectCode(() => parseFastcampusHtml(rscHtml(`1:{"courseId":1,"curriculum":[{"id":1,`), COURSE_URL), "NO_CURRICULUM");
    expectCode(
      () => parseFastcampusHtml(`<script>self.__next_f.push([1,"\\x"])</script>`, COURSE_URL),
      "NO_CURRICULUM",
    );
    expectCode(() => parseFastcampusHtml(rscHtml(`1:{"courseId":1,"curriculum":[1,}]}`), COURSE_URL), "NO_CURRICULUM");
  });

  it("CLIP이 0개", () => {
    const html = rscHtml(
      payloadWith([{ id: 1, type: "PART", title: "P", time: "", child: [{ id: 2, type: "CHAPTER", title: "C", child: [] }] }]),
    );
    expectCode(() => parseFastcampusHtml(html, COURSE_URL), "NO_CURRICULUM");
  });

  it("courseId가 없음", () => {
    expectCode(() => parseFastcampusHtml(rscHtml(payloadWith(one, null)), COURSE_URL), "NO_CURRICULUM");
  });
});

// ───────────── 요청 ─────────────

describe("fetchFastcampusCurriculum", () => {
  it("200 응답을 파싱하고 sourceUrl은 url.href", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(FIXTURE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    );
    const url = new URL(COURSE_URL);
    const c = await fetchFastcampusCurriculum(url, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe(COURSE_URL);
    expect(fetchImpl.mock.calls[0][1]?.redirect).toBe("manual");
    expect(c.courseId).toBe("fastcampus:261444");
    expect(c.sourceUrl).toBe(url.href);
  });

  it("불허 경로면 요청하지 않고 UNSUPPORTED", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(fetchFastcampusCurriculum(new URL("https://fastcampus.co.kr/a/b"), fetchImpl)).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("불허 호스트로 리다이렉트하면 UNSUPPORTED", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://evil.example/x" } }));
    await expect(fetchFastcampusCurriculum(new URL(COURSE_URL), fetchImpl)).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
