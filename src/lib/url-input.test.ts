import { describe, expect, it } from "vitest";
import { SAMPLE_COURSE_URL, checkCourseUrl, cidFromUrl } from "./url-input";

describe("SAMPLE_COURSE_URL", () => {
  it("예시 강의 주소", () => {
    expect(SAMPLE_COURSE_URL).toBe("https://www.inflearn.com/course/introduction-to-clau?cid=344799");
  });
});

describe("checkCourseUrl", () => {
  it.each([
    SAMPLE_COURSE_URL,
    "https://inflearn.com/course/x",
    "www.inflearn.com/course/introduction-to-clau",
    `   ${SAMPLE_COURSE_URL}  `,
    "https://m.inflearn.com/course/x",
    "https://inf.run/abcd",
    "inf.run/abcd",
    "https://www.inflearn.com/en/course/x",
    "https://www.inflearn.com/ja/course/x",
    "https://www.inflearn.com/vi/course/x#curriculum",
    "http://www.inflearn.com/course/x",
    "https://fastcampus.co.kr/dev_online_react",
    "https://www.fastcampus.co.kr/dev_online_react",
    "fastcampus.co.kr/dev_online_react/",
    "https://www.fastcampus.co.kr/dev_online_react#curriculum",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12345",
    "https://megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12345",
    "https://www.megastudy.net/chr/lecture_detailview.asp?CHR_CD=12345",
    "https://www.megastudy.net/Teacher_V2/CHR/Lecture_DetailView.asp?CHR_CD=12345",
    "www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?tec_cd=a&CHR_CD=7",
    "https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic",
    "https://www.megastudy.net/lecmain/mainh/chr_detail/lecture_detailview.asp?CHR_CD=1",
  ])("허용: %s → null", (raw) => {
    expect(checkCourseUrl(raw)).toBeNull();
  });

  it.each([
    "",
    "   ",
    "not a url",
    "localhost",
    "https://localhost/course/x",
    "ftp://www.inflearn.com/course/x",
  ])("E1 %j → INVALID_URL", (raw) => {
    expect(checkCourseUrl(raw)).toBe("INVALID_URL");
  });

  it.each([
    "https://www.udemy.com/course/x",
    "https://inflearn.com.evil.com/course/x",
    "https://evilinflearn.com/course/x",
    "https://www.inflearn.com/roadmaps/1",
    "https://www.inflearn.com/",
    "https://www.inflearn.com/fr/course/x",
    "https://fastcampus.co.kr/",
    "https://fastcampus.co.kr/category/dev",
    "https://www.fastcampus.co.kr/a/b",
    "https://fastcampus.co.kr.evil.com/x",
    "https://evilfastcampus.co.kr/x",
    "https://online.fastcampus.co.kr/x",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=abc",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12a",
    "https://www.megastudy.net/teacher_v2/chr/other.asp?CHR_CD=12345",
    "https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp",
    "https://www.megastudy.net/a.b/lecture_detailview.asp?CHR_CD=1",
    "https://www.megastudy.net/",
    "https://megastudy.net.evil.com/teacher_v2/chr/lecture_detailview.asp?CHR_CD=1",
    "https://mbest.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=1",
  ])("E2 %s → UNSUPPORTED", (raw) => {
    expect(checkCourseUrl(raw)).toBe("UNSUPPORTED");
  });
});

describe("checkCourseUrl: m. 접두", () => {
  it("m.inflearn.com은 www로 바꿔 허용", () => {
    expect(checkCourseUrl("https://m.inflearn.com/course/x")).toBeNull();
  });

  it("m.youtube.com 재생목록은 허용", () => {
    expect(checkCourseUrl("https://m.youtube.com/playlist?list=PL123")).toBeNull();
  });

  it.each([
    "https://m.fastcampus.co.kr/dev_online_react",
    "https://m.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12345",
  ])("새 호스트의 m.은 www로 바꾸지 않아 UNSUPPORTED: %s", (raw) => {
    expect(checkCourseUrl(raw)).toBe("UNSUPPORTED");
  });
});

describe("cidFromUrl", () => {
  it("숫자 cid를 꺼낸다", () => {
    expect(cidFromUrl(SAMPLE_COURSE_URL)).toBe("344799");
    expect(cidFromUrl(" www.inflearn.com/course/x?utm=a&cid=12 ")).toBe("12");
  });

  it("cid가 없거나 숫자가 아니면 null", () => {
    expect(cidFromUrl("https://www.inflearn.com/course/x")).toBeNull();
    expect(cidFromUrl("https://www.inflearn.com/course/x?cid=abc")).toBeNull();
    expect(cidFromUrl("https://www.inflearn.com/course/x?cid=12a")).toBeNull();
    expect(cidFromUrl("https://www.inflearn.com/course/x?cid=")).toBeNull();
  });

  it("메가스터디면 megastudy:{CHR_CD}", () => {
    expect(cidFromUrl("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12345")).toBe(
      "megastudy:12345",
    );
    expect(cidFromUrl("megastudy.net/chr/lecture_detailview.asp?CHR_CD=7")).toBe("megastudy:7");
    expect(
      cidFromUrl("https://www.megastudy.net/lecmain/mains/chr_detail/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1"),
    ).toBe("megastudy:54549");
    expect(cidFromUrl("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=abc")).toBeNull();
    expect(cidFromUrl("https://www.megastudy.net/teacher_v2/chr/other.asp?CHR_CD=12345")).toBeNull();
    expect(cidFromUrl("https://m.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=12345")).toBeNull();
  });

  it("패스트캠퍼스는 URL에 강의 id가 없으므로 null", () => {
    expect(cidFromUrl("https://fastcampus.co.kr/dev_online_react")).toBeNull();
    expect(cidFromUrl("https://www.fastcampus.co.kr/dev_online_react?cid=12")).toBeNull();
  });

  it("URL이 아니면 null", () => {
    expect(cidFromUrl("")).toBeNull();
    expect(cidFromUrl("not a url")).toBeNull();
  });
});
