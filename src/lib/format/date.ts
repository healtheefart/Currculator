import { weekdayOf, type YearMonth } from "@/lib/date/kst";
import type { IsoDate } from "@/types/plan";

export const WEEKDAY_LABELS: readonly string[] = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-11-03" → "11월 3일" */
export function formatMonthDay(date: IsoDate): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

/** "2026-11-03" → "11월 3일 (화)" */
export function formatDateLabel(date: IsoDate): string {
  return `${formatMonthDay(date)} (${WEEKDAY_LABELS[weekdayOf(date)]})`;
}

/** "2026-11" → "2026년 11월" */
export function formatMonthLabel(month: YearMonth): string {
  return `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;
}
