import { addDays, weekdayOf } from "@/lib/date/kst";
import type { Curriculum } from "@/types/curriculum";
import type { IsoDate, PlanDay, PlanResult, PlanSettings } from "@/types/plan";
import { toSchedulable } from "./effort";

/** 부동소수 비교 허용 오차(초) */
const EPSILON = 1e-9;

/** 합계가 `[max(0, 목표−N분), 목표+N분]` 밖이면 true. 경계는 1e-9 오차를 허용한다. */
export function isOutOfRange(sumSec: number, targetSec: number, toleranceMinutes: number): boolean {
  const toleranceSec = toleranceMinutes * 60;
  const low = Math.max(0, targetSec - toleranceSec);
  const high = targetSec + toleranceSec;
  return sumSec < low - EPSILON || sumSec > high + EPSILON;
}

/**
 * 하루 분량 모드 자동 배분 (docs/USER_FLOW.md "배분 규칙", ADR-005).
 * 순수 함수: I/O·현재 시각·난수를 쓰지 않는다.
 */
export function buildPlan(curriculum: Curriculum, settings: PlanSettings): PlanResult {
  const { schedulable, missingIds } = toSchedulable(curriculum, settings.lectureMultiplier);

  if (settings.weekdayMinutes.every((m) => !(m > 0))) {
    return { ok: false, reason: "NO_STUDY_DAYS", missingItemIds: missingIds };
  }
  if (schedulable.length === 0) {
    return { ok: false, reason: "NO_ITEMS", missingItemIds: missingIds };
  }

  const restDates = new Set(settings.restDates);
  const days: PlanDay[] = [];
  let next = 0;
  let date: IsoDate = settings.startDate;

  while (next < schedulable.length) {
    const minutes = settings.weekdayMinutes[weekdayOf(date)];
    if (minutes > 0 && !restDates.has(date)) {
      const targetSec = minutes * 60;
      const high = targetSec + settings.toleranceMinutes * 60;

      // 끊는 지점 후보: 1개 이상 누적한 합. 상한을 처음 넘는 지점까지만 본다(그 뒤는 더 멀다).
      let sum = 0;
      let bestIn: { count: number; sum: number } | null = null;
      let bestAny: { count: number; sum: number } | null = null;
      for (let i = next; i < schedulable.length; i++) {
        sum += schedulable[i].effortSec;
        const candidate = { count: i - next + 1, sum };
        const distance = Math.abs(sum - targetSec);
        // 앞 후보가 항상 더 짧으므로, 확실히 더 가까울 때만 바꿔 동률은 짧은 쪽을 유지한다.
        if (!isOutOfRange(sum, targetSec, settings.toleranceMinutes)) {
          if (bestIn === null || distance < Math.abs(bestIn.sum - targetSec) - EPSILON) bestIn = candidate;
        }
        if (bestAny === null || distance < Math.abs(bestAny.sum - targetSec) - EPSILON) bestAny = candidate;
        if (sum > high + EPSILON) break;
      }

      const chosen = (bestIn ?? bestAny)!;
      days.push({
        date,
        itemIds: schedulable.slice(next, next + chosen.count).map((s) => s.id),
        effortSec: chosen.sum,
        targetSec,
        outOfRange: bestIn === null,
      });
      next += chosen.count;
    }
    date = addDays(date, 1);
  }

  return {
    ok: true,
    plan: {
      days,
      startDate: settings.startDate,
      endDate: days[days.length - 1].date,
      totalEffortSec: schedulable.reduce((acc, s) => acc + s.effortSec, 0),
      missingItemIds: missingIds,
    },
  };
}
