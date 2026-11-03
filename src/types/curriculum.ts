export type Platform = "inflearn" | "youtube" | "fastcampus" | "megastudy" | "book";
export type DurationSource = "origin" | "manual";

export interface CurriculumItem {
  id: string; // 플랫폼 원본 id 문자열
  title: string;
  level: 0 | 1; // 0 = 섹션(묶음 제목), 1 = 수업(배정 단위)
  order: number; // 목차 전체 순서 (0부터)
  sectionId: string | null; // 수업이면 소속 섹션 id, 섹션이면 null
  durationSec: number | null; // 수업만. 누락이면 null. 섹션은 null
  source: DurationSource;
  excluded: boolean; // 사용자가 제외한 수업 (섹션은 항상 false)
  pageStart?: number | null;
  pageEnd?: number | null;
}

export interface BookSearchResult {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  pageCount: number | null;
  coverUrl: string | null;
  chapters: { title: string; pageStart: number; pageEnd: number }[];
}

export interface Curriculum {
  title: string;
  sourceUrl: string;
  platform: Platform;
  courseId: string; // 플랫폼별 강의 id(인프런 숫자, `youtube:`, `fastcampus:`, `megastudy:` 접두). 강의당 계획 1개 판단에 쓴다
  instructor: string | null; // 강사명. 여러 명이면 ", "로 이음
  droppedCount: number; // 목차에서 뺀 영상 아닌 수업(퀴즈·과제) 수
  items: CurriculumItem[]; // 평평한 목록, 재귀 구조 금지
}

export type ExtractErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED"
  | "NOT_FOUND"
  | "FETCH_FAILED"
  | "NO_CURRICULUM";

/** 화면에서만 쓰는 오류 코드. ALREADY_PLANNED = 이미 계획을 만든 강의 */
export type ClientErrorCode = ExtractErrorCode | "ALREADY_PLANNED";

export type ExtractResponse =
  | { ok: true; curriculum: Curriculum }
  | { ok: false; code: ExtractErrorCode };
