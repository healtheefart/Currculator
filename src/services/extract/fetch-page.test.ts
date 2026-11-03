// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ExtractError } from "./errors";
import { fetchPage } from "./fetch-page";
import { FETCH_USER_AGENT, MAX_REDIRECTS } from "./inflearn";

const START = new URL("https://fastcampus.co.kr/course-a");
const ALLOWED_HOSTS = new Set(["fastcampus.co.kr", "www.fastcampus.co.kr", "www.megastudy.net"]);
const isRequestable = (url: URL): boolean => url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function redirect(location: string | null, status = 302): Response {
  const headers = new Headers();
  if (location !== null) headers.set("Location", location);
  return new Response(null, { status, headers });
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function mockFetch(...responses: Array<Response | Error>): FetchMock {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  return fn;
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ExtractError);
  expect((err as ExtractError).code).toBe(code);
}

function calledUrls(fn: FetchMock): string[] {
  return fn.mock.calls.map(([input]) => String(input));
}

describe("fetchPage", () => {
  it("200 응답의 utf-8 본문과 최종 URL을 돌려준다", async () => {
    const fetchImpl = mockFetch(html("<html>안녕 강의</html>"));
    const page = await fetchPage(START, { isRequestable, fetchImpl });
    expect(page.html).toBe("<html>안녕 강의</html>");
    expect(page.finalUrl.href).toBe(START.href);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("헤더(User-Agent, 기본 Accept-Language ko)와 redirect: manual로 요청한다", async () => {
    const fetchImpl = mockFetch(html("ok"));
    await fetchPage(START, { isRequestable, fetchImpl });
    const init = fetchImpl.mock.calls[0][1];
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toEqual({ "User-Agent": FETCH_USER_AGENT, "Accept-Language": "ko" });
  });

  it("acceptLanguage 옵션을 헤더에 쓴다", async () => {
    const fetchImpl = mockFetch(html("ok"));
    await fetchPage(START, { isRequestable, fetchImpl, acceptLanguage: "ko-KR" });
    const headers = fetchImpl.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Accept-Language"]).toBe("ko-KR");
  });

  it("encoding: euc-kr이면 메가스터디 EUC-KR 바이트를 깨지지 않게 디코딩한다", async () => {
    const bytes = readFileSync(join(process.cwd(), "tests/fixtures/megastudy/54549.html"));
    const fetchImpl = mockFetch(new Response(new Uint8Array(bytes), { status: 200 }));
    const page = await fetchPage(
      new URL("https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549"),
      { isRequestable, fetchImpl, encoding: "euc-kr" },
    );
    expect(page.html).toContain("중국어 어휘 폭풍성장");
  });

  it("허용된 리다이렉트 1회를 따라가고 Location을 현재 URL 기준으로 해석한다", async () => {
    const fetchImpl = mockFetch(redirect("/course-b", 301), html("final"));
    const page = await fetchPage(START, { isRequestable, fetchImpl });
    expect(page.html).toBe("final");
    expect(page.finalUrl.href).toBe("https://fastcampus.co.kr/course-b");
    expect(calledUrls(fetchImpl)).toEqual([START.href, "https://fastcampus.co.kr/course-b"]);
  });

  it.each([302, 303, 307, 308])("%i도 리다이렉트로 처리한다", async (status) => {
    const fetchImpl = mockFetch(redirect("https://www.fastcampus.co.kr/course-a", status), html("ok"));
    const page = await fetchPage(START, { isRequestable, fetchImpl });
    expect(page.finalUrl.hostname).toBe("www.fastcampus.co.kr");
  });

  it("허용되지 않은 Location이면 다음 요청 없이 UNSUPPORTED", async () => {
    const fetchImpl = mockFetch(redirect("https://evil.example.com/x"), html("never"));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "UNSUPPORTED");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("isRequestable은 리다이렉트 대상마다 요청 전에 호출된다", async () => {
    const check = vi.fn(isRequestable);
    const fetchImpl = mockFetch(redirect("/course-b"), html("ok"));
    await fetchPage(START, { isRequestable: check, fetchImpl });
    expect(check.mock.calls.map(([u]) => u.href)).toEqual([
      START.href,
      "https://fastcampus.co.kr/course-b",
    ]);
  });

  it("Location이 없으면 FETCH_FAILED", async () => {
    const fetchImpl = mockFetch(redirect(null));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("잘못된 Location이면 FETCH_FAILED", async () => {
    const fetchImpl = mockFetch(redirect("https://["));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
  });

  it("이미 방문한 URL로 돌아오면(루프) FETCH_FAILED", async () => {
    const fetchImpl = mockFetch(redirect("/course-b"), redirect("/course-a"), html("never"));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it(`리다이렉트가 ${MAX_REDIRECTS}회를 넘으면(6회) FETCH_FAILED`, async () => {
    const hops = Array.from({ length: MAX_REDIRECTS + 1 }, (_, i) => redirect(`/hop-${i + 1}`));
    const fetchImpl = mockFetch(...hops, html("never"));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it(`리다이렉트 ${MAX_REDIRECTS}회까지는 따라간다`, async () => {
    const hops = Array.from({ length: MAX_REDIRECTS }, (_, i) => redirect(`/hop-${i + 1}`));
    const fetchImpl = mockFetch(...hops, html("done"));
    const page = await fetchPage(START, { isRequestable, fetchImpl });
    expect(page.html).toBe("done");
  });

  it("404면 NOT_FOUND", async () => {
    const fetchImpl = mockFetch(html("missing", 404));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "NOT_FOUND");
  });

  it("500이면 FETCH_FAILED", async () => {
    const fetchImpl = mockFetch(html("error", 500));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
  });

  it("fetch가 reject되면 FETCH_FAILED로 감싼다", async () => {
    const fetchImpl = mockFetch(new TypeError("network down"));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
  });

  it("abort(타임아웃) 예외도 FETCH_FAILED로 감싼다", async () => {
    const fetchImpl = mockFetch(new DOMException("timed out", "TimeoutError"));
    await expectCode(fetchPage(START, { isRequestable, fetchImpl }), "FETCH_FAILED");
  });

  it("첫 URL이 불허면 fetch를 한 번도 부르지 않고 UNSUPPORTED", async () => {
    const fetchImpl = mockFetch(html("never"));
    await expectCode(
      fetchPage(new URL("https://evil.example.com/"), { isRequestable, fetchImpl }),
      "UNSUPPORTED",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("모든 호출의 init에 redirect: manual과 같은 signal 객체가 들어 있다", async () => {
    const fetchImpl = mockFetch(redirect("/course-b"), redirect("/course-c"), html("ok"));
    await fetchPage(START, { isRequestable, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const inits = fetchImpl.mock.calls.map(([, init]) => init);
    const signal = inits[0]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    for (const init of inits) {
      expect(init?.redirect).toBe("manual");
      expect(init?.signal).toBe(signal);
    }
  });
});
