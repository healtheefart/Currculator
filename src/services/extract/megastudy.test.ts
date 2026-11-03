// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ExtractError } from "./errors";
import { fetchMegastudyCurriculum, parseMegastudyHtml } from "./megastudy";

const FIXTURE_BYTES = readFileSync(join(process.cwd(), "tests/fixtures/megastudy/54549.html"));
const FIXTURE = new TextDecoder("euc-kr").decode(FIXTURE_BYTES);
const COURSE_URL = "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549";
/** fixture 강의목차 표 21행(OT + 1~20강)의 시간 합 = 17시간 11분 3초 */
const FIXTURE_TOTAL_SEC = 61_863;

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ExtractError);
    expect((err as ExtractError).code).toBe(code);
    return;
  }
  throw new Error("expected ExtractError");
}

async function expectCodeAsync(promise: Promise<unknown>, code: string) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ExtractError);
  expect((err as ExtractError).code).toBe(code);
}

function row(title: string, time: string) {
  return `<tr><td>${title}</td><td><div class="lstedu--subbx_btn"></div></td><td class="lecture-time">-</td><td class="lecture-time">${time}</td></tr>`;
}

function pageHtml(rows: string[], { title = "테스트 강의", teacher = "[수학] 홍길동 선생님" } = {}) {
  return `<html><head><title>메가스터디</title></head><body>
<p class="lstedu_bookinfo--tit">${title}</p>
<p class="lstedu_bookinfo--teacher"><strong><a href="/t">${teacher}</a></strong></p>
<div id="scrollTab1"><p class="lstedu--subbx_tit">강좌정보</p>
<table border="1" class="tb_char_opt"><tbody><tr><td>강좌 소개</td><td class="lecture-time">99:99</td></tr></tbody></table></div>
<div id="scrollTab2" class="lstedu--subbx"><p class="lstedu--subbx_tit">강의목차</p>
<table border="1" class="tb_char_opt"><thead><tr><th>강의명</th><th>맛보기</th><th>교재</th><th>시간</th></tr></thead>
<tbody>${rows.join("\n")}</tbody></table></div></body></html>`;
}

describe("parseMegastudyHtml — fixture 54549", () => {
  const c = parseMegastudyHtml(FIXTURE, COURSE_URL, "54549");
  const lectures = c.items.filter((i) => i.level === 1);
  const sections = c.items.filter((i) => i.level === 0);

  it("강의 정보", () => {
    expect(c.title).toBe("중국어 어휘 폭풍성장");
    expect(c.instructor).toBe("박수진");
    expect(c.platform).toBe("megastudy");
    expect(c.courseId).toBe("megastudy:54549");
    expect(c.sourceUrl).toBe(COURSE_URL);
    expect(c.droppedCount).toBe(0);
  });

  it("가상 섹션 1개 + 수업 21개", () => {
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      id: "megastudy:54549",
      title: "중국어 어휘 폭풍성장",
      sectionId: null,
      durationSec: null,
      order: 0,
    });
    expect(lectures).toHaveLength(21);
    expect(lectures.every((l) => l.sectionId === "megastudy:54549")).toBe(true);
    expect(lectures.every((l) => l.source === "origin" && l.excluded === false)).toBe(true);
  });

  it("첫 두 수업과 id·order", () => {
    expect(lectures[0]).toMatchObject({ id: "megastudy:54549:0", title: "OT", durationSec: 684 });
    expect(lectures[1]).toMatchObject({ id: "megastudy:54549:1", title: "1강. [1,2급] 가족 / 집안", durationSec: 3385 });
    expect(c.items.map((i) => i.order)).toEqual(c.items.map((_, idx) => idx));
  });

  it("재생시간 합", () => {
    expect(lectures.reduce((s, l) => s + (l.durationSec ?? 0), 0)).toBe(FIXTURE_TOTAL_SEC);
  });
});

describe("parseMegastudyHtml — 인라인 HTML", () => {
  it("강좌정보 표가 아닌 강의목차 표를 읽는다", () => {
    const c = parseMegastudyHtml(pageHtml([row("1강", "10:00")]), COURSE_URL, "1");
    expect(c.items.filter((i) => i.level === 1).map((i) => i.title)).toEqual(["1강"]);
    expect(c.instructor).toBe("홍길동");
  });

  it("시간 `-`·빈 값·0은 null", () => {
    const c = parseMegastudyHtml(pageHtml([row("a", "-"), row("b", ""), row("c", "00:00")]), COURSE_URL, "1");
    expect(c.items.filter((i) => i.level === 1).map((i) => i.durationSec)).toEqual([null, null, null]);
  });

  it("H:MM:SS → 초", () => {
    const c = parseMegastudyHtml(pageHtml([row("a", "1:02:03")]), COURSE_URL, "1");
    expect(c.items[1].durationSec).toBe(3723);
  });

  it("태그 제거·공백 정리·엔티티 디코딩", () => {
    const c = parseMegastudyHtml(
      pageHtml([row("  <b>A&amp;B</b>\n  &lt;심화&gt; &quot;x&quot; &#39;y&#39; ", "10:00")], { title: " R&amp;D  강의 " }),
      COURSE_URL,
      "1",
    );
    expect(c.items[1].title).toBe(`A&B <심화> "x" 'y'`);
    expect(c.title).toBe("R&D 강의");
  });

  it("숫자 엔티티(10진·16진)를 디코딩하고 이중 인코딩·범위 밖 값은 그대로 둔다", () => {
    const c = parseMegastudyHtml(
      pageHtml([row("&#91;수능특강&#93; &#x41;&#X42; &amp;#91; &#1114112;", "10:00")], {
        title: "&#91;수능특강&#93; 수능 중국어",
      }),
      COURSE_URL,
      "1",
    );
    expect(c.title).toBe("[수능특강] 수능 중국어");
    expect(c.items[1].title).toBe("[수능특강] AB &#91; &#1114112;");
  });

  it("수업명이 빈 행은 버리고 순번은 남은 행 기준 0부터", () => {
    const c = parseMegastudyHtml(pageHtml([row(" ", "10:00"), row("a", "10:00"), row("b", "05:00")]), COURSE_URL, "7");
    const lectures = c.items.filter((i) => i.level === 1);
    expect(lectures.map((l) => l.title)).toEqual(["a", "b"]);
    expect(lectures.map((l) => l.order)).toEqual([1, 2]);
  });

  it("강의명·강사가 없으면 기본값", () => {
    const html = pageHtml([row("a", "10:00")])
      .replace(/<p class="lstedu_bookinfo--tit">[\s\S]*?<\/p>/, "")
      .replace(/<p class="lstedu_bookinfo--teacher">[\s\S]*?<\/p>/, "");
    const c = parseMegastudyHtml(html, COURSE_URL, "1");
    expect(c.title).toBe("제목 없는 강의");
    expect(c.instructor).toBeNull();
  });

  it("표 없음 + `| 404` → NOT_FOUND", () => {
    expectCode(() => parseMegastudyHtml("<html><title>메가스터디 | 404</title></html>", COURSE_URL, "1"), "NOT_FOUND");
  });

  it("표 없음 → NO_CURRICULUM", () => {
    expectCode(() => parseMegastudyHtml("<html><body>점검 중</body></html>", COURSE_URL, "1"), "NO_CURRICULUM");
  });

  it("빈 tbody → NO_CURRICULUM", () => {
    expectCode(() => parseMegastudyHtml(pageHtml([]), COURSE_URL, "1"), "NO_CURRICULUM");
  });
});

describe("fetchMegastudyCurriculum", () => {
  it("EUC-KR 응답 바이트를 디코딩해 파싱한다", async () => {
    const fetchImpl = vi.fn(async () => new Response(FIXTURE_BYTES, { status: 200 }));
    const c = await fetchMegastudyCurriculum(new URL(COURSE_URL), fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(c.title).toBe("중국어 어휘 폭풍성장");
    expect(c.items.filter((i) => i.level === 1)).toHaveLength(21);
  });

  it("CHR_CD가 없으면 요청하지 않고 UNSUPPORTED", async () => {
    const fetchImpl = vi.fn();
    await expectCodeAsync(
      fetchMegastudyCurriculum(
        new URL("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp"),
        fetchImpl as unknown as typeof fetch,
      ),
      "UNSUPPORTED",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
