// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureFetch } from "./fixture-fetch";

const ROOT = join(process.cwd(), "tests/fixtures");

describe("createFixtureFetch", () => {
  const fixtureFetch = createFixtureFetch(ROOT);

  it("인프런: pathname 마지막 slug의 fixture를 200으로 돌려주고 url은 요청 URL이다", async () => {
    const href = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";
    const res = await fixtureFetch(new URL(href));
    expect(res.status).toBe(200);
    expect(res.url).toBe(href);
    expect(await res.text()).toContain("__NEXT_DATA__");
  });

  it("인프런: 문자열 URL과 끝 슬래시도 처리한다", async () => {
    const res = await fixtureFetch("https://www.inflearn.com/en/course/introduction-to-clau/");
    expect(res.status).toBe(200);
  });

  it("인프런: fixture가 없으면 404", async () => {
    const res = await fixtureFetch("https://www.inflearn.com/course/no-such-course");
    expect(res.status).toBe(404);
  });

  it("패스트캠퍼스: fastcampus/{slug}.html을 읽는다", async () => {
    for (const host of ["fastcampus.co.kr", "www.fastcampus.co.kr"]) {
      const res = await fixtureFetch(`https://${host}/biz_online_claude`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("self.__next_f");
    }
  });

  it("메가스터디: megastudy/{CHR_CD}.html을 바이트 그대로 euc-kr로 돌려준다", async () => {
    const res = await fixtureFetch(
      "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("euc-kr");
    const text = new TextDecoder("euc-kr").decode(await res.arrayBuffer());
    expect(text).toContain("중국어 어휘 폭풍성장");
  });

  it("메가스터디: CHR_CD가 없거나 fixture가 없으면 404", async () => {
    expect(
      (await fixtureFetch("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp")).status,
    ).toBe(404);
    expect(
      (await fixtureFetch("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=1"))
        .status,
    ).toBe(404);
  });

  it("YouTube·기타 호스트는 404", async () => {
    expect((await fixtureFetch("https://www.youtube.com/playlist?list=PLx")).status).toBe(404);
    expect((await fixtureFetch("https://example.com/introduction-to-clau")).status).toBe(404);
  });

  it.each([
    "https://www.inflearn.com/course/..%2F..%2Fpackage",
    "https://fastcampus.co.kr/..%2Finflearn%2Fintroduction-to-clau",
    "https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=../inflearn/introduction-to-clau",
  ])("경로 이동 문자가 있으면 파일을 읽지 않고 404: %s", async (href) => {
    const res = await fixtureFetch(href);
    expect(res.status).toBe(404);
  });
});
