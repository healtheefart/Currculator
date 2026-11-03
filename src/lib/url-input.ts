// 서버 요청 전 클라이언트 검사. src/services/extract/url.ts와 같은 규칙을 작게 다시 구현한다
// (클라이언트 번들에 서버 코드를 넣지 않기 위해 import하지 않는다).

export const SAMPLE_COURSE_URL = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const INFLEARN_HOSTS: readonly string[] = ["www.inflearn.com", "inflearn.com"];
const YOUTUBE_HOSTS: readonly string[] = ["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"];
const LOCALE_PREFIX = /^\/(en|ja|vi)(?=\/)/;

function toUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  if (url.hostname.startsWith("m.")) url.hostname = `www.${url.hostname.slice(2)}`;
  return url;
}

export function checkCourseUrl(raw: string): "INVALID_URL" | "UNSUPPORTED" | null {
  const url = toUrl(raw);
  if (url === null) return "INVALID_URL";
  if (url.hostname === "inf.run") return null;
  if (YOUTUBE_HOSTS.includes(url.hostname)) {
    return url.pathname === "/playlist" && /^[A-Za-z0-9_-]+$/.test(url.searchParams.get("list") ?? "")
      ? null
      : "UNSUPPORTED";
  }
  if (!INFLEARN_HOSTS.includes(url.hostname)) return "UNSUPPORTED"; // 정확히 일치
  const path = url.pathname.replace(LOCALE_PREFIX, "");
  if (!path.startsWith("/course/")) return "UNSUPPORTED";
  return null;
}

export function cidFromUrl(raw: string): string | null {
  const url = toUrl(raw);
  if (url && YOUTUBE_HOSTS.includes(url.hostname)) {
    const id = url.searchParams.get("list");
    return id && /^[A-Za-z0-9_-]+$/.test(id) ? `youtube:${id}` : null;
  }
  const cid = url?.searchParams.get("cid");
  return cid != null && /^\d+$/.test(cid) ? cid : null;
}
