import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import { ExtractError } from "./errors";
import { isAllowedHost, isInflearnCoursePath } from "./url";

export const FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CURRICULUM_KEY = /\/courses\/(\d+)\/curriculum/;
const INFO_KEY = /\/course\/\d+\/online\/info/;
const NEXT_DATA_SCRIPT = /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const DEFAULT_TITLE = "제목 없는 강의";

/** Inflearn selects localized course data from the path, even when the request prefers Korean. */
function koreanCourseUrl(url: URL): URL {
  const localized = new URL(url.href);
  localized.pathname = localized.pathname.replace(/^\/[a-z]{2}(?=\/course\/)/, "");
  return localized;
}

// ───────────── 요청 ─────────────

/** 요청해도 되는 URL인가: 허용 호스트 + (인프런 호스트면) 강의 경로. inf.run은 단축 링크 경로를 허용한다. */
function isRequestable(url: URL): boolean {
  if (!isAllowedHost(url)) return false;
  return url.hostname === "inf.run" || isInflearnCoursePath(url);
}

async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // 본문 정리 실패는 무시한다
  }
}

export async function fetchInflearnCurriculum(
  url: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Curriculum> {
  if (!isRequestable(url)) throw new ExtractError("UNSUPPORTED");

  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS); // 모든 홉이 공유한다
  const init: RequestInit = {
    headers: { "User-Agent": FETCH_USER_AGENT, "Accept-Language": "ko" },
    redirect: "manual",
    signal,
  };

  let current = koreanCourseUrl(url);
  const visited = new Set<string>([current.href]);
  let redirects = 0;

  try {
    for (;;) {
      const res = await fetchImpl(current, init);

      if (REDIRECT_STATUSES.has(res.status)) {
        await discardBody(res);
        if (redirects >= MAX_REDIRECTS) throw new ExtractError("FETCH_FAILED", "too many redirects");
        const location = res.headers.get("Location");
        if (!location) throw new ExtractError("FETCH_FAILED", "missing Location");
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new ExtractError("FETCH_FAILED", "invalid Location");
        }
        if (!isRequestable(next)) throw new ExtractError("UNSUPPORTED");
        next = koreanCourseUrl(next);
        if (visited.has(next.href)) throw new ExtractError("FETCH_FAILED", "redirect loop");
        visited.add(next.href);
        redirects += 1;
        current = next;
        continue;
      }

      if (res.status === 404) {
        await discardBody(res);
        throw new ExtractError("NOT_FOUND");
      }
      if (res.status < 200 || res.status > 299) {
        await discardBody(res);
        throw new ExtractError("FETCH_FAILED", `HTTP ${res.status}`);
      }
      if (!isInflearnCoursePath(current)) {
        await discardBody(res);
        throw new ExtractError("UNSUPPORTED");
      }

      const html = await res.text();
      return parseInflearnHtml(html, url.href);
    }
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    throw new ExtractError("FETCH_FAILED", err instanceof Error ? err.message : String(err));
  }
}

// ───────────── 파싱 ─────────────

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function get(v: unknown, ...path: string[]): unknown {
  let cur = v;
  for (const key of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function idOf(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v !== "") return v;
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function ogTitle(html: string): string | null {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/\bproperty=["']og:title["']/i.test(tag)) continue;
    const content = /\bcontent=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (!content) continue;
    const title = decodeEntities(content[1] ?? content[2] ?? "").split("|")[0].trim();
    if (title !== "") return title;
  }
  return null;
}

function findQuery(queries: unknown[], pattern: RegExp): { query: Obj; match: RegExpExecArray } | null {
  for (const q of queries) {
    if (!isObj(q)) continue;
    const key = JSON.stringify(q.queryKey ?? null);
    const match = pattern.exec(key);
    if (match) return { query: q, match };
  }
  return null;
}

export function parseInflearnHtml(html: string, sourceUrl: string): Curriculum {
  const script = NEXT_DATA_SCRIPT.exec(html);
  if (!script) throw new ExtractError("NO_CURRICULUM", "__NEXT_DATA__ not found");

  let data: unknown;
  try {
    data = JSON.parse(script[1]);
  } catch {
    throw new ExtractError("NO_CURRICULUM", "__NEXT_DATA__ is not JSON");
  }

  const queries = get(data, "props", "pageProps", "dehydratedState", "queries");
  if (!Array.isArray(queries)) throw new ExtractError("NO_CURRICULUM", "queries not found");

  const found = findQuery(queries, CURRICULUM_KEY);
  const sections = found ? get(found.query, "state", "data", "data", "curriculum") : undefined;
  if (!found || !Array.isArray(sections)) {
    throw new ExtractError("NO_CURRICULUM", "curriculum query not found");
  }
  const courseId = found.match[1];

  const items: CurriculumItem[] = [];
  let droppedCount = 0;
  for (const section of sections) {
    if (!isObj(section)) continue;
    const sectionId = idOf(section.id);
    if (sectionId === null) continue;
    const lectures: CurriculumItem[] = [];
    for (const unit of Array.isArray(section.units) ? section.units : []) {
      if (!isObj(unit)) continue;
      if (unit.type !== "LECTURE") {
        droppedCount += 1;
        continue;
      }
      const unitId = idOf(unit.id);
      if (unitId === null) continue;
      const runtime = unit.runtime;
      lectures.push({
        id: unitId,
        title: typeof unit.title === "string" ? unit.title : "",
        level: 1,
        order: 0,
        sectionId,
        durationSec: typeof runtime === "number" && Number.isFinite(runtime) && runtime > 0 ? runtime : null,
        source: "origin",
        excluded: false,
      });
    }
    if (lectures.length === 0) continue;
    items.push(
      {
        id: sectionId,
        title: typeof section.title === "string" ? section.title : "",
        level: 0,
        order: 0,
        sectionId: null,
        durationSec: null,
        source: "origin",
        excluded: false,
      },
      ...lectures,
    );
  }
  if (items.length === 0) throw new ExtractError("NO_CURRICULUM", "no lectures");
  items.forEach((item, index) => {
    item.order = index;
  });

  const info = findQuery(queries, INFO_KEY);
  const infoData = info ? get(info.query, "state", "data", "data") : undefined;
  const infoTitle = get(infoData, "title");
  const title =
    (typeof infoTitle === "string" && infoTitle.trim() !== "" ? infoTitle.trim() : null) ??
    ogTitle(html) ??
    DEFAULT_TITLE;

  const instructorsRaw = get(infoData, "instructors");
  const names = Array.isArray(instructorsRaw)
    ? instructorsRaw
        .map((i) => get(i, "name"))
        .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    : [];

  return {
    title,
    sourceUrl,
    platform: "inflearn",
    courseId,
    instructor: names.length > 0 ? names.join(", ") : null,
    droppedCount,
    items,
  };
}
