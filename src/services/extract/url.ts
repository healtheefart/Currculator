/** 서버가 요청할 수 있는 호스트. hostname은 정확히 일치로만 비교한다. */
export const ALLOWED_HOSTS: readonly string[] = ["www.inflearn.com", "inflearn.com", "inf.run", "www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"];

const INFLEARN_HOSTS: readonly string[] = ["www.inflearn.com", "inflearn.com"];

/** `/course/{slug}` 또는 `/{2글자 locale}/course/{slug}` (끝 슬래시 허용) */
const COURSE_PATH = /^\/(?:[a-z]{2}\/)?course\/[^/]+\/?$/;

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** 사용자 입력 URL을 정규화한다. URL로 해석할 수 없으면 null. 허용 여부는 판단하지 않는다. */
export function normalizeInputUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.hostname === "") return null;
  if (url.hostname === "m.inflearn.com") url.hostname = "www.inflearn.com";
  url.hash = "";
  return url;
}

export function isAllowedHost(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    ALLOWED_HOSTS.includes(url.hostname) // 배열 원소와 정확히 일치
  );
}

export function isInflearnCoursePath(url: URL): boolean {
  return INFLEARN_HOSTS.includes(url.hostname) && COURSE_PATH.test(url.pathname);
}

const YOUTUBE_HOSTS: readonly string[] = ["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"];

export function isYouTubePlaylistUrl(url: URL): boolean {
  const id = url.searchParams.get("list") ?? "";
  return YOUTUBE_HOSTS.includes(url.hostname) && url.pathname === "/playlist" && /^[A-Za-z0-9_-]+$/.test(id);
}
