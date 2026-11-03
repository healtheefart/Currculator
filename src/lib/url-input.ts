// 서버 요청 전 클라이언트 검사. src/services/extract/url.ts와 같은 규칙을 작게 다시 구현한다
// (클라이언트 번들에 서버 코드를 넣지 않기 위해 import하지 않는다).

export const SAMPLE_COURSE_URL = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const INFLEARN_HOSTS: readonly string[] = ["www.inflearn.com", "inflearn.com"];
const YOUTUBE_HOSTS: readonly string[] = ["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"];
const FASTCAMPUS_HOSTS: readonly string[] = ["fastcampus.co.kr", "www.fastcampus.co.kr"];
const MEGASTUDY_HOSTS: readonly string[] = ["www.megastudy.net", "megastudy.net"];
const LOCALE_PREFIX = /^\/(en|ja|vi)(?=\/)/;
/** 패스트캠퍼스 강의 경로: 한 단계 `/{slug}` (끝 슬래시 허용) */
const FASTCAMPUS_PATH = /^\/[A-Za-z0-9_-]+\/?$/;
/** 메가스터디 강좌 상세 경로(`/chr/`, `/teacher_v2/chr/`, 강좌 목록 링크 `/lecmain/{메뉴}/chr_detail/` 등) */
const MEGASTUDY_DETAIL_PATH = /^(?:\/[A-Za-z0-9_]+)*\/lecture_detailview\.asp$/i;

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
  // 서버(normalizeInputUrl)와 같이 m.inflearn.com만 www로 바꾼다. 다른 m. 호스트는 그대로 두고 호스트 목록으로 판단한다.
  if (url.hostname === "m.inflearn.com") url.hostname = "www.inflearn.com";
  return url;
}

/** 메가스터디 강의 URL이면 CHR_CD 숫자 문자열, 아니면 null */
function megastudyCode(url: URL): string | null {
  if (!MEGASTUDY_HOSTS.includes(url.hostname)) return null; // 정확히 일치
  if (!MEGASTUDY_DETAIL_PATH.test(url.pathname)) return null;
  const code = url.searchParams.get("CHR_CD");
  return code !== null && /^\d+$/.test(code) ? code : null;
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
  if (FASTCAMPUS_HOSTS.includes(url.hostname)) {
    return FASTCAMPUS_PATH.test(url.pathname) ? null : "UNSUPPORTED";
  }
  if (MEGASTUDY_HOSTS.includes(url.hostname)) {
    return megastudyCode(url) !== null ? null : "UNSUPPORTED";
  }
  if (!INFLEARN_HOSTS.includes(url.hostname)) return "UNSUPPORTED"; // 정확히 일치
  const path = url.pathname.replace(LOCALE_PREFIX, "");
  if (!path.startsWith("/course/")) return "UNSUPPORTED";
  return null;
}

/** URL만으로 알 수 있는 강의 id(저장한 계획의 courseId와 비교). 패스트캠퍼스는 URL에 id가 없어 null */
export function cidFromUrl(raw: string): string | null {
  const url = toUrl(raw);
  if (url === null) return null;
  if (YOUTUBE_HOSTS.includes(url.hostname)) {
    const id = url.searchParams.get("list");
    return id && /^[A-Za-z0-9_-]+$/.test(id) ? `youtube:${id}` : null;
  }
  if (MEGASTUDY_HOSTS.includes(url.hostname)) {
    const code = megastudyCode(url);
    return code === null ? null : `megastudy:${code}`;
  }
  if (FASTCAMPUS_HOSTS.includes(url.hostname)) return null;
  const cid = url.searchParams.get("cid");
  return cid != null && /^\d+$/.test(cid) ? cid : null;
}
