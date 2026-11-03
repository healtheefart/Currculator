import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import { ExtractError } from "./errors";
import { fetchPage } from "./fetch-page";
import { isAllowedHost, isMegastudyCoursePath, megastudyCourseCode } from "./url";

const DEFAULT_TITLE = "제목 없는 강의";
/** 강의목차 제목 바로 뒤의 tb_char_opt 표(다른 속성이 class 앞에 올 수 있다) */
const CURRICULUM_TABLE =
  /<p\s+class="lstedu--subbx_tit"\s*>\s*강의목차\s*<\/p>\s*<table\b[^>]*\bclass="tb_char_opt"[^>]*>([\s\S]*?)<\/table>/i;
const TBODY = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i;
const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const FIRST_TD = /<td\b[^>]*>([\s\S]*?)<\/td>/i;
const TIME_TD = /<td\b[^>]*\bclass="lecture-time"[^>]*>([\s\S]*?)<\/td>/gi;
const TIME = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;
const COURSE_TITLE = /<p\b[^>]*\bclass="lstedu_bookinfo--tit"[^>]*>([\s\S]*?)<\/p>/i;
const TEACHER_BLOCK = /<p\b[^>]*\bclass="lstedu_bookinfo--teacher"[^>]*>([\s\S]*?)<\/p>/i;
const FIRST_LINK = /<a\b[^>]*>([\s\S]*?)<\/a>/i;

// ───────────── 요청 ─────────────

/** `normalizeInputUrl`을 거친 URL을 받는다. */
export async function fetchMegastudyCurriculum(
  url: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Curriculum> {
  const courseCode = megastudyCourseCode(url);
  if (courseCode === null) throw new ExtractError("UNSUPPORTED");
  const { html } = await fetchPage(url, {
    isRequestable: (u) => isAllowedHost(u) && isMegastudyCoursePath(u),
    fetchImpl,
    encoding: "euc-kr",
  });
  return parseMegastudyHtml(html, url.href, courseCode);
}

// ───────────── 파싱 ─────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** 태그 제거 → 공백 정리 → 엔티티 디코딩. 결과는 일반 텍스트다. */
function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

/** `H:MM:SS` 또는 `MM:SS` → 초. `-`·빈 값·0·형식 오류는 null */
function durationOf(text: string): number | null {
  const match = TIME.exec(text);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return seconds > 0 ? seconds : null;
}

function titleOf(html: string): string {
  const match = COURSE_TITLE.exec(html);
  const title = match ? textOf(match[1]) : "";
  return title !== "" ? title : DEFAULT_TITLE;
}

function instructorOf(html: string): string | null {
  const block = TEACHER_BLOCK.exec(html);
  const link = block ? FIRST_LINK.exec(block[1]) : null;
  if (!link) return null;
  const name = textOf(link[1])
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*선생님$/, "")
    .trim();
  return name !== "" ? name : null;
}

interface Row {
  title: string;
  durationSec: number | null;
}

function rowsOf(tbody: string): Row[] {
  const rows: Row[] = [];
  for (const [, rowHtml] of tbody.matchAll(ROW)) {
    const first = FIRST_TD.exec(rowHtml);
    const title = first ? textOf(first[1]) : "";
    if (title === "") continue;
    const times = [...rowHtml.matchAll(TIME_TD)];
    const last = times.length > 0 ? textOf(times[times.length - 1][1]) : "";
    rows.push({ title, durationSec: durationOf(last) });
  }
  return rows;
}

export function parseMegastudyHtml(html: string, sourceUrl: string, courseCode: string): Curriculum {
  const table = CURRICULUM_TABLE.exec(html);
  if (!table) {
    if (html.includes("| 404")) throw new ExtractError("NOT_FOUND");
    throw new ExtractError("NO_CURRICULUM", "curriculum table not found");
  }
  const tbody = TBODY.exec(table[1]);
  const rows = tbody ? rowsOf(tbody[1]) : [];
  if (rows.length === 0) throw new ExtractError("NO_CURRICULUM", "no lectures");

  const title = titleOf(html);
  const sectionId = `megastudy:${courseCode}`;
  const items: CurriculumItem[] = [
    { id: sectionId, title, level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
    ...rows.map((row, index): CurriculumItem => ({
      id: `megastudy:${courseCode}:${index}`,
      title: row.title,
      level: 1,
      order: index + 1,
      sectionId,
      durationSec: row.durationSec,
      source: "origin",
      excluded: false,
    })),
  ];

  return {
    title,
    sourceUrl,
    platform: "megastudy",
    courseId: sectionId,
    instructor: instructorOf(html),
    droppedCount: 0,
    items,
  };
}
