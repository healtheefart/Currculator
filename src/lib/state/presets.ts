import type { IsoDate, PlanSettings, WeekdayMinutes } from "@/types/plan";

export type PresetId = "DAILY_60" | "WEEKDAYS_60" | "WEEKDAY60_WEEKEND120";

/** 화면 표시 순서 */
export const PRESET_ORDER: readonly PresetId[] = ["DAILY_60", "WEEKDAYS_60", "WEEKDAY60_WEEKEND120"];

// 인덱스 0 = 일요일
export const PRESETS: Record<PresetId, { label: string; weekdayMinutes: WeekdayMinutes }> = {
  DAILY_60: { label: "매일 60분", weekdayMinutes: [60, 60, 60, 60, 60, 60, 60] },
  WEEKDAYS_60: { label: "평일만 60분", weekdayMinutes: [0, 60, 60, 60, 60, 60, 0] },
  WEEKDAY60_WEEKEND120: { label: "평일 60분·주말 120분", weekdayMinutes: [120, 60, 60, 60, 60, 60, 120] },
};

export function createDefaultSettings(today: IsoDate): PlanSettings {
  return {
    startDate: today,
    weekdayMinutes: [...PRESETS.DAILY_60.weekdayMinutes],
    toleranceMinutes: 10,
    restDates: [],
    lectureMultiplier: 1.5,
  };
}

export function matchPreset(weekdayMinutes: WeekdayMinutes): PresetId | null {
  return (
    PRESET_ORDER.find((id) => PRESETS[id].weekdayMinutes.every((m, i) => m === weekdayMinutes[i])) ?? null
  );
}
