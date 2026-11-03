import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import { ExtractError } from "./errors";
import { fetchPage } from "./fetch-page";
import { isAllowedHost, isFastcampusCoursePath } from "./url";

const DEFAULT_TITLE = "제목 없는 강의";
/** `self.__next_f.push([1,"..."])`의 두 번째 원소(JS 문자열 리터럴) */
const NEXT_F_CHUNK = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
const CURRICULUM_KEY = '"curriculum":';
const COURSE_ID = /"courseId":(\d+)/;
const TIME = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;
const SITE_SUFFIX = /\s*\|\s*패스트캠퍼스\s*$/;

// ───────────── 요청 ─────────────

export async function fetchFastcampusCurriculum(
  url: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Curriculum> {
  const { html } = await fetchPage(url, {
    isRequestable: (u) => isAllowedHost(u) && isFastcampusCoursePath(u),
    fetchImpl,
  });
  return parseFastcampusHtml(html, url.href);
}

// ───────────── 파싱 ─────────────

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function idOf(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v !== "") return v;
  return null;
}

function textOf(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function childrenOf(node: Obj): unknown[] {
  return Array.isArray(node.child) ? node.child : [];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** RSC payload: 각 조각의 문자열 리터럴을 JSON.parse로 되돌려 순서대로 잇는다. 조각이 손상되면 null */
function rscPayload(html: string): string | null {
  let payload = "";
  for (const match of html.matchAll(NEXT_F_CHUNK)) {
    let piece: unknown;
    try {
      piece = JSON.parse(match[1]);
    } catch {
      return null;
    }
    if (typeof piece !== "string") return null;
    payload += piece;
  }
  return payload;
}

/** `"curriculum":[` 뒤의 배열을 괄호 짝(문자열 안은 무시)으로 잘라 JSON.parse한다. 없거나 손상되면 null */
function extractCurriculumArray(payload: string): unknown[] | null {
  const key = payload.indexOf(`${CURRICULUM_KEY}[`);
  if (key < 0) return null;
  const start = key + CURRICULUM_KEY.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < payload.length; index += 1) {
    const char = payload[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[" || char === "{") depth += 1;
    else if ((char === "]" || char === "}") && --depth === 0) {
      try {
        const parsed: unknown = JSON.parse(payload.slice(start, index + 1));
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** `H:MM:SS` 또는 `MM:SS` → 초. 0이거나 형식이 틀리면 null */
function durationOf(time: unknown): number | null {
  if (typeof time !== "string") return null;
  const match = TIME.exec(time.trim());
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return seconds > 0 ? seconds : null;
}

function lectureOf(clip: Obj, sectionId: string): CurriculumItem | null {
  const id = idOf(clip.id);
  if (id === null) return null;
  return {
    id,
    title: textOf(clip.title),
    level: 1,
    order: 0,
    sectionId,
    durationSec: durationOf(clip.time),
    source: "origin",
    excluded: false,
  };
}

function sectionOf(id: string, title: string): CurriculumItem {
  return { id, title, level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false };
}

function lecturesOf(children: unknown[], sectionId: string): CurriculumItem[] {
  const lectures: CurriculumItem[] = [];
  for (const node of children) {
    if (!isObj(node) || node.type !== "CLIP") continue;
    const lecture = lectureOf(node, sectionId);
    if (lecture) lectures.push(lecture);
  }
  return lectures;
}

function itemsOf(parts: unknown[]): CurriculumItem[] {
  const items: CurriculumItem[] = [];
  for (const part of parts) {
    if (!isObj(part) || part.type !== "PART") continue;
    const partTitle = textOf(part.title);

    // PART 바로 아래 CLIP이 있으면 PART 자체를 섹션으로 쓴다
    const partId = idOf(part.id);
    if (partId !== null) {
      const direct = lecturesOf(childrenOf(part), partId);
      if (direct.length > 0) items.push(sectionOf(partId, partTitle), ...direct);
    }

    for (const chapter of childrenOf(part)) {
      if (!isObj(chapter) || chapter.type !== "CHAPTER") continue;
      const chapterId = idOf(chapter.id);
      if (chapterId === null) continue;
      const lectures = lecturesOf(childrenOf(chapter), chapterId);
      if (lectures.length === 0) continue;
      items.push(sectionOf(chapterId, `${partTitle} · ${textOf(chapter.title)}`), ...lectures);
    }
  }
  items.forEach((item, index) => {
    item.order = index;
  });
  return items;
}

function metaContent(html: string, property: string): string | null {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!new RegExp(`\\bproperty=["']${property}["']`, "i").test(tag)) continue;
    const content = /\bcontent=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (content) return content[1] ?? content[2] ?? "";
  }
  return null;
}

function cleanTitle(raw: string | null): string | null {
  if (raw === null) return null;
  const title = decodeEntities(raw).trim().replace(SITE_SUFFIX, "").trim();
  return title !== "" ? title : null;
}

function titleOf(html: string): string {
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return cleanTitle(metaContent(html, "og:title")) ?? cleanTitle(titleTag ? titleTag[1] : null) ?? DEFAULT_TITLE;
}

export function parseFastcampusHtml(html: string, sourceUrl: string): Curriculum {
  const payload = rscPayload(html);
  if (payload === null) throw new ExtractError("NO_CURRICULUM", "RSC chunk is not a string literal");

  const parts = extractCurriculumArray(payload);
  if (parts === null) throw new ExtractError("NO_CURRICULUM", "curriculum not found");

  const courseId = COURSE_ID.exec(payload);
  if (!courseId) throw new ExtractError("NO_CURRICULUM", "courseId not found");

  const items = itemsOf(parts);
  if (!items.some((item) => item.level === 1)) throw new ExtractError("NO_CURRICULUM", "no clips");

  return {
    title: titleOf(html),
    sourceUrl,
    platform: "fastcampus",
    courseId: `fastcampus:${courseId[1]}`,
    instructor: null, // fixture에서 신뢰할 수 있는 강사 필드를 찾지 못했다
    droppedCount: 0,
    items,
  };
}
