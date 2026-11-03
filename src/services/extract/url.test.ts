// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ALLOWED_HOSTS,
  isAllowedHost,
  isFastcampusCoursePath,
  isInflearnCoursePath,
  isMegastudyCoursePath,
  megastudyCourseCode,
  normalizeInputUrl,
} from "./url";

const EXAMPLE = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";

function accepted(raw: string): boolean {
  const url = normalizeInputUrl(raw);
  if (!url || !isAllowedHost(url)) return false;
  return url.hostname === "inf.run" || isInflearnCoursePath(url);
}

describe("ALLOWED_HOSTS", () => {
  it("인프런 3개·YouTube 4개·패스트캠퍼스 2개·메가스터디 2개 호스트만 담는다", () => {
    expect([...ALLOWED_HOSTS].sort()).toEqual([
      "fastcampus.co.kr",
      "inf.run",
      "inflearn.com",
      "m.youtube.com",
      "megastudy.net",
      "music.youtube.com",
      "www.fastcampus.co.kr",
      "www.inflearn.com",
      "www.megastudy.net",
      "www.youtube.com",
      "youtube.com",
    ]);
  });
});

describe("normalizeInputUrl", () => {
  it("해시를 지우고 쿼리는 유지한다", () => {
    const url = normalizeInputUrl(`${EXAMPLE}#curriculum`);
    expect(url?.href).toBe(EXAMPLE);
  });

  it("앞뒤 공백을 지운다", () => {
    expect(normalizeInputUrl(`  ${EXAMPLE}\n `)?.href).toBe(EXAMPLE);
  });

  it("scheme이 없으면 https://를 붙인다", () => {
    expect(normalizeInputUrl("www.inflearn.com/course/introduction-to-clau")?.href).toBe(
      "https://www.inflearn.com/course/introduction-to-clau",
    );
  });

  it("m.inflearn.com은 www.inflearn.com으로 바꾼다", () => {
    expect(normalizeInputUrl("https://m.inflearn.com/course/abc?cid=1")?.href).toBe(
      "https://www.inflearn.com/course/abc?cid=1",
    );
  });

  it("http scheme은 그대로 둔다(허용 여부는 isAllowedHost가 판단)", () => {
    expect(normalizeInputUrl("http://www.inflearn.com/course/abc")?.protocol).toBe("http:");
  });

  it("빈 문자열·공백·URL이 아닌 값은 null", () => {
    expect(normalizeInputUrl("")).toBeNull();
    expect(normalizeInputUrl("   ")).toBeNull();
    expect(normalizeInputUrl("https://")).toBeNull();
    expect(normalizeInputUrl("http://exa mple.com")).toBeNull();
  });
});

describe("isAllowedHost", () => {
  it.each([
    "https://www.inflearn.com/course/abc",
    "https://inflearn.com/course/abc",
    "https://inf.run/abc",
  ])("허용: %s", (raw) => {
    expect(isAllowedHost(new URL(raw))).toBe(true);
  });

  it.each([
    "http://www.inflearn.com/course/abc",
    "https://inflearn.com.evil.com/course/abc",
    "https://www.inflearn.com@evil.com/course/abc",
    "https://evil.com/inflearn.com",
    "https://evilinflearn.com/course/abc",
    "https://course-api.inflearn.com/client/api/v2/courses/1/curriculum",
    "https://www.inflearn.com.:443/course/abc",
    "ftp://www.inflearn.com/course/abc",
    "https://www.inflearn.com:8443/course/abc",
    "https://user:pw@www.inflearn.com/course/abc",
  ])("거부: %s", (raw) => {
    expect(isAllowedHost(new URL(raw))).toBe(false);
  });
});

describe("isInflearnCoursePath", () => {
  it.each([
    "https://www.inflearn.com/course/introduction-to-clau?cid=344799",
    "https://inflearn.com/course/introduction-to-clau",
    "https://www.inflearn.com/en/course/introduction-to-clau?cid=344799",
    "https://www.inflearn.com/ja/course/introduction-to-clau",
    "https://www.inflearn.com/vi/course/introduction-to-clau/",
    "https://www.inflearn.com/course/%ED%81%B4%EB%A1%9C%EB%93%9C",
  ])("강의 경로: %s", (raw) => {
    expect(isInflearnCoursePath(new URL(raw))).toBe(true);
  });

  it.each([
    "https://www.inflearn.com/roadmaps/1",
    "https://www.inflearn.com/course/",
    "https://www.inflearn.com/courses",
    "https://www.inflearn.com/",
    "https://www.inflearn.com/api/course/abc",
    "https://www.inflearn.com/client/api/v2/courses/1/curriculum",
    "https://www.inflearn.com/eng/course/abc",
    "https://www.inflearn.com/course/abc/lecture/1",
    "https://inf.run/course/abc",
    "https://evil.com/course/abc",
  ])("강의 경로 아님: %s", (raw) => {
    expect(isInflearnCoursePath(new URL(raw))).toBe(false);
  });
});

describe("입력 URL 전체 검사 (normalize → host → path)", () => {
  it.each([
    `${EXAMPLE}#curriculum`,
    "https://www.inflearn.com/en/course/introduction-to-clau?cid=344799",
    "www.inflearn.com/course/introduction-to-clau",
    `   ${EXAMPLE}   `,
    "m.inflearn.com/course/introduction-to-clau",
    "https://inf.run/abc",
  ])("허용: %s", (raw) => {
    expect(accepted(raw)).toBe(true);
  });

  it.each([
    "http://www.inflearn.com/course/introduction-to-clau",
    "https://inflearn.com.evil.com/course/introduction-to-clau",
    "https://www.inflearn.com@evil.com/course/introduction-to-clau",
    "https://evil.com/inflearn.com",
    "https://www.inflearn.com/roadmaps/1",
    "",
  ])("거부: %s", (raw) => {
    expect(accepted(raw)).toBe(false);
  });
});

const MEGA = "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic";

describe("normalizeInputUrl (패스트캠퍼스·메가스터디)", () => {
  it("megastudy.net은 www.megastudy.net으로 바꾼다", () => {
    expect(normalizeInputUrl("megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549")?.href).toBe(
      "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549",
    );
  });

  it("메가스터디 /chr/lecture_detailview.asp는 /teacher_v2/chr/ 경로로 바꾼다(대소문자 무시)", () => {
    expect(
      normalizeInputUrl("https://www.megastudy.net/chr/lecture_detailview.asp?CHR_CD=54549&tec_cd=21cholic")?.href,
    ).toBe("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549&tec_cd=21cholic");
    expect(normalizeInputUrl("https://www.megastudy.net/CHR/Lecture_DetailView.asp?CHR_CD=1")?.pathname).toBe(
      "/teacher_v2/chr/lecture_detailview.asp",
    );
  });

  it("메가스터디 강좌 목록 링크(/lecmain/.../chr_detail/)도 /teacher_v2/chr/ 경로로 바꾼다", () => {
    expect(
      normalizeInputUrl(
        "https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic",
      )?.href,
    ).toBe("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic");
    expect(
      normalizeInputUrl("https://www.megastudy.net/lecmain/mainh/chr_detail/lecture_detailview.asp?CHR_CD=1")?.pathname,
    ).toBe("/teacher_v2/chr/lecture_detailview.asp");
  });

  it("lecture_detailview.asp가 아닌 메가스터디 경로는 바꾸지 않는다", () => {
    expect(normalizeInputUrl("https://www.megastudy.net/lecmain/mains/chr_detail/other.asp?CHR_CD=1")?.pathname).toBe(
      "/lecmain/mains/chr_detail/other.asp",
    );
    expect(normalizeInputUrl("https://www.megastudy.net/a.b/lecture_detailview.asp?CHR_CD=1")?.pathname).toBe(
      "/a.b/lecture_detailview.asp",
    );
  });

  it("다른 호스트의 /chr/ 경로는 바꾸지 않는다", () => {
    expect(normalizeInputUrl("https://evil.com/chr/lecture_detailview.asp?CHR_CD=1")?.pathname).toBe(
      "/chr/lecture_detailview.asp",
    );
  });
});

describe("isFastcampusCoursePath", () => {
  it.each([
    "https://fastcampus.co.kr/biz_online_claude",
    "https://www.fastcampus.co.kr/biz_online_claude/",
    "https://fastcampus.co.kr/data-online_ai-1",
  ])("강의 경로: %s", (raw) => {
    expect(isFastcampusCoursePath(new URL(raw))).toBe(true);
  });

  it.each([
    "https://fastcampus.co.kr/",
    "https://fastcampus.co.kr/category/x",
    "https://fastcampus.co.kr/biz_online_claude/extra",
    "https://fastcampus.co.kr/%2E%2E",
    "https://evil.com/biz_online_claude",
    "https://fastcampus.co.kr.evil.com/biz_online_claude",
  ])("강의 경로 아님: %s", (raw) => {
    expect(isFastcampusCoursePath(new URL(raw))).toBe(false);
  });
});

describe("isMegastudyCoursePath / megastudyCourseCode", () => {
  it("허용 경로와 CHR_CD", () => {
    const url = new URL(MEGA);
    expect(isMegastudyCoursePath(url)).toBe(true);
    expect(megastudyCourseCode(url)).toBe("54549");
  });

  it("경로는 대소문자를 무시한다", () => {
    expect(
      isMegastudyCoursePath(new URL("https://www.megastudy.net/Teacher_v2/CHR/Lecture_DetailView.asp?CHR_CD=1")),
    ).toBe(true);
  });

  it.each([
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?MAKE_FLG=1",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=abc",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=",
    "https://www.megastudy.net/chr/lecture_detailview.asp?CHR_CD=54549",
    "https://www.megastudy.net/teacher_v2/index.asp?CHR_CD=54549",
    "https://megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549",
    "https://evil.com/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549",
  ])("거부: %s", (raw) => {
    expect(isMegastudyCoursePath(new URL(raw))).toBe(false);
  });

  it.each([
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=abc",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12a",
  ])("CHR_CD가 숫자가 아니면 null: %s", (raw) => {
    expect(megastudyCourseCode(new URL(raw))).toBeNull();
  });
});

describe("패스트캠퍼스·메가스터디 입력 URL 전체 검사", () => {
  function acceptedCourse(raw: string): boolean {
    const url = normalizeInputUrl(raw);
    if (!url || !isAllowedHost(url)) return false;
    return isFastcampusCoursePath(url) || isMegastudyCoursePath(url);
  }

  it.each([
    "https://fastcampus.co.kr/biz_online_claude",
    "www.fastcampus.co.kr/biz_online_claude/",
    MEGA,
    "https://www.megastudy.net/chr/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic",
    "megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549",
    "https://megastudy.net/chr/lecture_detailview.asp?CHR_CD=54549",
    "https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic",
  ])("허용: %s", (raw) => {
    expect(acceptedCourse(raw)).toBe(true);
  });

  it.each([
    "https://fastcampus.co.kr/",
    "https://fastcampus.co.kr/category/x",
    "https://fastcampus.co.kr/biz_online_claude/extra",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?MAKE_FLG=1",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=abc",
    "https://www.megastudy.net/teacher_v2/index.asp",
    "https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp",
    "https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp?CHR_CD=abc",
    "https://fastcampus.co.kr.evil.com/biz_online_claude",
    "https://www.fastcampus.co.kr@evil.com/x",
    "http://fastcampus.co.kr/x",
    "https://evil.com/www.megastudy.net",
  ])("거부: %s", (raw) => {
    expect(acceptedCourse(raw)).toBe(false);
  });
});
