/** 서버가 요청할 수 있는 호스트. hostname은 정확히 일치로만 비교한다. */
export const ALLOWED_HOSTS: readonly string[] = [
  "www.inflearn.com",
  "inflearn.com",
  "inf.run",
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "fastcampus.co.kr",
  "www.fastcampus.co.kr",
  "www.megastudy.net",
  "megastudy.net",
];

/** 인프런 강의 페이지 호스트(강의 경로 검사용) */
const INFLEARN_HOSTS: readonly string[] = ["www.inflearn.com", "inflearn.com"];

/** 인프런 추출기가 맡는 호스트(단축 링크 inf.run 포함) */
export const INFLEARN_SITE_HOSTS: readonly string[] = [...INFLEARN_HOSTS, "inf.run"];

/** `/course/{slug}` 또는 `/{2글자 locale}/course/{slug}` (끝 슬래시 허용) */
const COURSE_PATH = /^\/(?:[a-z]{2}\/)?course\/[^/]+\/?$/;

export const FASTCAMPUS_HOSTS: readonly string[] = ["fastcampus.co.kr", "www.fastcampus.co.kr"];

/** 패스트캠퍼스 강의 경로: 한 단계 `/{slug}` (끝 슬래시 허용) */
const FASTCAMPUS_PATH = /^\/[A-Za-z0-9_-]+\/?$/;

const MEGASTUDY_HOST = "www.megastudy.net";
/** 메가스터디 추출기가 맡는 호스트(megastudy.net은 정규화에서 www로 바뀐다) */
export const MEGASTUDY_HOSTS: readonly string[] = [MEGASTUDY_HOST];
const MEGASTUDY_SHORT_PATH = "/chr/lecture_detailview.asp";
const MEGASTUDY_COURSE_PATH = "/teacher_v2/chr/lecture_detailview.asp";

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
  if (url.hostname === "megastudy.net") url.hostname = MEGASTUDY_HOST;
  // /chr/ 경로는 HTTP 200으로 오류 페이지를 돌려주므로 /teacher_v2/chr/ 경로로 바꾼다
  if (url.hostname === MEGASTUDY_HOST && url.pathname.toLowerCase() === MEGASTUDY_SHORT_PATH) {
    url.pathname = MEGASTUDY_COURSE_PATH;
  }
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

export const YOUTUBE_HOSTS: readonly string[] = ["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"];

export function isYouTubePlaylistUrl(url: URL): boolean {
  const id = url.searchParams.get("list") ?? "";
  return YOUTUBE_HOSTS.includes(url.hostname) && url.pathname === "/playlist" && /^[A-Za-z0-9_-]+$/.test(id);
}

export function isFastcampusCoursePath(url: URL): boolean {
  return FASTCAMPUS_HOSTS.includes(url.hostname) && FASTCAMPUS_PATH.test(url.pathname);
}

/** 메가스터디 강좌 번호(CHR_CD 숫자 문자열). 숫자가 아니거나 없으면 null */
export function megastudyCourseCode(url: URL): string | null {
  const code = url.searchParams.get("CHR_CD");
  return code !== null && /^\d+$/.test(code) ? code : null;
}

export function isMegastudyCoursePath(url: URL): boolean {
  return (
    url.hostname === MEGASTUDY_HOST &&
    url.pathname.toLowerCase() === MEGASTUDY_COURSE_PATH &&
    megastudyCourseCode(url) !== null
  );
}
