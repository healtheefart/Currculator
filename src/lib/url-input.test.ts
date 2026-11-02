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
  ])("E2 %s → UNSUPPORTED", (raw) => {
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

  it("URL이 아니면 null", () => {
    expect(cidFromUrl("")).toBeNull();
    expect(cidFromUrl("not a url")).toBeNull();
  });
});
