import type { IsoDate } from "@/types/plan";

export interface PlanSummaryData {
  totalEffortSec: number;
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
  studyDays: number;
  warnDays: number;
}

/** 수업(itemIds 또는 entries)이 1개 이상인 날만 센다. days는 날짜 오름차순이라고 가정한다. */
export function summarizeDays(
  days: { date: IsoDate; itemIds?: string[]; entries?: unknown[]; effortSec: number; outOfRange: boolean }[],
): PlanSummaryData {
  const studied = days.filter((d) => (d.itemIds?.length ?? 0) + (d.entries?.length ?? 0) > 0);
  return {
    totalEffortSec: studied.reduce((acc, d) => acc + d.effortSec, 0),
    firstDate: studied.length > 0 ? studied[0].date : null,
    lastDate: studied.length > 0 ? studied[studied.length - 1].date : null,
    studyDays: studied.length,
    warnDays: studied.filter((d) => d.outOfRange).length,
  };
}
