import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** fixture 파일명으로 쓸 수 있는 slug (경로 이동 문자 차단) */
const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;

function hrefOf(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.href;
  if (typeof input === "string") return input;
  return input.url;
}

function withUrl(res: Response, url: string): Response {
  Object.defineProperty(res, "url", { value: url });
  return res;
}

/**
 * EXTRACT_FIXTURES=1용 가짜 fetch. 네트워크 대신 `{dir}/{slug}.html`을 읽는다.
 * slug = 요청 URL pathname의 마지막 조각. 파일이 없으면 404.
 */
export function createFixtureFetch(dir: string): typeof fetch {
  const fixtureFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const href = hrefOf(input);
    const segments = new URL(href).pathname.split("/").filter((s) => s !== "");
    const slug = segments[segments.length - 1] ?? "";
    if (!SAFE_SLUG.test(slug)) return withUrl(new Response(null, { status: 404 }), href);
    try {
      const html = await readFile(join(dir, `${slug}.html`), "utf8");
      return withUrl(
        new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }),
        href,
      );
    } catch {
      return withUrl(new Response(null, { status: 404 }), href);
    }
  };
  return fixtureFetch as typeof fetch;
}
