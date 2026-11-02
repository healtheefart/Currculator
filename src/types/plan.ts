import type { Curriculum } from "./curriculum";

export type IsoDate = string; // Asia/Seoul 기준 "YYYY-MM-DD"

/** 인덱스 0 = 일요일 … 6 = 토요일. 값은 가용 분(0 = 학습 안 함) */
export type WeekdayMinutes = [number, number, number, number, number, number, number];

export interface PlanSettings {
  startDate: IsoDate;
  weekdayMinutes: WeekdayMinutes;
  toleranceMinutes: number;
  restDates: IsoDate[];
  lectureMultiplier: number;
}

export interface PlanDay {
  date: IsoDate;
  itemIds: string[];
  effortSec: number; // 그날 배정된 예상 학습시간 합 (초, 소수 가능)
  targetSec: number; // 그날 가용 시간 (초)
  outOfRange: boolean; // 허용 범위 밖이면 true
}

export interface Plan {
  days: PlanDay[];
  startDate: IsoDate;
  endDate: IsoDate;
  totalEffortSec: number;
  missingItemIds: string[]; // 시간 누락으로 배분에서 빠진 수업 id
}

export type PlanFailureReason = "NO_STUDY_DAYS" | "NO_ITEMS";

export type PlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: PlanFailureReason; missingItemIds: string[] };

/** 사용자가 직접 조정한 수업. 값이 날짜면 그 날로 옮김, null이면 계획에서 제외 */
export type PlanOverrides = Record<string, IsoDate | null>;

export interface AdjustedDay extends PlanDay {
  movedItemIds: string[]; // 이 날로 직접 옮겨 온 수업 id
}

export interface AdjustedPlan {
  days: AdjustedDay[]; // 날짜 오름차순. 수업이 모두 빠진 날도 남는다
  removedItemIds: string[]; // 계획에서 제외한 수업 id (목차 순서)
  baseDateById: Record<string, IsoDate>; // 자동 배분 기준 날짜
}

export interface MergedEntry {
  planId: string;
  itemId: string;
  effortSec: number;
}

export interface MergedDay {
  date: IsoDate;
  entries: MergedEntry[]; // 계획 저장 순서, 계획 안에서는 목차 순서
  effortSec: number;
  outOfRange: boolean; // 그날 계획 중 하나라도 범위 밖이면 true
}

export interface MergedPlan {
  days: MergedDay[]; // 수업이 있는 날만, 날짜 오름차순
}

export interface SavedPlan {
  id: string;
  curriculum: Curriculum;
  settings: PlanSettings;
  overrides: PlanOverrides;
  savedAt: string; // ISO 8601 시각 문자열 (표시·정렬용, 날짜 계산에 쓰지 않음)
}
