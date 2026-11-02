// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureFetch } from "./fixture-fetch";

const DIR = join(process.cwd(), "tests/fixtures/inflearn");

describe("createFixtureFetch", () => {
  const fixtureFetch = createFixtureFetch(DIR);

  it("pathname 마지막 slug의 fixture를 200으로 돌려주고 url은 요청 URL이다", async () => {
    const href = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";
    const res = await fixtureFetch(new URL(href));
    expect(res.status).toBe(200);
    expect(res.url).toBe(href);
    expect(await res.text()).toContain("__NEXT_DATA__");
  });

  it("문자열 URL과 끝 슬래시도 처리한다", async () => {
    const res = await fixtureFetch("https://www.inflearn.com/en/course/introduction-to-clau/");
    expect(res.status).toBe(200);
  });

  it("fixture가 없으면 404", async () => {
    const res = await fixtureFetch("https://www.inflearn.com/course/no-such-course");
    expect(res.status).toBe(404);
  });

  it("slug에 허용되지 않는 문자가 있으면 파일을 읽지 않고 404", async () => {
    const res = await fixtureFetch("https://www.inflearn.com/course/..%2F..%2Fpackage");
    expect(res.status).toBe(404);
  });
});
