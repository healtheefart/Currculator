import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FASTCAMPUS_HOSTS, INFLEARN_SITE_HOSTS, MEGASTUDY_HOSTS } from "./url";

/** fixture 파일명으로 쓸 수 있는 slug (경로 이동 문자 차단) */
const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;

interface FixtureFile {
  folder: string;
  slug: string;
  charset: string;
}

function hrefOf(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.href;
  if (typeof input === "string") return input;
  return input.url;
}

function withUrl(res: Response, url: string): Response {
  Object.defineProperty(res, "url", { value: url });
  return res;
}

function lastSegment(url: URL): string {
  const segments = url.pathname.split("/").filter((s) => s !== "");
  return segments[segments.length - 1] ?? "";
}

/** 요청 URL → fixture 위치. 맡는 플랫폼이 아니면 null (호스트는 정확히 일치로 비교) */
function fixtureFileOf(url: URL): FixtureFile | null {
  if (INFLEARN_SITE_HOSTS.includes(url.hostname)) {
    return { folder: "inflearn", slug: lastSegment(url), charset: "utf-8" };
  }
  if (FASTCAMPUS_HOSTS.includes(url.hostname)) {
    return { folder: "fastcampus", slug: lastSegment(url), charset: "utf-8" };
  }
  if (MEGASTUDY_HOSTS.includes(url.hostname)) {
    return { folder: "megastudy", slug: url.searchParams.get("CHR_CD") ?? "", charset: "euc-kr" };
  }
  return null;
}

/**
 * EXTRACT_FIXTURES=1용 가짜 fetch. 네트워크 대신 `{rootDir}/{플랫폼}/{slug}.html`을 읽는다.
 * - 인프런: pathname 마지막 조각, 패스트캠퍼스: `/{slug}`, 메가스터디: `CHR_CD`
 * - YouTube·기타 호스트, 파일 없음 → 404
 * 본문은 바이트 그대로 돌려준다(EUC-KR fixture 보존).
 */
export function createFixtureFetch(rootDir: string): typeof fetch {
  const fixtureFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const href = hrefOf(input);
    const notFound = () => withUrl(new Response(null, { status: 404 }), href);
    const file = fixtureFileOf(new URL(href));
    if (file === null || !SAFE_SLUG.test(file.slug)) return notFound();
    try {
      const bytes = await readFile(join(rootDir, file.folder, `${file.slug}.html`));
      return withUrl(
        new Response(new Uint8Array(bytes), {
          status: 200,
          headers: { "Content-Type": `text/html; charset=${file.charset}` },
        }),
        href,
      );
    } catch {
      return notFound();
    }
  };
  return fixtureFetch as typeof fetch;
}
