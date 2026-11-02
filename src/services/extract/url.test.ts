// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALLOWED_HOSTS, isAllowedHost, isInflearnCoursePath, normalizeInputUrl } from "./url";

const EXAMPLE = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";

function accepted(raw: string): boolean {
  const url = normalizeInputUrl(raw);
  if (!url || !isAllowedHost(url)) return false;
  return url.hostname === "inf.run" || isInflearnCoursePath(url);
}

describe("ALLOWED_HOSTS", () => {
  it("인프런 호스트 3개만 담는다", () => {
    expect([...ALLOWED_HOSTS].sort()).toEqual(["inf.run", "inflearn.com", "www.inflearn.com"]);
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
